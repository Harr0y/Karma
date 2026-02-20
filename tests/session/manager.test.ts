// Session Manager Tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '@/session/manager';
import { StorageService } from '@/storage/service';

describe('SessionManager', () => {
  let storage: StorageService;
  let manager: SessionManager;

  beforeEach(() => {
    storage = new StorageService(':memory:');
    manager = new SessionManager(storage);
  });

  afterEach(() => {
    storage.close();
  });

  describe('getOrCreateSession', () => {
    it('should create new session for new platform/chat', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });

      expect(session.id).toBeDefined();
      expect(session.platform).toBe('cli');
      expect(session.startedAt).toBeInstanceOf(Date);
    });

    it('should create session with externalChatId for Feishu', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_abc123',
      });

      expect(session.externalChatId).toBe('oc_abc123');
    });

    it('should return cached session on second call', async () => {
      const session1 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_xyz789',
      });

      const session2 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_xyz789',
      });

      expect(session1.id).toBe(session2.id);
    });

    it('should restore Feishu session from database', async () => {
      // 1. 创建会话
      const session1 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_restore_test',
      });
      await manager.saveSession(session1);

      // 2. 清除缓存
      manager.clearCache();

      // 3. 恢复
      const session2 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_restore_test',
      });

      expect(session2.id).toBe(session1.id);
    });

    it('should create different sessions for different platforms', async () => {
      const cliSession = await manager.getOrCreateSession({ platform: 'cli' });
      const feishuSession = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_diff',
      });

      expect(cliSession.id).not.toBe(feishuSession.id);
    });

    it('should create different sessions for different chatIds', async () => {
      const session1 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_chat1',
      });
      const session2 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_chat2',
      });

      expect(session1.id).not.toBe(session2.id);
    });

    it('should create new session if previous was ended', async () => {
      // 1. 创建会话
      const session1 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_ended',
      });
      await manager.endSession(session1.id);

      // 2. 再次获取应该创建新会话
      const session2 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_ended',
      });

      expect(session2.id).not.toBe(session1.id);
    });
  });

  describe('updateSdkSessionId', () => {
    it('should update SDK session ID', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_sdk_test',
      });

      await manager.updateSdkSessionId(session.id, 'sdk_abc123');

      const cached = manager.getSessionFromCache('feishu:oc_sdk_test');
      expect(cached?.sdkSessionId).toBe('sdk_abc123');
    });

    it('should persist SDK session ID to database', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });
      await manager.updateSdkSessionId(session.id, 'sdk_xyz789');

      const dbSession = await storage.getSession(session.id);
      expect(dbSession?.sdkSessionId).toBe('sdk_xyz789');
    });

    it('should update SDK session ID for Feishu session', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_sdk_test2',
      });

      await manager.updateSdkSessionId(session.id, 'sdk_feishu_001');

      const cached = manager.getSessionFromCache('feishu:oc_sdk_test2');
      expect(cached?.sdkSessionId).toBe('sdk_feishu_001');
    });
  });

  describe('linkClient', () => {
    it('should link client to session', async () => {
      const clientId = await storage.createClient({
        name: '测试客户',
      });

      const session = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_link_test',
      });

      await manager.linkClient(session.id, clientId);

      const cached = manager.getSessionFromCache('feishu:oc_link_test');
      expect(cached?.clientId).toBe(clientId);
    });
  });

  describe('updateSessionClient', () => {
    it('should update client and persist to database', async () => {
      // 测试 P1 问题修复：clientId 持久化
      const clientId = await storage.createClient({ name: '测试客户' });
      const session = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_update_test',
      });

      await manager.updateSessionClient(session.id, clientId);

      // 验证缓存更新
      const cached = manager.getSessionFromCache('feishu:oc_update_test');
      expect(cached?.clientId).toBe(clientId);

      // 验证数据库持久化
      const dbSession = await storage.getSession(session.id);
      expect(dbSession?.clientId).toBe(clientId);
    });
  });

  describe('HTTP 无状态会话', () => {
    it('should restore session by sessionId for HTTP platform', async () => {
      // 创建一个 HTTP 会话
      const session1 = await manager.getOrCreateSession({
        platform: 'http',
        externalChatId: 'http-test-1',
      });

      // 清除缓存
      manager.clearCache();

      // 通过 sessionId 恢复
      const session2 = await manager.getOrCreateSession({
        platform: 'http',
        sessionId: session1.id,
      });

      expect(session2.id).toBe(session1.id);
    });

    it('should throw error if sessionId not found', async () => {
      await expect(
        manager.getOrCreateSession({
          platform: 'http',
          sessionId: 'non-existent-session',
        })
      ).rejects.toThrow('Session not found');
    });

    it('should cache restored session', async () => {
      const session1 = await manager.getOrCreateSession({
        platform: 'http',
        externalChatId: 'http-cache-test',
      });

      manager.clearCache();

      // 恢复后应该被缓存
      const session2 = await manager.getOrCreateSession({
        platform: 'http',
        sessionId: session1.id,
      });

      // 再次获取应该从缓存获取
      const session3 = await manager.getOrCreateSession({
        platform: 'http',
        sessionId: session1.id,
      });

      expect(session2.id).toBe(session1.id);
      expect(session3.id).toBe(session1.id);
    });
  });

  describe('endSession', () => {
    it('should end session with summary', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });

      await manager.endSession(session.id, '完成了算命');

      const dbSession = await storage.getSession(session.id);
      expect(dbSession?.status).toBe('completed');
      expect(dbSession?.summary).toBe('完成了算命');
      expect(dbSession?.endedAt).toBeDefined();
    });

    it('should remove session from cache', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });

      await manager.endSession(session.id);

      const cached = manager.getSessionFromCache('cli');
      expect(cached).toBeUndefined();
    });

    it('should end session without summary', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_end_no_summary',
      });

      await manager.endSession(session.id);

      const dbSession = await storage.getSession(session.id);
      expect(dbSession?.status).toBe('completed');
      // summary 可能是 null 或 undefined
      expect(dbSession?.summary ?? null).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached sessions', async () => {
      await manager.getOrCreateSession({ platform: 'cli' });
      await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_clear',
      });

      manager.clearCache();

      expect(manager.getSessionFromCache('cli')).toBeUndefined();
      expect(manager.getSessionFromCache('feishu:oc_clear')).toBeUndefined();
    });
  });

  describe('getSessionFromCache', () => {
    it('should return undefined for non-existent cache key', () => {
      const cached = manager.getSessionFromCache('nonexistent');
      expect(cached).toBeUndefined();
    });

    it('should return session for existing cache key', async () => {
      await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_cache_test',
      });

      const cached = manager.getSessionFromCache('feishu:oc_cache_test');
      expect(cached).toBeDefined();
      expect(cached?.platform).toBe('feishu');
    });
  });

  describe('concurrency', () => {
    it('should handle concurrent getOrCreateSession calls', async () => {
      // 同时调用多次
      const promises = Array(5).fill(null).map(() =>
        manager.getOrCreateSession({
          platform: 'feishu',
          externalChatId: 'oc_concurrent',
        })
      );

      const sessions = await Promise.all(promises);

      // 所有调用应该返回同一个会话
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1);
    });

    it('should handle concurrent calls for different chats', async () => {
      const promises = Array(5).fill(null).map((_, i) =>
        manager.getOrCreateSession({
          platform: 'feishu',
          externalChatId: `oc_concurrent_${i}`,
        })
      );

      const sessions = await Promise.all(promises);

      // 每个调用应该返回不同的会话
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });
  });

  describe('saveSession', () => {
    it('should save SDK session ID to database', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });
      session.sdkSessionId = 'sdk_save_test';

      await manager.saveSession(session);

      const dbSession = await storage.getSession(session.id);
      expect(dbSession?.sdkSessionId).toBe('sdk_save_test');
    });
  });
});
