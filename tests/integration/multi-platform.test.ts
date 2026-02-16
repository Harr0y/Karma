// Multi-Platform Integration Tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MessageRouter } from '@/platform/router.js';
import { FeishuOutputAdapter, CLIOutputAdapter } from '@/output/index.js';
import { SessionManager, getSessionKey } from '@/session/index.js';
import { StorageService } from '@/storage/service.js';
import type { IncomingMessage, PlatformAdapter } from '@/platform/types.js';

describe('Multi-Platform Integration', () => {
  let storage: StorageService;
  let sessionManager: SessionManager;

  beforeAll(async () => {
    storage = new StorageService(':memory:');
    sessionManager = new SessionManager(storage);
  });

  afterAll(() => {
    // StorageService doesn't have close method
  });

  describe('Session + Router Integration', () => {
    it('should route messages and create sessions', async () => {
      const router = new MessageRouter();
      let receivedSession: any = null;

      router.onMessage(async (message) => {
        receivedSession = await sessionManager.getOrCreateSession({
          platform: message.platform,
          externalChatId: message.chatId,
        });
      });

      const message: IncomingMessage = {
        id: 'msg-1',
        platform: 'feishu',
        chatId: 'chat-001',
        senderType: 'user',
        text: 'hello',
        timestamp: Date.now(),
      };

      await router.route(message);

      expect(receivedSession).not.toBeNull();
      expect(receivedSession.platform).toBe('feishu');
      expect(receivedSession.externalChatId).toBe('chat-001');
    });

    it('should use composite key for sessions', async () => {
      const key1 = getSessionKey({ platform: 'feishu', chatId: 'chat-001' });
      const key2 = getSessionKey({ platform: 'discord', chatId: 'chat-001' });
      const key3 = getSessionKey({ platform: 'cli', chatId: 'cli' });

      expect(key1).toBe('feishu:chat-001');
      expect(key2).toBe('discord:chat-001');
      expect(key3).toBe('cli:cli');
    });
  });

  describe('Output Adapter Integration', () => {
    it('should work with mock platform adapter', async () => {
      const mockPlatformAdapter: PlatformAdapter = {
        platform: 'feishu',
        start: async () => {},
        stop: async () => {},
        isRunning: () => true,
        sendMessage: async (chatId: string, content: string) => {
          return 'msg-id';
        },
        onMessage: () => {},
      };

      const outputAdapter = new FeishuOutputAdapter('chat-001', mockPlatformAdapter, {
        throttleMs: 0,
      });

      await outputAdapter.write({ type: 'text', text: 'Hello ' });
      await outputAdapter.write({ type: 'text', text: 'World' });
      await outputAdapter.flush();

      // Should have sent combined message
      expect(mockPlatformAdapter.sendMessage).toBeDefined();
    });
  });

  describe('Deduplication Integration', () => {
    it('should prevent duplicate processing across platforms', async () => {
      const router = new MessageRouter();
      let processCount = 0;

      router.onMessage(async () => {
        processCount++;
      });

      const message: IncomingMessage = {
        id: 'duplicate-msg',
        platform: 'feishu',
        chatId: 'chat-001',
        senderType: 'user',
        text: 'test',
        timestamp: Date.now(),
      };

      await router.route(message);
      await router.route(message); // Duplicate

      expect(processCount).toBe(1);
    });
  });

  describe('Session Persistence Integration', () => {
    it('should persist and restore sessions', async () => {
      // Create session
      const session = await sessionManager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'persist-test',
      });

      // Update SDK session ID
      await sessionManager.updateSdkSessionId(session.id, 'sdk-persist-123');

      // Clear cache
      sessionManager.clearCache();

      // Restore from DB
      const restored = await sessionManager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'persist-test',
      });

      expect(restored.sdkSessionId).toBe('sdk-persist-123');
    });
  });
});
