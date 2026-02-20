// HTTP Adapter Tests
import { describe, it, expect, beforeEach } from 'vitest';
import { HttpAdapter } from '@/platform/adapters/http/adapter';

describe('HttpAdapter', () => {
  let adapter: HttpAdapter;

  beforeEach(() => {
    adapter = new HttpAdapter();
  });

  describe('基本属性', () => {
    it('should have platform type http', () => {
      expect(adapter.platform).toBe('http');
    });

    it('should always be running', async () => {
      expect(adapter.isRunning()).toBe(true);
      await adapter.start();
      expect(adapter.isRunning()).toBe(true);
    });

    it('should support stop without error', async () => {
      await expect(adapter.stop()).resolves.not.toThrow();
      expect(adapter.isRunning()).toBe(true);
    });
  });

  describe('handleRequest', () => {
    it('should generate IncomingMessage with correct structure', async () => {
      const msg = await adapter.handleRequest(
        'session-123',
        'user-456',
        '你好'
      );

      expect(msg.id).toMatch(/^http_msg_/);
      expect(msg.platform).toBe('http');
      expect(msg.chatId).toBe('session-123');
      expect(msg.userId).toBe('user-456');
      expect(msg.senderType).toBe('user');
      expect(msg.text).toBe('你好');
      expect(msg.timestamp).toBeGreaterThan(0);
    });

    it('should generate unique message IDs', async () => {
      const msg1 = await adapter.handleRequest('s1', 'u1', 'test1');
      const msg2 = await adapter.handleRequest('s1', 'u1', 'test2');

      expect(msg1.id).not.toBe(msg2.id);
    });
  });

  describe('onMessage', () => {
    it('should trigger handlers when handleRequest is called', async () => {
      const received: any[] = [];

      adapter.onMessage(async (msg) => {
        received.push(msg);
      });

      await adapter.handleRequest('session-1', 'user-1', '测试消息');

      expect(received).toHaveLength(1);
      expect(received[0].text).toBe('测试消息');
    });

    it('should support multiple handlers', async () => {
      const results: string[] = [];

      adapter.onMessage(async (msg) => {
        results.push(`handler1:${msg.text}`);
      });
      adapter.onMessage(async (msg) => {
        results.push(`handler2:${msg.text}`);
      });

      await adapter.handleRequest('session-1', 'user-1', 'hello');

      expect(results).toContain('handler1:hello');
      expect(results).toContain('handler2:hello');
    });
  });

  describe('onResponse / clearResponseCallback', () => {
    it('should register response callback', () => {
      adapter.onResponse('session-1', () => {});
      expect(adapter.hasResponseCallback('session-1')).toBe(true);
    });

    it('should clear response callback', () => {
      adapter.onResponse('session-1', () => {});
      adapter.clearResponseCallback('session-1');
      expect(adapter.hasResponseCallback('session-1')).toBe(false);
    });

    it('should trigger callback on sendMessage', async () => {
      const received: { type: string; content: string }[] = [];

      adapter.onResponse('session-1', (type, content) => {
        received.push({ type, content });
      });

      await adapter.sendMessage('session-1', 'Hello World');

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('text');
      expect(received[0].content).toBe('Hello World');
    });

    it('should not throw if no callback registered', async () => {
      await expect(adapter.sendMessage('no-callback', 'test')).resolves.toBe('test');
    });
  });

  describe('sendToolUse / sendDone / sendError', () => {
    it('should send tool_use notification', async () => {
      const received: { type: string; content: string }[] = [];

      adapter.onResponse('session-1', (type, content) => {
        received.push({ type, content });
      });

      await adapter.sendToolUse('session-1', 'Bash');

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('tool_use');
      expect(received[0].content).toBe('Bash');
    });

    it('should send done signal', async () => {
      const received: { type: string }[] = [];

      adapter.onResponse('session-1', (type) => {
        received.push({ type });
      });

      await adapter.sendDone('session-1');

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('done');
    });

    it('should send error', async () => {
      const received: { type: string; content: string }[] = [];

      adapter.onResponse('session-1', (type, content) => {
        received.push({ type, content });
      });

      await adapter.sendError('session-1', 'Something went wrong');

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('error');
      expect(received[0].content).toBe('Something went wrong');
    });
  });
});
