// TelegramAdapter Tests - TDD Approach

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelegramAdapter } from '@/platform/adapters/telegram/adapter.js';
import { escapeHtml, splitMessage, callTelegramApi } from '@/platform/adapters/telegram/message-utils.js';
import type { IncomingMessage } from '@/platform/types.js';
import type { TelegramUpdate, TelegramMessage } from '@/platform/adapters/telegram/types.js';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TelegramAdapter', () => {
  const defaultConfig = {
    botToken: 'test-bot-token',
    webhookSecret: 'test-webhook-secret',
    maxMessageLength: 4096,
    apiRetryAttempts: 3,
    apiRetryDelay: 100,
  };

  const createAdapter = (config = defaultConfig) => {
    return new TelegramAdapter(config);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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
  });

  describe('onMessage', () => {
    it('should register message handler', () => {
      const adapter = createAdapter();
      const handler = vi.fn();
      adapter.onMessage(handler);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('parseMessage', () => {
    it('should parse normal text message correctly', async () => {
      const adapter = createAdapter();
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

      await adapter.handleWebhook(update, defaultConfig.webhookSecret);

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

    it('should filter bot messages', async () => {
      const adapter = createAdapter();
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

      await adapter.handleWebhook(update, defaultConfig.webhookSecret);

      expect(receivedMessages).toHaveLength(0);
    });
  });

  describe('update_id deduplication', () => {
    it('should detect duplicate update_id', async () => {
      const adapter = createAdapter();
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

      // Send same update twice
      await adapter.handleWebhook(update, defaultConfig.webhookSecret);
      await adapter.handleWebhook(update, defaultConfig.webhookSecret);

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0].text).toBe('First message');
    });

    it('should allow update_id after TTL expires', async () => {
      const adapter = createAdapter({ ...defaultConfig, deduplicationTTL: 1000 }); // 1 second TTL
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

      // First call
      await adapter.handleWebhook(update, defaultConfig.webhookSecret);
      expect(receivedMessages).toHaveLength(1);

      // Advance past TTL
      vi.advanceTimersByTime(1500);

      // Second call should process again
      await adapter.handleWebhook(update, defaultConfig.webhookSecret);
      expect(receivedMessages).toHaveLength(2);
    });
  });

  describe('Webhook Secret validation', () => {
    it('should accept valid webhook secret', async () => {
      const adapter = createAdapter();
      const receivedMessages: IncomingMessage[] = [];
      adapter.onMessage((msg) => receivedMessages.push(msg));

      const update: TelegramUpdate = {
        update_id: 11111,
        message: {
          message_id: 300,
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
          text: 'Valid secret',
        },
      };

      await adapter.handleWebhook(update, defaultConfig.webhookSecret);
      expect(receivedMessages).toHaveLength(1);
    });

    it('should reject invalid webhook secret', async () => {
      const adapter = createAdapter();
      const receivedMessages: IncomingMessage[] = [];
      adapter.onMessage((msg) => receivedMessages.push(msg));

      const update: TelegramUpdate = {
        update_id: 11112,
        message: {
          message_id: 301,
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
          text: 'Invalid secret',
        },
      };

      await expect(
        adapter.handleWebhook(update, 'wrong-secret')
      ).rejects.toThrow('Invalid webhook secret');

      expect(receivedMessages).toHaveLength(0);
    });
  });

  describe('sendMessage', () => {
    it('should send message via Telegram API', async () => {
      const adapter = createAdapter();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 500 },
        }),
      });

      const messageId = await adapter.sendMessage('123', 'Test message');

      expect(mockFetch).toHaveBeenCalledWith(
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 501 },
        }),
      });

      await adapter.sendMessage('123', '<script>alert("xss")</script>');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.text).toContain('&lt;script&gt;');
      expect(body.text).not.toContain('<script>');
    });

    it('should split long messages', async () => {
      const adapter = createAdapter();
      const longMessage = 'A'.repeat(5000);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 502 },
        }),
      });

      await adapter.sendMessage('123', longMessage);

      // Should be called twice for split messages
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendTypingIndicator', () => {
    it('should send chat action typing', async () => {
      const adapter = createAdapter();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

      await adapter.sendTypingIndicator('123');

      expect(mockFetch).toHaveBeenCalledWith(
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
    // First part should end at newline
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
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    // No timer cleanup needed
  });

  it('should return result on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        result: { message_id: 123 },
      }),
    });

    const result = await callTelegramApi(
      'test-token',
      'sendMessage',
      { chat_id: '123', text: 'Hello' },
      { retryAttempts: 3, retryDelay: 10 }
    );

    expect(result).toEqual({ message_id: 123 });
  });

  it('should retry on 429 rate limit', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '0' }),
        text: async () => 'Too Many Requests',
        json: async () => ({ ok: false, error_code: 429, description: 'Too Many Requests' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 124 },
        }),
      });

    const result = await callTelegramApi(
      'test-token',
      'sendMessage',
      { chat_id: '123', text: 'Retry test' },
      { retryAttempts: 3, retryDelay: 10 }
    );

    expect(result).toEqual({ message_id: 124 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should retry on 5xx error with exponential backoff', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
        json: async () => ({ ok: false, error_code: 500, description: 'Internal Server Error' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 125 },
        }),
      });

    const result = await callTelegramApi(
      'test-token',
      'sendMessage',
      { chat_id: '123', text: '5xx retry' },
      { retryAttempts: 3, retryDelay: 10 }
    );

    expect(result).toEqual({ message_id: 125 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retry attempts', async () => {
    for (let i = 0; i < 4; i++) {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
        json: async () => ({ ok: false, error_code: 500, description: 'Internal Server Error' }),
      });
    }

    await expect(
      callTelegramApi(
        'test-token',
        'sendMessage',
        { chat_id: '123', text: 'Max retries' },
        { retryAttempts: 2, retryDelay: 10 }
      )
    ).rejects.toThrow();

    expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should throw on API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: false,
        error_code: 400,
        description: 'Bad Request: chat not found',
      }),
    });

    await expect(
      callTelegramApi(
        'test-token',
        'sendMessage',
        { chat_id: 'invalid', text: 'test' },
        { retryAttempts: 1, retryDelay: 10 }
      )
    ).rejects.toThrow('Bad Request: chat not found');
  });
});
