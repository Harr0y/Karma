/**
 * PiAgentRunner - pi-mono Agent 适配层
 *
 * 将 pi-mono 的 Agent 类封装为与现有 Karma 系统兼容的接口
 */

import { Agent, type AgentEvent, type AgentTool } from '@mariozechner/pi-agent-core';
import { getModel, type Model } from '@mariozechner/pi-ai';
import type { StorageService } from '@/storage/service.js';
import type { SessionManager } from '@/session/manager.js';
import type { ActiveSession } from '@/session/types.js';
import type { Logger } from '@/logger/types.js';
import { getLogger } from '@/logger/index.js';
import { buildSystemPrompt } from '@/prompt/builder.js';
import type { Skill } from '@/skills/types.js';
import { extractClientInfo, extractAllFacts, extractAllPredictions } from './info-extractor.js';
import { MonologueFilter } from './monologue-filter.js';

export interface PiAgentRunnerConfig {
  storage: StorageService;
  sessionManager: SessionManager;
  skills: Skill[];
  model: string;
  baseUrl?: string;
  authToken?: string;
  timeout?: number;
  tools: AgentTool<any, any>[];
}

export interface RunOptions {
  userInput: string;
  session: ActiveSession;
}

export interface ProcessedMessage {
  type: 'text' | 'tool_use' | 'system' | 'result';
  content: string;
  raw?: any;
}

/**
 * PiAgentRunner - 使用 pi-mono Agent 的运行器
 */
export class PiAgentRunner {
  private config: PiAgentRunnerConfig;
  private logger: Logger;
  private agents = new Map<string, Agent>(); // per-session agents

  constructor(config: PiAgentRunnerConfig) {
    this.config = config;
    this.logger = getLogger().child({ module: 'agent' });
  }

  /**
   * 运行一轮对话
   */
  async *run(options: RunOptions): AsyncGenerator<ProcessedMessage> {
    const { userInput, session } = options;
    const { storage, sessionManager, skills, tools, model, timeout } = this.config;

    const getDuration = this.logger.startTimer('pi_run');

    this.logger.debug('开始处理请求', {
      operation: 'run_start',
      sessionId: session.id,
      metadata: {
        userInput: userInput.substring(0, 50) + '...',
      },
    });

    // 0. 保存用户消息
    await storage.addMessage(session.id, 'user', userInput);

    // 1. 获取或创建 Agent
    const agent = await this.getOrCreateAgent(session);
    if (!agent) {
      throw new Error('此 API 不支持 pi-ai，请使用旧的 AgentRunner 或 设置环境变量 KARMA_PI_RUNNER_FALLBACK=true');
    }

    // 2. 更新 System Prompt（如果有 clientProfile）
    const clientId = session.clientId;
    if (clientId) {
      const clientProfile = await storage.generateClientProfilePrompt(clientId);
      const systemPrompt = await this.buildSystemPrompt(clientProfile);
      agent.setSystemPrompt(systemPrompt);
    }

    // 3. 设置事件流
    const messageQueue: ProcessedMessage[] = [];
    let resolveEnd: () => void;
    const endPromise = new Promise<void>((resolve) => {
      resolveEnd = resolve;
    });

    // 生产环境：keepInnerMonologue: false
    const keepInnerMonologue = process.env.KARMA_DEBUG === 'true';
    const filter = new MonologueFilter({ keepInnerMonologue });
    let assistantContent = '';
    let rawContent = '';

    const unsub = agent.subscribe((event: AgentEvent) => {
      switch (event.type) {
        case 'message_start':
          if (event.message.role === 'assistant') {
            // 开始新的助手消息
          }
          break;

        case 'message_update':
          if ((event as any).assistantMessageEvent?.type === 'text_delta') {
            const delta = (event as any).assistantMessageEvent.delta;
            rawContent += delta;
            const filtered = filter.process(delta);
            if (filtered) {
              assistantContent += filtered;
              messageQueue.push({ type: 'text', content: filtered });
            }
          }
          break;

        case 'tool_execution_start':
          messageQueue.push({ type: 'tool_use', content: (event as any).toolName || 'tool' });
          this.logger.info('工具调用', {
            operation: 'tool_call',
            sessionId: session.id,
            metadata: {
              toolName: (event as any).toolName,
              toolCallId: (event as any).toolCallId,
            },
          });
          break;

        case 'message_end':
          if (event.message.role === 'assistant') {
            // 助手消息完成
          }
          break;

        case 'turn_end':
          // 刷新过滤器剩余内容
          const remaining = filter.flush();
          if (remaining) {
            assistantContent += remaining;
            messageQueue.push({ type: 'text', content: remaining });
          }
          break;

        case 'agent_end':
          resolveEnd();
          break;
      }
    });

    // 4. 发起请求
    try {
      const promptPromise = agent.prompt(userInput);

      // 5. 并行处理事件和等待完成
      while (true) {
        // 发送队列中的消息
        while (messageQueue.length > 0) {
          yield messageQueue.shift()!;
        }

        // 检查是否完成
        if (await Promise.race([
          promptPromise.then(() => true),
          endPromise.then(() => true),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10)),
        ])) {
          // 发送剩余消息
          while (messageQueue.length > 0) {
            yield messageQueue.shift()!;
          }
          break;
        }
      }

