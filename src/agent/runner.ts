// Agent Runner - 封装 SDK 调用

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { StorageService } from '@/storage/service.js';
import type { SessionManager } from '@/session/manager.js';
import type { ActiveSession } from '@/session/types.js';
import type { Skill } from '@/skills/types.js';
import type { PersonaService } from '@/persona/service.js';
import { buildSystemPrompt } from '@/prompt/builder.js';
import { MonologueFilter } from './monologue-filter.js';
import {
  extractClientInfo,
  extractAllFacts,
  extractAllPredictions,
} from './info-extractor.js';
import { getLogger } from '@/logger/index.js';
import type { Logger } from '@/logger/types.js';
import { createKarmaMcpServer } from '@/tools/registry.js';

export interface AgentRunnerConfig {
  storage: StorageService;
  sessionManager: SessionManager;
  skills: Skill[];
  personaService?: PersonaService;
  model: string;
  baseUrl?: string;
  authToken?: string;
  timeout?: number; // 超时时间（毫秒），默认 300000 (5分钟)
}

export interface RunOptions {
  userInput: string;
  session: ActiveSession;
}

export interface ProcessedMessage {
  type: 'text' | 'tool_use' | 'system' | 'result';
  content: string;
  raw?: SDKMessage;
}

/**
 * Agent Runner - 整合所有模块，运行 Agent 对话
 */
export class AgentRunner {
  private config: AgentRunnerConfig;
  private logger: Logger;

  constructor(config: AgentRunnerConfig) {
    this.config = config;
    this.logger = getLogger().child({ module: 'agent' });
  }

