// AgentRunner Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentRunner, type AgentRunnerConfig } from '@/agent/runner';
import { StorageService } from '@/storage/service';
import { SessionManager } from '@/session/manager';
import type { ActiveSession } from '@/session/types';

// Mock SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';

describe('AgentRunner', () => {
  let storage: StorageService;
  let sessionManager: SessionManager;
  let config: AgentRunnerConfig;
  let runner: AgentRunner;

  beforeEach(async () => {
    storage = new StorageService(':memory:');
    sessionManager = new SessionManager(storage);
    config = {
      storage,
      sessionManager,
      skills: [],
      model: 'claude-sonnet-4-5-20250929',
    };
    runner = new AgentRunner(config);
    vi.clearAllMocks();
  });

  afterEach(() => {
    storage.close();
  });

  describe('constructor', () => {
    it('should create runner with config', () => {
      expect(runner).toBeDefined();
    });
  });

  describe('run', () => {
    it('should call SDK with correct parameters', async () => {
      // 先在数据库中创建 session
      const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

      // Mock SDK response
      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        yield { type: 'system', subtype: 'init', session_id: 'sdk-123' };
        yield { type: 'result' };
      });

      // Run
      const messages = [];
      for await (const msg of runner.run({ userInput: 'test', session })) {
        messages.push(msg);
      }

      // Verify SDK was called
      expect(mockQuery).toHaveBeenCalledTimes(1);
      // query({ prompt, options }) - options is second argument
      const callArgs = mockQuery.mock.calls[0][0] as any;
      expect(callArgs?.options?.model).toBe('claude-sonnet-4-5-20250929');
      expect(callArgs?.options?.systemPrompt).toContain('系统时间锚点');
    });

    it('should update SDK session ID', async () => {
      const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        yield { type: 'system', subtype: 'init', session_id: 'sdk-new-456' };
        yield { type: 'result' };
      });

      for await (const _ of runner.run({ userInput: 'test', session })) {
        // consume
      }

      expect(session.sdkSessionId).toBe('sdk-new-456');
    });

    it('should filter inner_monologue from output', async () => {
      const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: '<inner_monologue>thinking...</inner_monologue>Hello!' },
            ],
          },
        };
        yield { type: 'result' };
      });

      const texts: string[] = [];
      for await (const msg of runner.run({ userInput: 'test', session })) {
        if (msg.type === 'text') {
          texts.push(msg.content);
        }
      }

      expect(texts.join('')).toBe('Hello!');
      expect(texts.join('')).not.toContain('inner_monologue');
    });

    it('should yield tool_use messages', async () => {
      const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'WebSearch', id: 'tool-1' },
            ],
          },
        };
        yield { type: 'result' };
      });

      const messages = [];
      for await (const msg of runner.run({ userInput: 'test', session })) {
        messages.push(msg);
      }

      const toolMsg = messages.find(m => m.type === 'tool_use');
      expect(toolMsg).toBeDefined();
      expect(toolMsg?.content).toBe('WebSearch');
    });

    it('should use resume parameter for existing session', async () => {
      const session = await sessionManager.getOrCreateSession({ platform: 'cli' });
      session.sdkSessionId = 'sdk-resume-123';

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        yield { type: 'result' };
      });

      for await (const _ of runner.run({ userInput: 'test', session })) {
        // consume
      }

      const callArgs = mockQuery.mock.calls[0][0] as any;
      expect(callArgs?.options?.resume).toBe('sdk-resume-123');
    });

    it('should save user and assistant messages to storage', async () => {
      const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        // 模拟处理延迟
        await new Promise((r) => setTimeout(r, 10));
        yield {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Hello there!' },
            ],
          },
        };
        yield { type: 'result' };
      });

      for await (const _ of runner.run({ userInput: 'test input', session })) {
        // consume
      }

      // 验证消息已保存（按时间倒序，最新的在前）
      const messages = await storage.getSessionMessages(session.id);
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toBe('Hello there!');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('test input');
    });
  });

  describe('runText', () => {
    it('should yield only text output', async () => {
      const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

      const mockQuery = vi.mocked(query);
      mockQuery.mockImplementation(async function* () {
        yield {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Hello ' },
              { type: 'tool_use', name: 'Search', id: 't1' },
              { type: 'text', text: 'World!' },
            ],
          },
        };
        yield { type: 'result' };
      });

      const texts: string[] = [];
      for await (const text of runner.runText({ userInput: 'test', session })) {
        texts.push(text);
      }

      // Should include text and tool indicator
      expect(texts.some(t => t.includes('Hello'))).toBe(true);
      expect(texts.some(t => t.includes('World'))).toBe(true);
    });
  });
});
