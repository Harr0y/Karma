// Agent Runner - 封装 SDK 调用

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { StorageService } from '@/storage/service.js';
import type { SessionManager } from '@/session/manager.js';
import type { ActiveSession } from '@/session/types.js';
import type { Skill } from '@/skills/types.js';
import { buildSystemPrompt } from '@/prompt/builder.js';
import { MonologueFilter } from './monologue-filter.js';
import { getLogger } from '@/logger/index.js';
import type { Logger } from '@/logger/types.js';

export interface AgentRunnerConfig {
  storage: StorageService;
  sessionManager: SessionManager;
  skills: Skill[];
  model: string;
  baseUrl?: string;
  authToken?: string;
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
    const { storage, sessionManager, skills, model, baseUrl, authToken } = this.config;

    const getDuration = this.logger.startTimer('run');

    this.logger.debug('开始处理请求', {
      operation: 'run_start',
      sessionId: session.id,
      metadata: {
        userInput: userInput.substring(0, 50) + '...',
        hasSdkSession: !!session.sdkSessionId,
      },
    });

    // 1. 构建 System Prompt
    this.logger.debug('构建 System Prompt', { operation: 'prompt_build' });
    const systemPrompt = await buildSystemPrompt({
      now: new Date(),
      skills,
      platform: 'cli',
    });
    this.logger.debug('System Prompt 构建完成', {
      operation: 'prompt_build',
      metadata: { promptLength: systemPrompt.length },
    });

    // 2. 构建环境变量
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    if (authToken) {
      env.ANTHROPIC_AUTH_TOKEN = authToken;
    }
    if (baseUrl) {
      env.ANTHROPIC_BASE_URL = baseUrl;
    }

    // 3. 调用 SDK
    this.logger.debug('调用 SDK', {
      operation: 'sdk_call',
      metadata: { model, resume: session.sdkSessionId },
    });

    const queryOptions = {
      model,
      systemPrompt,
      resume: session.sdkSessionId,
      permissionMode: 'bypassPermissions' as const,
      allowDangerouslySkipPermissions: true,
      cwd: process.cwd(),
      env,
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
    const filter = new MonologueFilter();
    let msgCount = 0;

    try {
      for await (const msg of q) {
        msgCount++;

        // 捕获 SDK session_id
        if ('session_id' in msg && msg.session_id) {
          this.logger.debug('保存 SDK session_id', {
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
                // 过滤 inner_monologue
                const filtered = filter.process(block.text);
                if (filtered) {
                  yield { type: 'text', content: filtered, raw: msg };
                }
              } else if (block.type === 'tool_use') {
                yield { type: 'tool_use', content: block.name || 'tool', raw: msg };
              }
            }
          }
        }

        if (msg.type === 'result') {
          // 刷新过滤器剩余内容
          const remaining = filter.flush();
          if (remaining) {
            yield { type: 'text', content: remaining, raw: msg };
          }
          yield { type: 'result', content: 'Turn completed', raw: msg };
        }
      }

      const duration = getDuration();
      this.logger.info('请求处理完成', {
        operation: 'run_complete',
        sessionId: session.id,
        duration,
        metadata: { messageCount: msgCount },
      });
    } catch (err: any) {
      this.logger.error('迭代异常', err, {
        operation: 'run_error',
        sessionId: session.id,
      });
      throw err;
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
}