  /**
   * 运行一轮对话
   * @returns AsyncGenerator<ProcessedMessage>
   */
  async *run(options: RunOptions): AsyncGenerator<ProcessedMessage> {
    const { userInput, session } = options;
    const { storage, sessionManager, skills, personaService, model, baseUrl, authToken, timeout } =
      this.config;

    const getDuration = this.logger.startTimer('run');

    this.logger.debug('开始处理请求', {
      operation: 'run_start',
      sessionId: session.id,
      metadata: {
        userInput: userInput.substring(0, 50) + '...',
        hasSdkSession: !!session.sdkSessionId,
      },
    });

    // 0. 保存用户消息
    await storage.addMessage(session.id, 'user', userInput);

    // 1. 构建 System Prompt
    this.logger.debug('构建 System Prompt', { operation: 'prompt_build' });

    // 获取客户档案（如果有）
    const clientId = session.clientId;
    const clientProfile = clientId
      ? await storage.generateClientProfilePrompt(clientId)
      : undefined;

    const systemPrompt = await buildSystemPrompt({
      now: new Date(),
      skills,
      platform: 'cli',
      personaConfig: personaService
        ? {
            personaService,
            clientId,
          }
        : undefined,
      clientProfile,
    });
    this.logger.debug('System Prompt 构建完成', {
      operation: 'prompt_build',
      metadata: { promptLength: systemPrompt.length },
    });

    // 2. 构建环境变量
    // 排除 CLAUDECODE 以允许在 Claude Code 会话中嵌套运行 SDK
    const { CLAUDECODE, ...restEnv } = process.env as Record<string, string | undefined>;
    const env: Record<string, string> = restEnv as Record<string, string>;
    if (authToken) {
      env.ANTHROPIC_AUTH_TOKEN = authToken;
    }
    if (baseUrl) {
      env.ANTHROPIC_BASE_URL = baseUrl;
    }

    // 3. 调用 SDK
    this.logger.debug('调用 SDK', {
      operation: 'sdk_call',
      metadata: { model, resume: session.sdkSessionId, timeout },
    });

    // 创建 AbortController 用于超时控制
    const timeoutMs = timeout ?? 300000; // 默认 5 分钟
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
      this.logger.warn('请求超时，正在中止', {
        operation: 'timeout_abort',
        sessionId: session.id,
        metadata: { timeoutMs },
      });
    }, timeoutMs);

    const queryOptions = {
      model,
      systemPrompt,
      resume: session.sdkSessionId,
      permissionMode: 'bypassPermissions' as const,
      allowDangerouslySkipPermissions: true,
      cwd: process.cwd(),
      env,
      abortController,
      mcpServers: {
        'karma-tools': createKarmaMcpServer(),
      },
    };

    let q;
    try {
      q = query({
        prompt: userInput,
        options: queryOptions,
      });
    } catch (err: any) {
      this.logger.error('SDK query() 抛出异常', err, { operation: 'sdk_call' });
      throw err;
    }

    // 4. 处理流式消息
    // 生产环境：keepInnerMonologue: false - 完全过滤 inner_monologue
    // 调试环境：设置环境变量 KARMA_DEBUG=true 可保留 inner_monologue 内容
    const keepInnerMonologue = process.env.KARMA_DEBUG === 'true';
    const filter = new MonologueFilter({ keepInnerMonologue });
    let msgCount = 0;
    let assistantContent = ''; // 收集助手响应（过滤后）
    let rawContent = ''; // 收集原始响应（用于提取信息）

    try {
      for await (const msg of q) {
        msgCount++;

        // 捕获 SDK session_id
        if ('session_id' in msg && msg.session_id) {
          this.logger.debug('保存 SDK session-id', {
            operation: 'sdk_session_save',
            sessionId: session.id,
            metadata: { sdkSessionId: msg.session_id },
          });
          await sessionManager.updateSdkSessionId(session.id, msg.session_id);
          session.sdkSessionId = msg.session_id;
        }

        // 处理不同消息类型
        if (msg.type === 'system' && 'subtype' in msg && msg.subtype === 'init') {
          yield { type: 'system', content: 'Session initialized', raw: msg };
        }

        if (msg.type === 'assistant' && 'message' in msg) {
          const content = msg.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text') {
                rawContent += block.text; // 收集原始内容
                // 过滤 inner_monologue
                const filtered = filter.process(block.text);
                if (filtered) {
                  assistantContent += filtered; // 收集过滤后的内容
                  yield { type: 'text', content: filtered, raw: msg };
                }
              } else if (block.type === 'tool_use') {
                // 记录工具调用
                this.logger.info('工具调用', {
                  operation: 'tool_use',
                  sessionId: session.id,
                  metadata: {
                    toolName: block.name,
                    toolId: block.id,
                    input: block.input,
                  },
                });
                yield { type: 'tool_use', content: block.name || 'tool', raw: msg };
              }
            }
          }
        }

        if (msg.type === 'result') {
          // 刷新过滤器剩余内容
          const remaining = filter.flush();
          if (remaining) {
            assistantContent += remaining;
            rawContent += remaining;
            yield { type: 'text', content: remaining, raw: msg };
          }

          // 5. 提取并保存结构化信息
          await this.extractAndSaveInfo(rawContent, session);

          // 6. 保存助手消息
          if (assistantContent) {
            await storage.addMessage(session.id, 'assistant', assistantContent);
            this.logger.debug('助手消息已保存', {
              operation: 'message_save',
              sessionId: session.id,
              metadata: { contentLength: assistantContent.length },
            });
          }

          yield { type: 'result', content: 'Turn completed', raw: msg };
        }
      }

      // 正常完成，立刻清除超时定时器
      clearTimeout(timeoutId);

      const duration = getDuration();
      this.logger.info('请求处理完成', {
        operation: 'run_complete',
        sessionId: session.id,
        duration,
        metadata: { messageCount: msgCount },
      });
    } catch (err: any) {
      // 处理超时错误
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        const timeoutError = new Error(`请求超时（${timeoutMs}ms）`);
        timeoutError.name = 'TimeoutError';
        this.logger.error('请求超时', timeoutError, {
          operation: 'timeout_error',
          sessionId: session.id,
          metadata: { timeoutMs },
        });
        throw timeoutError;
      }

      this.logger.error('迭代异常', err, {
        operation: 'run_error',
        sessionId: session.id,
      });
      throw err;
    } finally {
      // 确保超时定时器被清除
      clearTimeout(timeoutId);
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
        yield `\n\x1b[33m[调用工具: ${msg.content}]\x1b[0m\n`;
      }
    }
  }

  /**
   * 从响应中提取并保存结构化信息
   */
  private async extractAndSaveInfo(
    rawContent: string,
    session: ActiveSession
  ): Promise<void> {
    const { storage } = this.config;

    // 1. 提取客户信息
    const clientInfo = extractClientInfo(rawContent);
    if (clientInfo) {
      await this.handleClientInfo(clientInfo, session);
    }

    // 2. 提取所有确认的事实
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
        metadata: { count: facts.length, facts: facts.map(f => f.fact) },
      });
    }

    // 3. 提取所有预测
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
        metadata: { count: predictions.length, predictions: predictions.map(p => p.prediction) },
      });
    }
  }

  /**
   * 处理客户信息
   */
  private async handleClientInfo(
    info: ReturnType<typeof extractClientInfo>,
    session: ActiveSession
  ): Promise<void> {
    const { storage, sessionManager } = this.config;

    // 如果会话还没有关联客户
    if (!session.clientId) {
      // 尝试根据生辰信息查找已有客户
      let clientId: string | null = null;

      if (info!.birthDate && info!.birthPlace) {
        const existingClient = await storage.findClientByBirthInfo(
          info!.birthDate,
          info!.birthPlace
        );
        if (existingClient) {
          clientId = existingClient.id;
          // 更新客户的最后访问时间和会话计数
          await storage.updateClient(clientId, {
            sessionCount: (existingClient.sessionCount ?? 0) + 1,
            name: info!.name || existingClient.name,
            currentCity: info!.currentCity || existingClient.currentCity,
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
          name: info!.name,
          gender: info!.gender,
          birthDate: info!.birthDate,
          birthPlace: info!.birthPlace,
          currentCity: info!.currentCity,
        });
        this.logger.info('创建新客户', {
          operation: 'client_create',
          clientId,
        });
      }

      // 更新会话关联
      session.clientId = clientId;
      // 持久化 clientId 到数据库
      await sessionManager.updateSessionClient(session.id, clientId);
      this.logger.debug('会话关联客户', {
        operation: 'session_client_link',
        sessionId: session.id,
        clientId,
      });
    } else {
      // 已有客户，更新信息（只更新非 undefined 字段，避免覆盖已有值）
      const updateData: Record<string, unknown> = {};
      if (info!.name) updateData.name = info!.name;
      if (info!.gender) updateData.gender = info!.gender;
      if (info!.birthDate) updateData.birthDate = info!.birthDate;
      if (info!.birthPlace) updateData.birthPlace = info!.birthPlace;
      if (info!.currentCity) updateData.currentCity = info!.currentCity;

      if (Object.keys(updateData).length > 0) {
        await storage.updateClient(session.clientId, updateData);
        this.logger.debug('更新客户信息', {
          operation: 'client_update',
          clientId: session.clientId,
          metadata: { fields: Object.keys(updateData) },
        });
      }
    }
  }
}
