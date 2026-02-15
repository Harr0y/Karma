// Agent Runner - 封装 SDK 调用

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { StorageService } from '@/storage/service.js';
import type { SessionManager } from '@/session/manager.js';
import type { ActiveSession } from '@/session/types.js';
import type { Skill } from '@/skills/types.js';
import { buildSystemPrompt } from '@/prompt/builder.js';
import { MonologueFilter } from './monologue-filter.js';

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

  constructor(config: AgentRunnerConfig) {
    this.config = config;
  }

  /**
   * 运行一轮对话
   * @returns AsyncGenerator<ProcessedMessage>
   */
  async *run(options: RunOptions): AsyncGenerator<ProcessedMessage> {
    const { userInput, session } = options;
    const { storage, sessionManager, skills, model, baseUrl, authToken } = this.config;

    console.log('[Runner] 开始处理请求...');
    console.log('[Runner] userInput:', userInput.substring(0, 50) + '...');
    console.log('[Runner] session.sdkSessionId:', session.sdkSessionId || '(无)');

    // 1. 构建 System Prompt
    console.log('[Runner] 构建 System Prompt...');
    const systemPrompt = await buildSystemPrompt({
      now: new Date(),
      skills,
      platform: 'cli',
    });
    console.log('[Runner] System Prompt 长度:', systemPrompt.length);

    // 2. 构建环境变量
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    if (authToken) {
      env.ANTHROPIC_AUTH_TOKEN = authToken;
      console.log('[Runner] 设置 ANTHROPIC_AUTH_TOKEN:', authToken.substring(0, 10) + '...');
    }
    if (baseUrl) {
      env.ANTHROPIC_BASE_URL = baseUrl;
      console.log('[Runner] 设置 ANTHROPIC_BASE_URL:', baseUrl);
    }
    console.log('[Runner] model:', model);

    // 3. 调用 SDK
    console.log('[Runner] 调用 SDK query()...');
    const queryOptions = {
      model,
      systemPrompt,
      resume: session.sdkSessionId,
      permissionMode: 'bypassPermissions' as const,
      allowDangerouslySkipPermissions: true,
      cwd: process.cwd(),
      env,
    };
    console.log('[Runner] query options:', JSON.stringify({
      model: queryOptions.model,
      resume: queryOptions.resume,
      cwd: queryOptions.cwd,
      envKeys: Object.keys(queryOptions.env).filter(k => k.startsWith('ANTHROPIC')),
    }));

    let q;
    try {
      q = query({
        prompt: userInput,
        options: queryOptions,
      });
      console.log('[Runner] SDK query() 返回，开始迭代...');
    } catch (err: any) {
      console.error('[Runner] SDK query() 抛出异常:', err.message);
      throw err;
    }

    // 4. 处理流式消息
    const filter = new MonologueFilter();
    let msgCount = 0;

    try {
      for await (const msg of q) {
        msgCount++;
        console.log('[Runner] 收到消息 #' + msgCount, JSON.stringify({
          type: msg.type,
          ...(msg.type === 'system' ? { subtype: (msg as any).subtype } : {}),
          ...(msg.type === 'result' ? {} : {}),
          ...(msg.type === 'assistant' ? { contentLength: (msg as any).message?.content?.length } : {}),
          ...('session_id' in msg ? { session_id: msg.session_id } : {}),
        }));

        // 捕获 SDK session_id
        if ('session_id' in msg && msg.session_id) {
          console.log('[Runner] 保存 SDK session_id:', msg.session_id);
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
      console.log('[Runner] 迭代结束，共收到', msgCount, '条消息');
    } catch (err: any) {
      console.error('[Runner] 迭代异常:', err.message);
      console.error('[Runner] 异常堆栈:', err.stack);
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