      // 6. 提取并保存结构化信息
      await this.extractAndSaveInfo(rawContent, session);

      // 7. 保存助手消息
      if (assistantContent) {
        await storage.addMessage(session.id, 'assistant', assistantContent, rawContent);
      }

      yield { type: 'result', content: 'Turn completed' };

      const duration = getDuration();
      this.logger.info('请求处理完成', {
        operation: 'run_complete',
        sessionId: session.id,
        duration,
      });
    } catch (error: any) {
      this.logger.error('处理异常', error, {
        operation: 'run_error',
        sessionId: session.id,
      });
      yield { type: 'text', content: `处理失败: ${error.message}` };
      yield { type: 'result', content: 'Error' };
    } finally {
      unsub();
    }
  }

  /**
   * 简化的运行方法 - 直接返回过滤后的文本
   */
  async *runText(options: RunOptions): AsyncGenerator<string> {
    for await (const msg of this.run(options)) {
      if (msg.type === 'text') {
        yield msg.content;
      } else if (msg.type === 'tool_use') {
        yield `\n[调用工具: ${msg.content}]\n`;
      }
    }
  }

  /**
   * 获取或创建 Agent 实例
   * 返回 null 表示需要 fallback 到旧的 AgentRunner
   */
  private async getOrCreateAgent(session: ActiveSession): Promise<Agent | null> {
    let agent = this.agents.get(session.id);

    if (!agent) {
      const model = this.createModel();

      // 如果 createModel 返回 null，需要 fallback
      if (!model) {
        return null;
      }

      const systemPrompt = await this.buildSystemPrompt();

      agent = new Agent({
        initialState: {
          systemPrompt,
          model,
          tools: this.config.tools,
          thinkingLevel: 'off',
        },
        sessionId: session.id,
      });

      this.agents.set(session.id, agent);
      this.logger.debug('创建新 Agent', {
        operation: 'agent_create',
        sessionId: session.id,
      });
    }

    return agent;
  }

  /**
   * 创建 Model 实例
   */
  private createModel(): Model<any> | null {
    const { model: modelId, baseUrl, authToken } = this.config;

    // 检查是否需要 fallback 到旧 Agent 方式
    const needsFallback = baseUrl && (
      baseUrl.includes('bigmodel.cn') ||
      baseUrl.includes('zhipu.ai')
    );

    if (needsFallback) {
      this.logger.warn('GLM 不支持 pi-ai， 回退到旧的 AgentRunner', {
        operation: 'pi_fallback',
        metadata: { baseUrl },
      });
      return null;
    }

    // 解析模型 ID（格式：provider/model-id）
    const [provider, id] = modelId.includes('/')
      ? modelId.split('/')
      : ['anthropic', modelId];

    // 获取模型并配置
    const model = getModel(provider as any, id);
    if (!model) {
      throw new Error(`No model configured`);
    }
    return model;
  }

  /**
   * 构建 System Prompt
   */
  private async buildSystemPrompt(clientProfile?: string): Promise<string> {
    const { skills } = this.config;

    return buildSystemPrompt({
      now: new Date(),
      skills,
      platform: 'cli',
      clientProfile,
    });
  }

  /**
   * 从响应中提取并保存结构化信息
   */
  private async extractAndSaveInfo(
    rawContent: string,
    session: ActiveSession
  ): Promise<void> {
    const { storage, sessionManager } = this.config;

    // 1. 提取客户信息
    let clientInfo = extractClientInfo(rawContent);
    if (clientInfo) {
      await this.handleClientInfo(clientInfo, session);
    }

    // 2. 提取确认的事实
    const facts = extractAllFacts(rawContent);
    if (facts.length > 0 && session.clientId) {
      for (const fact of facts) {
        await storage.addConfirmedFact({
          clientId: session.clientId,
          sessionId: session.id,
          fact: fact.fact,
          category: fact.category,
          confirmed: true,
        });
      }
      this.logger.debug('保存确认事实', {
        operation: 'fact_save',
        metadata: { count: facts.length },
      });
    }

    // 3. 提取预测
    const predictions = extractAllPredictions(rawContent);
    if (predictions.length > 0 && session.clientId) {
      for (const prediction of predictions) {
        await storage.addPrediction({
          clientId: session.clientId,
          sessionId: session.id,
          prediction: prediction.prediction,
          targetYear: prediction.year,
        });
      }
      this.logger.debug('保存预测', {
        operation: 'prediction_save',
        metadata: { count: predictions.length },
      });
    }
  }

  /**
   * 处理客户信息
   */
  private async handleClientInfo(
    info: NonNullable<ReturnType<typeof extractClientInfo>>,
    session: ActiveSession
  ): Promise<void> {
    const { storage, sessionManager } = this.config;

    if (!session.clientId) {
      // 尝试根据生辰信息查找已有客户
      let clientId: string | null = null;

      if (info.birthDate && info.birthPlace) {
        const existingClient = await storage.findClientByBirthInfo(
          info.birthDate,
          info.birthPlace
        );
        if (existingClient) {
          clientId = existingClient.id;
          await storage.updateClient(clientId, {
            sessionCount: (existingClient.sessionCount ?? 0) + 1,
            name: info.name || existingClient.name,
            currentCity: info.currentCity || existingClient.currentCity,
          });
          this.logger.info('关联已有客户', {
            operation: 'client_link',
            clientId,
          });
        }
      }

      // 如果没有找到已有客户，创建新客户
      if (!clientId) {
        clientId = await storage.createClient({
          name: info.name,
          gender: info.gender,
          birthDate: info.birthDate,
          birthPlace: info.birthPlace,
          currentCity: info.currentCity,
        });
        this.logger.info('创建新客户', {
          operation: 'client_create',
          clientId,
        });
      }

      // 更新会话关联
      session.clientId = clientId;
      await sessionManager.updateSessionClient(session.id, clientId);
    } else {
      // 已有客户，更新信息
      const updateData: Record<string, unknown> = {};
      if (info.name) updateData.name = info.name;
      if (info.gender) updateData.gender = info.gender;
      if (info.birthDate) updateData.birthDate = info.birthDate;
      if (info.birthPlace) updateData.birthPlace = info.birthPlace;
      if (info.currentCity) updateData.currentCity = info.currentCity;

      if (Object.keys(updateData).length > 0) {
        await storage.updateClient(session.clientId, updateData);
      }
    }
  }

  /**
   * 清理会话 Agent
   */
  clearAgent(sessionId: string): void {
    this.agents.delete(sessionId);
  }

  /**
   * 清理所有 Agent
   */
  clearAllAgents(): void {
    this.agents.clear();
  }
}
