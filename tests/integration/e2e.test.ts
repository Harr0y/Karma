// E2E Tests - 端到端测试
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { StorageService } from '@/storage/service';
import { SessionManager } from '@/session/manager';
import { AgentRunner } from '@/agent/runner';
import { loadSkills } from '@/skills/loader';
import type { ActiveSession } from '@/session/types';

describe('E2E: CLI Agent', () => {
  let storage: StorageService;
  let sessionManager: SessionManager;
  let runner: AgentRunner;
  let skills: Awaited<ReturnType<typeof loadSkills>>['skills'];

  beforeAll(async () => {
    storage = new StorageService(':memory:');
    sessionManager = new SessionManager(storage);

    // 加载项目 Skills
    const result = await loadSkills({
      projectDir: process.cwd() + '/skills',
    });
    skills = result.skills;

    runner = new AgentRunner({
      storage,
      sessionManager,
      skills,
      model: 'claude-sonnet-4-5-20250929',
    });
  });

  afterAll(() => {
    storage.close();
  });

  describe('Session Management', () => {
    it('should create and retrieve session', async () => {
      const session = await sessionManager.getOrCreateSession({
        platform: 'cli',
      });

      expect(session.id).toBeDefined();
      expect(session.platform).toBe('cli');

      // 再次获取应该返回同一个 session
      const session2 = await sessionManager.getOrCreateSession({
        platform: 'cli',
      });
      expect(session2.id).toBe(session.id);
    });

    it('should update SDK session ID', async () => {
      const session = await sessionManager.getOrCreateSession({
        platform: 'cli',
      });

      await sessionManager.updateSdkSessionId(session.id, 'sdk-test-123');

      const updated = await storage.getSession(session.id);
      expect(updated?.sdkSessionId).toBe('sdk-test-123');
    });

    it('should end session with summary', async () => {
      const session = await sessionManager.getOrCreateSession({
        platform: 'cli',
      });

      await sessionManager.endSession(session.id, '测试结束');

      const ended = await storage.getSession(session.id);
      expect(ended?.status).toBe('completed');
      expect(ended?.summary).toBe('测试结束');
    });
  });

  describe('Client Profile', () => {
    it('should create and retrieve client', async () => {
      const clientId = await storage.createClient({
        name: '测试客户',
        gender: 'male',
        birthDate: '1990-05-15',
        birthPlace: '上海',
      });

      const client = await storage.getClient(clientId);
      expect(client?.name).toBe('测试客户');
      expect(client?.gender).toBe('male');
    });

    it('should generate client profile prompt', async () => {
      const clientId = await storage.createClient({
        name: '张三',
        birthDate: '1988-03-10',
        birthPlace: '北京',
        currentCity: '深圳',
      });

      const profile = await storage.generateClientProfilePrompt(clientId);

      expect(profile).toContain('客户档案');
      expect(profile).toContain('张三');
      expect(profile).toContain('1988-03-10');
      expect(profile).toContain('北京');
      expect(profile).toContain('深圳');
    });

    it('should track confirmed facts', async () => {
      const clientId = await storage.createClient({ name: '测试' });
      const sessionId = await storage.createSession({ clientId, platform: 'cli' });

      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '2022年换工作了',
        category: 'career',
        confirmed: true,
      });

      const facts = await storage.getClientFacts(clientId);
      expect(facts).toHaveLength(1);
      expect(facts[0].fact).toBe('2022年换工作了');
      expect(facts[0].confirmed).toBe(true);
    });

    it('should track predictions', async () => {
      const clientId = await storage.createClient({ name: '测试' });
      const sessionId = await storage.createSession({ clientId, platform: 'cli' });

      await storage.addPrediction({
        clientId,
        sessionId,
        prediction: '28年有风口',
        targetYear: 2028,
        category: 'career',
      });

      const preds = await storage.getClientPredictions(clientId);
      expect(preds).toHaveLength(1);
      expect(preds[0].prediction).toBe('28年有风口');
      expect(preds[0].targetYear).toBe(2028);
      expect(preds[0].status).toBe('pending');
    });
  });

  describe('Skills Loading', () => {
    it('should load project skills', async () => {
      // 项目 skills 目录有 4 个 skills (methodology, examples, bazi-tools, date-parsing)
      expect(skills.length).toBeGreaterThanOrEqual(4);

      const names = skills.map(s => s.name);
      expect(names).toContain('methodology');
      expect(names).toContain('examples');
      expect(names).toContain('bazi-tools');
      expect(names).toContain('date-parsing');
    });

    it('should have valid skill content', async () => {
      const methodology = skills.find(s => s.name === 'methodology');
      expect(methodology).toBeDefined();
      expect(methodology?.description).toContain('双引擎');
      expect(methodology?.body).toContain('时间线重建');
    });
  });

  describe('Conversation Flow Simulation', () => {
    it('should track complete conversation flow', async () => {
      // 1. 创建客户
      const clientId = await storage.createClient({
        name: '李四',
        gender: 'male',
        birthDate: '1991-08-17',
        birthPlace: '湖南浏阳',
      });

      // 2. 创建会话
      const sessionId = await storage.createSession({
        clientId,
        platform: 'cli',
      });

      // 3. 记录确认的事实
      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '17年结婚',
        category: 'marriage',
        confirmed: true,
      });

      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '从事技术工作',
        category: 'career',
        confirmed: true,
      });

      // 4. 记录预测
      await storage.addPrediction({
        clientId,
        sessionId,
        prediction: '28年见风口',
        targetYear: 2028,
        category: 'career',
      });

      // 5. 生成档案
      const profile = await storage.generateClientProfilePrompt(clientId);

      expect(profile).toContain('李四');
      expect(profile).toContain('已确认的事实');
      expect(profile).toContain('17年结婚');
      expect(profile).toContain('已做出的预测');
      expect(profile).toContain('28年见风口');
    });

    it('should handle denied facts with reframe', async () => {
      const clientId = await storage.createClient({ name: '测试' });
      const sessionId = await storage.createSession({ clientId, platform: 'cli' });

      // 记录被否认的事实
      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '2018年结婚了',
        confirmed: false,
        originalPrediction: '2018年动姻缘',
        clientResponse: '没结，2021年才结',
        reframe: '婚象在2021年应验',
      });

      const facts = await storage.getClientFacts(clientId);
      expect(facts[0].confirmed).toBe(false);
      expect(facts[0].reframe).toBe('婚象在2021年应验');
    });

    it('should support multi-turn conversation tracking', async () => {
      const clientId = await storage.createClient({ name: '多轮测试' });

      // 第一轮会话
      const session1 = await storage.createSession({
        clientId,
        platform: 'cli',
      });
      await storage.updateSdkSessionId(session1, 'sdk-session-1');
      await storage.addConfirmedFact({
        clientId,
        sessionId: session1,
        fact: '第一轮确认的事实',
        confirmed: true,
      });
      await storage.endSession(session1, '第一轮结束');

      // 第二轮会话
      const session2 = await storage.createSession({
        clientId,
        platform: 'cli',
      });

      // 应该能看到第一轮的事实
      const facts = await storage.getClientFacts(clientId);
      expect(facts.some(f => f.fact === '第一轮确认的事实')).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain client-session relationship', async () => {
      const clientId = await storage.createClient({ name: '关联测试' });
      const sessionId = await storage.createSession({
        clientId,
        platform: 'cli',
      });

      const session = await storage.getSession(sessionId);
      expect(session?.clientId).toBe(clientId);
    });

    it('should handle multiple sessions per client', async () => {
      const clientId = await storage.createClient({ name: '多次会话' });

      const s1 = await storage.createSession({ clientId, platform: 'cli' });
      const s2 = await storage.createSession({ clientId, platform: 'cli' });

      expect(s1).not.toBe(s2);
    });

    it('should store messages with raw content', async () => {
      const sessionId = await storage.createSession({ platform: 'cli' });

      await storage.addMessage(
        sessionId,
        'user',
        '你好',
      );

      await storage.addMessage(
        sessionId,
        'assistant',
        '你好，请把生辰发给我',
        '<inner_monologue>用户打招呼</inner_monologue>你好，请把生辰发给我'
      );

      const messages = await storage.getSessionMessages(sessionId);
      expect(messages.length).toBe(2);
      // messages 按 createdAt 降序，所以 assistant 是第二条（索引1）
      const assistantMsg = messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg?.rawContent).toContain('inner_monologue');
      expect(assistantMsg?.content).not.toContain('inner_monologue');
    });
  });

  describe('Prompt Generation', () => {
    it('should include all skills in system prompt index', async () => {
      const { formatSkillsForPrompt } = await import('@/skills/formatter');
      const prompt = formatSkillsForPrompt(skills);

      expect(prompt).toContain('<available_skills>');
      expect(prompt).toContain('methodology');
      expect(prompt).toContain('examples');
      expect(prompt).toContain('bazi-tools');
      expect(prompt).toContain('date-parsing');
    });
  });
});
