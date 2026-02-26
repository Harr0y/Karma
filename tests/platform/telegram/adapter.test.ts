// TelegramAdapter Tests - TDD Approach

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncomingMessage } from '@/platform/types.js';
import type { TelegramUpdate } from '@/platform/adapters/telegram/types.js';

// Mock undici 模块 - 必须在导入之前
vi.mock('undici', () => ({
  request: vi.fn(),
  ProxyAgent: class MockProxyAgent {},
  setGlobalDispatcher: vi.fn(),
}));

// 导入模块（在 mock 之后）
import { TelegramAdapter } from '@/platform/adapters/telegram/adapter.js';
import { escapeHtml, splitMessage } from '@/platform/adapters/telegram/message-utils.js';

// 获取 mock 函数的引用
const mockRequest = vi.mocked(await import('undici')).request;

// 辅助函数：创建 mock 响应
function createMockResponse(data: unknown, ok = true) {
  return {
    body: {
      json: async () => data,
    },
    ok,
  };
}

describe('TelegramAdapter', () => {
  const defaultConfig = {
    botToken: 'test-bot-token',
    maxMessageLength: 4096,
    apiRetryAttempts: 3,
    apiRetryDelay: 10, // 短延迟用于测试
    pollingInterval: 100,
  };

  const createAdapter = (config = defaultConfig) => {
    return new TelegramAdapter(config);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // 默认 mock 响应
    mockRequest.mockResolvedValue(createMockResponse({ ok: true, result: [] }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create adapter with config', () => {
      const adapter = createAdapter();
      expect(adapter.platform).toBe('telegram');
    });
  });

  describe('isRunning', () => {
    it('should return false before start', () => {
      const adapter = createAdapter();
      expect(adapter.isRunning()).toBe(false);
    });
  });

  describe('start/stop', () => {
    it('should set running to true after start', async () => {
      const adapter = createAdapter();

      await adapter.start();
      expect(adapter.isRunning()).toBe(true);
    });

    it('should set running to false after stop', async () => {
      const adapter = createAdapter();
      await adapter.start();
      await adapter.stop();
      expect(adapter.isRunning()).toBe(false);
    });

    it('should clear cleanup timer on stop', async () => {
      const adapter = createAdapter();
      await adapter.start();

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      await adapter.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should not leak memory when stop is called multiple times', async () => {
      const adapter = createAdapter();

      for (let i = 0; i < 5; i++) {
        await adapter.start();
        await adapter.stop();
      }

      expect(adapter.isRunning()).toBe(false);
    });
  });

  describe('onMessage', () => {
    it('should register message handler', () => {
      const adapter = createAdapter();
      const handler = vi.fn();
      adapter.onMessage(handler);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Polling mode', () => {
    it('should poll for updates after start', async () => {
      const adapter = createAdapter();

      await adapter.start();

      // 推进时间触发 polling
      await vi.advanceTimersByTimeAsync(150);

      // request 应该被调用
      expect(mockRequest).toHaveBeenCalled();
    });

    it('should process messages from polling', async () => {
      const adapter = createAdapter({ ...defaultConfig, pollingInterval: 50 });
      const receivedMessages: IncomingMessage[] = [];
      adapter.onMessage((msg) => receivedMessages.push(msg));

      const update: TelegramUpdate = {
        update_id: 12345,
        message: {
          message_id: 100,
          from: {
            id: 111,
            is_bot: false,
            first_name: 'Test',
            username: 'testuser',
          },
          chat: {
            id: 222,
            type: 'private',
          },
          date: Math.floor(Date.now() / 1000),
          text: 'Hello, Bot!',
        },
      };

      mockRequest
        .mockResolvedValueOnce(createMockResponse({ ok: true, result: [update] }))
        .mockResolvedValue(createMockResponse({ ok: true, result: [] }));

      await adapter.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toMatchObject({
        id: '12345',
        platform: 'telegram',
        chatId: '222',
        userId: '111',
        senderType: 'user',
        text: 'Hello, Bot!',
      });
    });

    it('should filter bot messages in polling', async () => {
      const adapter = createAdapter({ ...defaultConfig, pollingInterval: 50 });
      const receivedMessages: IncomingMessage[] = [];
      adapter.onMessage((msg) => receivedMessages.push(msg));

      const update: TelegramUpdate = {
        update_id: 12346,
        message: {
          message_id: 101,
          from: {
            id: 333,
            is_bot: true,
            first_name: 'Bot',
            username: 'testbot',
          },
          chat: {
            id: 222,
            type: 'private',
          },
          date: Math.floor(Date.now() / 1000),
          text: 'Bot message',
        },
      };

      mockRequest
        .mockResolvedValueOnce(createMockResponse({ ok: true, result: [update] }))
        .mockResolvedValue(createMockResponse({ ok: true, result: [] }));

      await adapter.start();
      await vi.advanceTimersByTimeAsync(100);

      expect(receivedMessages).toHaveLength(0);
    });
  });

  describe('update_id deduplication', () => {
    it('should detect duplicate update_id', async () => {
      const adapter = createAdapter({ ...defaultConfig, pollingInterval: 50 });
      const receivedMessages: IncomingMessage[] = [];
      adapter.onMessage((msg) => receivedMessages.push(msg));

      const update: TelegramUpdate = {
        update_id: 99999,
        message: {
          message_id: 200,
          from: {
            id: 111,
            is_bot: false,
            first_name: 'Test',
          },
          chat: {
            id: 222,
            type: 'private',
          },
          date: Math.floor(Date.now() / 1000),
          text: 'First message',
        },
      };

      mockRequest
        .mockResolvedValueOnce(createMockResponse({ ok: true, result: [update] }))
        .mockResolvedValueOnce(createMockResponse({ ok: true, result: [] }))
        .mockResolvedValueOnce(createMockResponse({ ok: true, result: [update] })) // 重复的 update
        .mockResolvedValue(createMockResponse({ ok: true, result: [] }));

      await adapter.start();
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].text).toBe('First message');
    });

    it('should allow update_id after TTL expires', async () => {
      const adapter = createAdapter({ ...defaultConfig, deduplicationTTL: 1000, pollingInterval: 50 });
      const receivedMessages: IncomingMessage[] = [];
      adapter.onMessage((msg) => receivedMessages.push(msg));

      const update: TelegramUpdate = {
        update_id: 88888,
        message: {
          message_id: 201,
          from: {
            id: 111,
            is_bot: false,
            first_name: 'Test',
          },
          chat: {
            id: 222,
            type: 'private',
          },
          date: Math.floor(Date.now() / 1000),
          text: 'TTL test',
        },
      };

      mockRequest.mockResolvedValue(createMockResponse({ ok: true, result: [update] }));

      await adapter.start();
      await vi.advanceTimersByTimeAsync(100);
      expect(receivedMessages).toHaveLength(1);

      // Advance past TTL
      vi.advanceTimersByTime(1500);

      // Second call should process again
      await vi.advanceTimersByTimeAsync(100);
      expect(receivedMessages).toHaveLength(2);
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      // sendMessage 需要真实 timers（因为有 delay）
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should send message via Telegram API', async () => {
      const adapter = createAdapter();

      mockRequest.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          result: { message_id: 500 },
        })
      );

      const messageId = await adapter.sendMessage('123', 'Test message');

      expect(mockRequest).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test message'),
        })
      );
      expect(messageId).toBe('500');
    });

    it('should escape HTML in messages', async () => {
      const adapter = createAdapter();

      mockRequest.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          result: { message_id: 501 },
        })
      );

      await adapter.sendMessage('123', '<script>alert("xss")</script>');

      const callArgs = mockRequest.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toContain('&lt;script&gt;');
      expect(body.text).not.toContain('<script>');
    });

    it('should split long messages', async () => {
      const adapter = createAdapter();
      const longMessage = 'A'.repeat(5000);

      mockRequest.mockResolvedValue(
        createMockResponse({
          ok: true,
          result: { message_id: 502 },
        })
      );

      await adapter.sendMessage('123', longMessage);

      // Should be called twice for split messages
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendTypingIndicator', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should send chat action typing', async () => {
      const adapter = createAdapter();

      mockRequest.mockResolvedValueOnce(createMockResponse({ ok: true }));

      await adapter.sendTypingIndicator('123');

      expect(mockRequest).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendChatAction',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('typing'),
        })
      );
    });
  });
});

