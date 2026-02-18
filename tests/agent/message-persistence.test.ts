// 消息持久化测试
// 测试目标：确保对话消息正确写入 messages 表

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageService } from '@/storage/service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

describe('Message Persistence', () => {
  let storage: StorageService;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'karma-test-'));
    dbPath = join(tempDir, 'test.db');
    storage = new StorageService(dbPath);
  });

  afterEach(() => {
    storage.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('addMessage', () => {
    it('should save user message to messages table', async () => {
      // Given: 一个新会话
      const sessionId = await storage.createSession({
        platform: 'cli',
      });

      // When: 保存用户消息
      await storage.addMessage(sessionId, 'user', '你好，我想算命');

      // Then: messages 表有一条记录
      const messages = await storage.getSessionMessages(sessionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('你好，我想算命');
    });

    it('should save assistant message to messages table', async () => {
      // Given: 一个新会话
      const sessionId = await storage.createSession({
        platform: 'cli',
      });

      // When: 保存助手消息
      await storage.addMessage(
        sessionId,
        'assistant',
        '你好，请把生辰时间发给我'
      );

      // Then: messages 表有一条记录
      const messages = await storage.getSessionMessages(sessionId);
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toBe('你好，请把生辰时间发给我');
    });

    it('should accumulate multi-turn messages', async () => {
      // Given: 一个新会话
      const sessionId = await storage.createSession({
        platform: 'cli',
      });

      // When: 进行两轮对话（加延迟确保时间戳不同）
      await storage.addMessage(sessionId, 'user', '第一轮用户消息');
      await new Promise((r) => setTimeout(r, 10));
      await storage.addMessage(sessionId, 'assistant', '第一轮助手回复');
      await new Promise((r) => setTimeout(r, 10));
      await storage.addMessage(sessionId, 'user', '第二轮用户消息');
      await new Promise((r) => setTimeout(r, 10));
      await storage.addMessage(sessionId, 'assistant', '第二轮助手回复');

      // Then: messages 表有 4 条记录
      const messages = await storage.getSessionMessages(sessionId);
      expect(messages).toHaveLength(4);

      // 验证顺序（最新的在前，按时间倒序）
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toBe('第二轮助手回复');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toBe('第二轮用户消息');
      expect(messages[2].role).toBe('assistant');
      expect(messages[2].content).toBe('第一轮助手回复');
      expect(messages[3].role).toBe('user');
      expect(messages[3].content).toBe('第一轮用户消息');
    });

    it('should store raw content separately', async () => {
      // Given: 一个新会话
      const sessionId = await storage.createSession({
        platform: 'cli',
      });

      // When: 保存带原始内容的消息
      const content = '你好';
      const rawContent = JSON.stringify({ text: '你好', metadata: {} });
      await storage.addMessage(sessionId, 'user', content, rawContent);

      // Then: 原始内容被保存
      const messages = await storage.getSessionMessages(sessionId);
      expect(messages[0].content).toBe(content);
      expect(messages[0].rawContent).toBe(rawContent);
    });

    it('should only return messages for the specified session', async () => {
      // Given: 两个不同会话
      const session1 = await storage.createSession({ platform: 'cli' });
      const session2 = await storage.createSession({ platform: 'cli' });

      // When: 分别保存消息
      await storage.addMessage(session1, 'user', '会话1的消息');
      await storage.addMessage(session2, 'user', '会话2的消息');

      // Then: 各自只能看到自己的消息
      const messages1 = await storage.getSessionMessages(session1);
      const messages2 = await storage.getSessionMessages(session2);

      expect(messages1).toHaveLength(1);
      expect(messages1[0].content).toBe('会话1的消息');

      expect(messages2).toHaveLength(1);
      expect(messages2[0].content).toBe('会话2的消息');
    });

    it('should limit message count', async () => {
      // Given: 一个有 20 条消息的会话
      const sessionId = await storage.createSession({ platform: 'cli' });
      for (let i = 0; i < 20; i++) {
        await storage.addMessage(sessionId, 'user', `消息 ${i}`);
      }

      // When: 限制返回 10 条
      const messages = await storage.getSessionMessages(sessionId, 10);

      // Then: 只返回 10 条（最新的）
      expect(messages).toHaveLength(10);
    });
  });

  describe('Message timestamps', () => {
    it('should record message creation time', async () => {
      // Given: 一个新会话
      const sessionId = await storage.createSession({ platform: 'cli' });
      const beforeTime = new Date().toISOString();

      // When: 保存消息
      await storage.addMessage(sessionId, 'user', '测试时间');

      // Then: 有创建时间
      const messages = await storage.getSessionMessages(sessionId);
      const afterTime = new Date().toISOString();

      expect(messages[0].createdAt).toBeDefined();
      expect(messages[0].createdAt >= beforeTime).toBe(true);
      expect(messages[0].createdAt <= afterTime).toBe(true);
    });
  });
});
