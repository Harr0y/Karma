// Integration Tests - HTTP API 集成测试
// 测试 HTTP API 与 SessionManager、Storage、AgentRunner 的集成

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { StorageService } from '@/storage/service';
import { SessionManager } from '@/session/manager';
import { HttpAdapter } from '@/platform/adapters/http/adapter';
import { PLATFORM_CONFIGS, isStatelessPlatform, isPersistentPlatform } from '@/types/platform';

describe('Integration: HTTP API + Platform Adapter', () => {
  let storage: StorageService;
  let sessionManager: SessionManager;
  let httpAdapter: HttpAdapter;

  beforeAll(async () => {
    storage = new StorageService(':memory:');
    sessionManager = new SessionManager(storage);
    httpAdapter = new HttpAdapter();
  });

  afterAll(() => {
    storage.close();
  });

  beforeEach(() => {
    sessionManager.clearCache();
  });

  describe('平台配置', () => {
    it('should identify HTTP as stateless platform', () => {
      expect(isStatelessPlatform('http')).toBe(true);
      expect(isPersistentPlatform('http')).toBe(false);
    });

    it('should identify Feishu as persistent platform', () => {
      expect(isPersistentPlatform('feishu')).toBe(true);
      expect(isStatelessPlatform('feishu')).toBe(false);
    });

    it('should have correct HTTP platform config', () => {
      const config = PLATFORM_CONFIGS.http;
      expect(config.connectionMode).toBe('stateless');
      expect(config.features.streaming).toBe(true);
      expect(config.features.richContent).toBe(false);
    });
  });

  describe('HTTP 会话创建和恢复', () => {
    it('should create HTTP session and restore by sessionId', async () => {
      // 1. 创建会话（模拟 POST /api/session）
      const session = await sessionManager.getOrCreateSession({
        platform: 'http',
        externalChatId: 'user-123',
      });

      expect(session.id).toBeDefined();
      expect(session.platform).toBe('http');
      expect(session.externalChatId).toBe('user-123');

      // 2. 清除缓存（模拟新的请求）
      sessionManager.clearCache();

      // 3. 通过 sessionId 恢复会话（模拟 POST /api/chat）
      const restored = await sessionManager.getOrCreateSession({
        platform: 'http',
        sessionId: session.id,
      });

      expect(restored.id).toBe(session.id);
      expect(restored.externalChatId).toBe('user-123');
    });

    it('should persist clientId across HTTP requests', async () => {
      // 测试 P1 问题修复：clientId 持久化

      // 1. 创建会话
      const session = await sessionManager.getOrCreateSession({
        platform: 'http',
        externalChatId: 'user-456',
      });

      // 2. 创建客户并关联
      const clientId = await storage.createClient({
        name: '测试用户',
        gender: 'male',
        birthDate: '1990-05-15',
        birthPlace: '上海',
      });

      await sessionManager.updateSessionClient(session.id, clientId);

      // 3. 清除缓存
      sessionManager.clearCache();

      // 4. 恢复会话，clientId 应该还在
      const restored = await sessionManager.getOrCreateSession({
        platform: 'http',
        sessionId: session.id,
      });

      expect(restored.clientId).toBe(clientId);

      // 5. 验证客户信息可以加载
      const client = await storage.getClient(restored.clientId!);
      expect(client?.name).toBe('测试用户');
    });

    it('should throw error for non-existent sessionId', async () => {
      await expect(
        sessionManager.getOrCreateSession({
          platform: 'http',
          sessionId: 'non-existent-session-id',
        })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('HTTP 适配器与消息处理', () => {
    it('should handle request and generate IncomingMessage', async () => {
      const msg = await httpAdapter.handleRequest(
        'session-abc',
        'user-xyz',
        '你好，帮我算算命'
      );

      expect(msg.platform).toBe('http');
      expect(msg.chatId).toBe('session-abc');
      expect(msg.userId).toBe('user-xyz');
      expect(msg.text).toBe('你好，帮我算算命');
      expect(msg.senderType).toBe('user');
    });

    it('should support response callback for SSE', async () => {
      const responses: { type: string; content: string }[] = [];

      httpAdapter.onResponse('session-123', (type, content) => {
        responses.push({ type, content });
      });

      await httpAdapter.sendMessage('session-123', '你好');
      await httpAdapter.sendToolUse('session-123', 'Bash');
      await httpAdapter.sendDone('session-123');

      expect(responses).toHaveLength(3);
      expect(responses[0]).toEqual({ type: 'text', content: '你好' });
      expect(responses[1]).toEqual({ type: 'tool_use', content: 'Bash' });
      expect(responses[2]).toEqual({ type: 'done', content: '' });
    });

    it('should register message handler', async () => {
      let received = false;

      httpAdapter.onMessage(async (msg) => {
        received = true;
        expect(msg.text).toBe('test message');
      });

      await httpAdapter.handleRequest('s1', 'u1', 'test message');

      expect(received).toBe(true);
    });
  });

  describe('多平台会话隔离', () => {
    it('should isolate HTTP sessions from Feishu sessions', async () => {
      // 创建 HTTP 会话
      const httpSession = await sessionManager.getOrCreateSession({
        platform: 'http',
        externalChatId: 'http-user-1',
      });

      // 创建飞书会话
      const feishuSession = await sessionManager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_feishu_chat',
      });

      // 应该是不同的会话
      expect(httpSession.id).not.toBe(feishuSession.id);

      // 各自恢复
      sessionManager.clearCache();

      const restoredHttp = await sessionManager.getOrCreateSession({
        platform: 'http',
        sessionId: httpSession.id,
      });

      const restoredFeishu = await sessionManager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_feishu_chat',
      });

      expect(restoredHttp.id).toBe(httpSession.id);
      expect(restoredFeishu.id).toBe(feishuSession.id);
    });

    it('should handle same externalChatId on different platforms', async () => {
      // 同一个 ID 在不同平台
      const sameId = 'test-id-123';

      const httpSession = await sessionManager.getOrCreateSession({
        platform: 'http',
        externalChatId: sameId,
      });

      const feishuSession = await sessionManager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: sameId,
      });

      // 应该是不同的会话
      expect(httpSession.id).not.toBe(feishuSession.id);
      expect(httpSession.platform).toBe('http');
      expect(feishuSession.platform).toBe('feishu');
    });
  });

  describe('客户信息完整流程', () => {
    it('should handle complete client info flow via HTTP', async () => {
      // 模拟完整的 HTTP API 流程

      // 1. 创建会话
      const session = await sessionManager.getOrCreateSession({
        platform: 'http',
        externalChatId: 'complete-flow-user',
      });

      // 2. 模拟用户消息（发送生辰信息）
      const msg = await httpAdapter.handleRequest(
        session.id,
        'complete-flow-user',
        '我是1998年5月15日下午两点半出生的，长沙人，男，叫小明'
      );

      expect(msg.text).toContain('1998年5月15日');

      // 3. 模拟 AgentRunner 创建客户
      const clientId = await storage.createClient({
        name: '小明',
        gender: 'male',
        birthDate: '1998-05-15 14:30',
        birthPlace: '长沙',
      });

      // 4. 关联客户到会话
      await sessionManager.updateSessionClient(session.id, clientId);

      // 5. 模拟新请求恢复会话
      sessionManager.clearCache();

      const restoredSession = await sessionManager.getOrCreateSession({
        platform: 'http',
        sessionId: session.id,
      });

      // 6. 验证客户信息可加载
      expect(restoredSession.clientId).toBe(clientId);

      const profile = await storage.generateClientProfilePrompt(clientId);
      expect(profile).toContain('小明');
      expect(profile).toContain('男');
      expect(profile).toContain('1998-05-15 14:30');
      expect(profile).toContain('长沙');
    });

    it('should update client info without overwriting existing fields', async () => {
      // 测试 P2 问题修复：updateClient 不覆盖 undefined

      // 1. 创建客户
      const clientId = await storage.createClient({
        name: '张三',
        gender: 'male',
        birthDate: '1990-05-15',
        birthPlace: '上海',
      });

      // 2. 只更新名字（其他字段不传入）
      await storage.updateClient(clientId, {
        name: '李四',
        // gender, birthDate, birthPlace 是 undefined
      });

      // 3. 验证其他字段没有被覆盖
      const client = await storage.getClient(clientId);

      expect(client?.name).toBe('李四');
      expect(client?.gender).toBe('male');      // 应该保持不变
      expect(client?.birthDate).toBe('1990-05-15');  // 应该保持不变
      expect(client?.birthPlace).toBe('上海');   // 应该保持不变
    });
  });

  describe('消息持久化', () => {
    it('should persist messages for HTTP session', async () => {
      const session = await sessionManager.getOrCreateSession({
        platform: 'http',
        externalChatId: 'msg-persistence-test',
      });

      // 添加消息
      await storage.addMessage(session.id, 'user', '你好');
      await storage.addMessage(session.id, 'assistant', '你好，请把生辰发给我');

      // 查询消息
      const messages = await storage.getSessionMessages(session.id);
      expect(messages).toHaveLength(2);

      // 验证消息都存在（顺序可能因时间戳相同而不确定）
      const roles = messages.map(m => m.role);
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');
    });
  });

  describe('SDK Session 持久化', () => {
    it('should persist SDK session ID across HTTP requests', async () => {
      // 1. 创建会话
      const session = await sessionManager.getOrCreateSession({
        platform: 'http',
        externalChatId: 'sdk-persistence-test',
      });

      // 2. 设置 SDK session ID
      await sessionManager.updateSdkSessionId(session.id, 'sdk-session-123');

      // 3. 清除缓存
      sessionManager.clearCache();

      // 4. 恢复会话
      const restored = await sessionManager.getOrCreateSession({
        platform: 'http',
        sessionId: session.id,
      });

      // 5. 验证 SDK session ID 也在
      expect(restored.sdkSessionId).toBe('sdk-session-123');
    });
  });
});

describe('Integration: Platform Types Consistency', () => {
  it('should have consistent Platform type across all modules', async () => {
    // 验证所有模块使用相同的 Platform 类型
    const { Platform: platformTypes } = await import('@/platform/types');
    const { Platform: sessionTypes } = await import('@/session/types');

    // 类型应该是一致的
    const platforms: platformTypes.Platform[] = ['cli', 'http', 'feishu', 'discord', 'telegram'];

    // 验证配置存在
    for (const p of platforms) {
      expect(PLATFORM_CONFIGS[p]).toBeDefined();
      expect(PLATFORM_CONFIGS[p].type).toBe(p);
    }
  });
});
