// 客户档案创建测试
// 测试目标：确保从对话中提取的客户信息正确写入 clients 表

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageService } from '@/storage/service.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

describe('Client Creation', () => {
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

  describe('createClient', () => {
    it('should create client with basic info', async () => {
      // Given: 客户基本信息
      const clientId = await storage.createClient({
        name: '张三',
        gender: 'male',
        birthDate: '1990-05-15T06:00:00',
        birthPlace: '北京',
      });

      // Then: 客户被创建
      expect(clientId).toBeDefined();
      expect(clientId.startsWith('client_')).toBe(true);

      const client = await storage.getClient(clientId);
      expect(client).not.toBeNull();
      expect(client!.name).toBe('张三');
      expect(client!.gender).toBe('male');
      expect(client!.birthDate).toBe('1990-05-15T06:00:00');
      expect(client!.birthPlace).toBe('北京');
    });

    it('should set firstSeenAt and lastSeenAt on creation', async () => {
      // Given: 创建新客户
      const beforeTime = new Date().toISOString();
      const clientId = await storage.createClient({
        name: '测试',
      });
      const afterTime = new Date().toISOString();

      // Then: 时间戳被设置
      const client = await storage.getClient(clientId);
      expect(client!.firstSeenAt >= beforeTime).toBe(true);
      expect(client!.firstSeenAt <= afterTime).toBe(true);
      expect(client!.lastSeenAt).toBe(client!.firstSeenAt);
    });

    it('should initialize sessionCount to 1', async () => {
      // Given: 创建新客户
      const clientId = await storage.createClient({ name: '测试' });

      // Then: sessionCount 为 1
      const client = await storage.getClient(clientId);
      expect(client!.sessionCount).toBe(1);
    });
  });

  describe('findClientByBirthInfo', () => {
    it('should find client by birth date and place', async () => {
      // Given: 已有客户
      const clientId = await storage.createClient({
        name: '李四',
        birthDate: '1985-03-20T12:00:00',
        birthPlace: '上海',
      });

      // When: 用相同信息查找
      const found = await storage.findClientByBirthInfo(
        '1985-03-20T12:00:00',
        '上海'
      );

      // Then: 找到同一客户
      expect(found).not.toBeNull();
      expect(found!.id).toBe(clientId);
    });

    it('should return null if not found', async () => {
      // Given: 没有匹配的客户
      const found = await storage.findClientByBirthInfo(
        '2000-01-01T00:00:00',
        '深圳'
      );

      // Then: 返回 null
      expect(found).toBeNull();
    });

    it('should not match partial birth info', async () => {
      // Given: 已有客户
      await storage.createClient({
        birthDate: '1990-05-15T06:00:00',
        birthPlace: '北京',
      });

      // When: 只匹配日期，地点不同
      const found = await storage.findClientByBirthInfo(
        '1990-05-15T06:00:00',
        '上海'
      );

      // Then: 找不到
      expect(found).toBeNull();
    });
  });

  describe('updateClient', () => {
    it('should update client info', async () => {
      // Given: 已有客户
      const clientId = await storage.createClient({
        name: '王五',
        currentCity: '广州',
      });

      // When: 更新城市
      await storage.updateClient(clientId, {
        currentCity: '深圳',
      });

      // Then: 信息被更新
      const client = await storage.getClient(clientId);
      expect(client!.currentCity).toBe('深圳');
      expect(client!.name).toBe('王五'); // 其他字段保持不变
    });

    it('should update lastSeenAt on any update', async () => {
      // Given: 已有客户
      const clientId = await storage.createClient({ name: '测试' });
      const client1 = await storage.getClient(clientId);

      // 等待一小段时间
      await new Promise((r) => setTimeout(r, 10));

      // When: 更新任意字段
      await storage.updateClient(clientId, { name: '新名字' });

      // Then: lastSeenAt 被更新
      const client2 = await storage.getClient(clientId);
      expect(client2!.lastSeenAt > client1!.lastSeenAt).toBe(true);
    });

    it('should increment sessionCount', async () => {
      // Given: 已有客户
      const clientId = await storage.createClient({ name: '测试' });

      // When: 增加会话计数
      await storage.updateClient(clientId, {
        sessionCount: 2,
      });

      // Then: 计数更新
      const client = await storage.getClient(clientId);
      expect(client!.sessionCount).toBe(2);
    });
  });

  describe('Client-Session linkage', () => {
    it('should link session to client', async () => {
      // Given: 已有客户
      const clientId = await storage.createClient({
        name: '链接测试',
      });

      // When: 创建关联会话
      const sessionId = await storage.createSession({
        platform: 'cli',
        clientId,
      });

      // Then: 会话关联到客户
      const session = await storage.getSession(sessionId);
      expect(session!.clientId).toBe(clientId);
    });

    it('should get all sessions for a client', async () => {
      // Given: 一个客户有多个会话
      const clientId = await storage.createClient({ name: '多会话' });
      const session1 = await storage.createSession({
        platform: 'cli',
        clientId,
      });
      const session2 = await storage.createSession({
        platform: 'feishu',
        clientId,
      });

      // When: 获取客户的会话列表
      const sessions = await storage.getClientSessions(clientId);

      // Then: 返回所有会话
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.id)).toContain(session1);
      expect(sessions.map((s) => s.id)).toContain(session2);
    });
  });

  describe('generateClientProfilePrompt', () => {
    it('should generate profile prompt with basic info', async () => {
      // Given: 一个有基本信息的客户
      const clientId = await storage.createClient({
        name: '档案测试',
        gender: 'male',
        birthDate: '1990-05-15T06:00:00',
        birthPlace: '北京',
        currentCity: '上海',
      });

      // When: 生成档案 prompt
      const prompt = await storage.generateClientProfilePrompt(clientId);

      // Then: 包含基本信息
      expect(prompt).toContain('姓名: 档案测试');
      expect(prompt).toContain('性别: 男');
      expect(prompt).toContain('生辰: 1990-05-15T06:00:00');
      expect(prompt).toContain('出生地: 北京');
      expect(prompt).toContain('现居: 上海');
    });

    it('should include confirmed facts', async () => {
      // Given: 一个有确认事实的客户
      const clientId = await storage.createClient({ name: '事实测试' });
      const sessionId = await storage.createSession({
        platform: 'cli',
        clientId,
      });

      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '目前在互联网公司工作',
        category: 'career',
        confirmed: true,
      });

      // When: 生成档案 prompt
      const prompt = await storage.generateClientProfilePrompt(clientId);

      // Then: 包含事实
      expect(prompt).toContain('已确认的事实');
      expect(prompt).toContain('目前在互联网公司工作');
    });

    it('should include predictions', async () => {
      // Given: 一个有预测的客户
      const clientId = await storage.createClient({ name: '预测测试' });
      const sessionId = await storage.createSession({
        platform: 'cli',
        clientId,
      });

      await storage.addPrediction({
        clientId,
        sessionId,
        prediction: '下半年有晋升机会',
        targetYear: 2025,
      });

      // When: 生成档案 prompt
      const prompt = await storage.generateClientProfilePrompt(clientId);

      // Then: 包含预测
      expect(prompt).toContain('已做出的预测');
      expect(prompt).toContain('下半年有晋升机会');
      expect(prompt).toContain('2025');
    });

    it('should include bazi summary if available', async () => {
      // Given: 一个有八字信息的客户
      const clientId = await storage.createClient({
        name: '八字测试',
        baziSummary: '年柱：庚午\n月柱：辛巳\n日柱：甲寅\n时柱：丁卯',
      });

      // When: 生成档案 prompt
      const prompt = await storage.generateClientProfilePrompt(clientId);

      // Then: 包含八字
      expect(prompt).toContain('已排定的八字');
      expect(prompt).toContain('年柱：庚午');
    });

    it('should return empty string for non-existent client', async () => {
      // Given: 不存在的客户 ID
      const prompt = await storage.generateClientProfilePrompt(
        'client_nonexistent'
      );

      // Then: 返回空字符串
      expect(prompt).toBe('');
    });
  });
});