describe('escapeHtml', () => {
  it('should escape special HTML characters', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    expect(escapeHtml("'single'")).toBe('&#39;single&#39;');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should handle string without special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('should escape complex HTML', () => {
    const input = '<a href="test">Link & Text</a>';
    const expected = '&lt;a href=&quot;test&quot;&gt;Link &amp; Text&lt;/a&gt;';
    expect(escapeHtml(input)).toBe(expected);
  });
});

describe('splitMessage', () => {
  const defaultMaxLength = 4096;

  it('should not split message shorter than max length', () => {
    const text = 'Short message';
    const result = splitMessage(text, defaultMaxLength);
    expect(result).toEqual([text]);
  });

  it('should not split message equal to max length', () => {
    const text = 'A'.repeat(4096);
    const result = splitMessage(text, defaultMaxLength);
    expect(result).toEqual([text]);
  });

  it('should split message longer than max length', () => {
    const text = 'A'.repeat(5000);
    const result = splitMessage(text, defaultMaxLength);
    expect(result.length).toBe(2);
    expect(result[0].length).toBe(4096);
    expect(result[1].length).toBe(904);
  });

  it('should split at newline when possible', () => {
    const text = 'Line 1\n' + 'A'.repeat(4090) + '\nLine 3';
    const result = splitMessage(text, defaultMaxLength);
    expect(result.length).toBeGreaterThan(1);
    expect(result[0]).toContain('Line 1');
  });

  it('should handle multiple splits', () => {
    const text = 'A'.repeat(10000);
    const result = splitMessage(text, defaultMaxLength);
    expect(result.length).toBe(3);
    expect(result[0].length).toBe(4096);
    expect(result[1].length).toBe(4096);
    expect(result[2].length).toBe(1808);
  });
});

describe('callTelegramApi', () => {
  // callTelegramApi 使用 undici.request，已在文件顶部 mock

  beforeEach(() => {
    vi.useRealTimers();
    mockRequest.mockReset();
    // 设置默认 mock 返回空结果
    mockRequest.mockResolvedValue(createMockResponse({ ok: true, result: [] }));
  });

  afterEach(() => {
    vi.useFakeTimers();
  });

  it('should call undici request with correct parameters', async () => {
    mockRequest.mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        result: { message_id: 123 },
      })
    );

    const { callTelegramApi } = await import('@/platform/adapters/telegram/message-utils.js');

    const result = await callTelegramApi(
      'test-token',
      'sendMessage',
      { chat_id: '123', text: 'Hello' },
      { retryAttempts: 3, retryDelay: 10 }
    );

    expect(result).toEqual({ message_id: 123 });
    expect(mockRequest).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: '123', text: 'Hello' }),
      })
    );
  });

  it('should retry on 429 rate limit', async () => {
    const errorResponse = {
      statusCode: 429,
      headers: { get: () => '0' },
    };

    mockRequest
      .mockRejectedValueOnce(Object.assign(new Error('Rate limit'), errorResponse))
      .mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          result: { message_id: 124 },
        })
      );

    const { callTelegramApi } = await import('@/platform/adapters/telegram/message-utils.js');

    const result = await callTelegramApi(
      'test-token',
      'sendMessage',
      { chat_id: '123', text: 'Retry test' },
      { retryAttempts: 3, retryDelay: 10 }
    );

    expect(result).toEqual({ message_id: 124 });
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('should throw on API error response', async () => {
    mockRequest.mockResolvedValue(
      createMockResponse({
        ok: false,
        error_code: 400,
        description: 'Bad Request: chat not found',
      })
    );

    const { callTelegramApi } = await import('@/platform/adapters/telegram/message-utils.js');

    await expect(
      callTelegramApi(
        'test-token',
        'sendMessage',
        { chat_id: 'invalid', text: 'test' },
        { retryAttempts: 0, retryDelay: 10 }
      )
    ).rejects.toThrow('Bad Request: chat not found');
  });
});
