// MessageRouter Tests

import { describe, it, expect, vi } from 'vitest';
import { MessageRouter } from '@/platform/router.js';
import type { IncomingMessage } from '@/platform/types.js';

describe('MessageRouter', () => {
  const createMessage = (overrides: Partial<IncomingMessage> = {}): IncomingMessage => ({
    id: 'msg-1',
    platform: 'cli',
    chatId: 'chat-1',
    senderType: 'user',
    text: 'test',
    timestamp: Date.now(),
    ...overrides,
  });

  describe('route', () => {
    it('should process valid messages', async () => {
      const router = new MessageRouter();
      const handler = vi.fn();
      router.onMessage(handler);

      const message = createMessage();
      await router.route(message);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should skip duplicate messages', async () => {
      const router = new MessageRouter();
      const handler = vi.fn();
      router.onMessage(handler);

      const message = createMessage({ id: 'msg-duplicate' });
      await router.route(message);
      await router.route(message);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should skip expired messages', async () => {
      const router = new MessageRouter({ maxMessageAge: 1000 });
      const handler = vi.fn();
      router.onMessage(handler);

      const message = createMessage({
        id: 'msg-expired',
        timestamp: Date.now() - 2000,
      });
      await router.route(message);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should skip bot messages', async () => {
      const router = new MessageRouter();
      const handler = vi.fn();
      router.onMessage(handler);

      const message = createMessage({
        id: 'msg-bot',
        senderType: 'bot',
      });
      await router.route(message);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should process multiple handlers', async () => {
      const router = new MessageRouter();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      router.onMessage(handler1);
      router.onMessage(handler2);

      const message = createMessage({ id: 'msg-multi' });
      await router.route(message);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should continue after handler error', async () => {
      const router = new MessageRouter();
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = vi.fn();
      router.onMessage(errorHandler);
      router.onMessage(successHandler);

      const message = createMessage({ id: 'msg-error' });
      await router.route(message);

      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('onMessage / offMessage', () => {
    it('should remove handler', async () => {
      const router = new MessageRouter();
      const handler = vi.fn();
      router.onMessage(handler);
      router.offMessage(handler);

      const message = createMessage({ id: 'msg-remove' });
      await router.route(message);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('clearHandlers', () => {
    it('should clear all handlers', async () => {
      const router = new MessageRouter();
      router.onMessage(vi.fn());
      router.onMessage(vi.fn());
      router.clearHandlers();

      expect(router.getStats().handlerCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return stats', () => {
      const router = new MessageRouter();
      router.onMessage(vi.fn());

      const stats = router.getStats();
      expect(stats.handlerCount).toBe(1);
      expect(stats.processedCount).toBe(0);
    });
  });
});
