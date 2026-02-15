// Storage Service Tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageService } from '@/storage/service';

describe('StorageService', () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService(':memory:');
  });

  afterEach(() => {
    storage.close();
  });

  // ===== 客户管理测试 =====
  describe('Clients', () => {
    describe('createClient', () => {
      it('should create a client with generated ID', async () => {
        const id = await storage.createClient({
          name: '张三',
          gender: 'male',
          birthDate: '1990-05-15',
        });

        expect(id).toMatch(/^client_[a-z0-9]+$/);

        const client = await storage.getClient(id);
        expect(client?.name).toBe('张三');
        expect(client?.gender).toBe('male');
        expect(client?.birthDate).toBe('1990-05-15');
      });

      it('should set firstSeenAt and lastSeenAt to now', async () => {
        const before = new Date().toISOString();
        const id = await storage.createClient({ name: '李四' });
        const after = new Date().toISOString();

        const client = await storage.getClient(id);
        expect(client?.firstSeenAt).toBeTruthy();
        expect(client?.lastSeenAt).toBeTruthy();
        expect(client?.firstSeenAt >= before).toBe(true);
        expect(client?.lastSeenAt <= after).toBe(true);
      });

      it('should default sessionCount to 1', async () => {
        const id = await storage.createClient({ name: '王五' });
        const client = await storage.getClient(id);
        expect(client?.sessionCount).toBe(1);
      });
    });

    describe('getClient', () => {
      it('should return null for non-existent client', async () => {
        const client = await storage.getClient('non_existent');
        expect(client).toBeNull();
      });
    });

    describe('findClientByBirthInfo', () => {
      it('should find client by birth date and place', async () => {
        await storage.createClient({
          name: '测试用户',
          birthDate: '1990-05-15',
          birthPlace: '上海',
        });

        const found = await storage.findClientByBirthInfo('1990-05-15', '上海');
        expect(found?.name).toBe('测试用户');
      });

      it('should return null if not found', async () => {
        const found = await storage.findClientByBirthInfo('2000-01-01', '北京');
        expect(found).toBeNull();
      });
    });

    describe('updateClient', () => {
      it('should update client fields', async () => {
        const id = await storage.createClient({ name: '原名字' });

        await storage.updateClient(id, {
          name: '新名字',
          currentCity: '深圳',
        });

        const client = await storage.getClient(id);
        expect(client?.name).toBe('新名字');
        expect(client?.currentCity).toBe('深圳');
      });

      it('should update lastSeenAt', async () => {
        const id = await storage.createClient({ name: '测试' });
        const before = await storage.getClient(id);

        await new Promise(r => setTimeout(r, 10));

        await storage.updateClient(id, { name: '更新后' });
        const after = await storage.getClient(id);

        expect(after?.lastSeenAt > before?.lastSeenAt!).toBe(true);
      });
    });
  });

  // ===== 会话管理测试 =====
  describe('Sessions', () => {
    let clientId: string;

    beforeEach(async () => {
      clientId = await storage.createClient({ name: '测试客户' });
    });

    describe('createSession', () => {
      it('should create a session with generated ID', async () => {
        const sessionId = await storage.createSession({
          clientId,
          platform: 'cli',
        });

        expect(sessionId).toMatch(/^session_[a-z0-9]+$/);

        const session = await storage.getSession(sessionId);
        expect(session?.clientId).toBe(clientId);
        expect(session?.platform).toBe('cli');
        expect(session?.status).toBe('active');
      });

      it('should store external_chat_id for Feishu', async () => {
        const sessionId = await storage.createSession({
          platform: 'feishu',
          externalChatId: 'oc_abc123',
        });

        const session = await storage.getSession(sessionId);
        expect(session?.externalChatId).toBe('oc_abc123');
      });

      it('should allow session without client_id', async () => {
        const sessionId = await storage.createSession({
          platform: 'cli',
        });

        const session = await storage.getSession(sessionId);
        expect(session?.clientId).toBeNull();
      });
    });

    describe('getSessionByExternalChatId', () => {
      it('should find session by external_chat_id', async () => {
        await storage.createSession({
          platform: 'feishu',
          externalChatId: 'oc_xyz789',
        });

        const found = await storage.getSessionByExternalChatId('feishu', 'oc_xyz789');
        expect(found).toBeTruthy();
        expect(found?.platform).toBe('feishu');
      });

      it('should return null if not found', async () => {
        const found = await storage.getSessionByExternalChatId('feishu', 'nonexistent');
        expect(found).toBeNull();
      });
    });

    describe('updateSdkSessionId', () => {
      it('should store sdk_session_id', async () => {
        const sessionId = await storage.createSession({ platform: 'cli' });

        await storage.updateSdkSessionId(sessionId, 'sdk_abc123');

        const session = await storage.getSession(sessionId);
        expect(session?.sdkSessionId).toBe('sdk_abc123');
      });

      it('should allow finding by sdk_session_id', async () => {
        const sessionId = await storage.createSession({ platform: 'cli' });
        await storage.updateSdkSessionId(sessionId, 'sdk_xyz789');

        const found = await storage.getSessionBySdkId('sdk_xyz789');
        expect(found?.id).toBe(sessionId);
      });
    });

    describe('endSession', () => {
      it('should mark session as completed', async () => {
        const sessionId = await storage.createSession({ platform: 'cli' });

        await storage.endSession(sessionId, '完成了算命');

        const session = await storage.getSession(sessionId);
        expect(session?.status).toBe('completed');
        expect(session?.summary).toBe('完成了算命');
        expect(session?.endedAt).toBeTruthy();
      });
    });
  });

  // ===== 事实追踪测试 =====
  describe('ConfirmedFacts', () => {
    let clientId: string;
    let sessionId: string;

    beforeEach(async () => {
      clientId = await storage.createClient({ name: '测试' });
      sessionId = await storage.createSession({ clientId, platform: 'cli' });
    });

    describe('addConfirmedFact', () => {
      it('should record confirmed fact', async () => {
        const factId = await storage.addConfirmedFact({
          clientId,
          sessionId,
          fact: '2022年换工作了',
          category: 'career',
          confirmed: true,
        });

        expect(factId).toMatch(/^fact_[a-z0-9]+$/);
      });

      it('should record denied fact with reframe', async () => {
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
    });

    describe('getClientFacts', () => {
      it('should return all facts for client', async () => {
        await storage.addConfirmedFact({
          clientId,
          sessionId,
          fact: '事实1',
          confirmed: true,
        });
        await storage.addConfirmedFact({
          clientId,
          sessionId,
          fact: '事实2',
          confirmed: false,
        });

        const facts = await storage.getClientFacts(clientId);
        expect(facts).toHaveLength(2);
      });

      it('should only return facts for specified client', async () => {
        const otherClientId = await storage.createClient({ name: '另一个' });
        const otherSessionId = await storage.createSession({
          clientId: otherClientId,
          platform: 'cli',
        });

        await storage.addConfirmedFact({
          clientId,
          sessionId,
          fact: '客户1的事实',
          confirmed: true,
        });
        await storage.addConfirmedFact({
          clientId: otherClientId,
          sessionId: otherSessionId,
          fact: '客户2的事实',
          confirmed: true,
        });

        const facts = await storage.getClientFacts(clientId);
        expect(facts).toHaveLength(1);
        expect(facts[0].fact).toBe('客户1的事实');
      });
    });

    describe('getSessionFacts', () => {
      it('should return facts for session', async () => {
        await storage.addConfirmedFact({
          clientId,
          sessionId,
          fact: '会话事实',
          confirmed: true,
        });

        const facts = await storage.getSessionFacts(sessionId);
        expect(facts).toHaveLength(1);
        expect(facts[0].fact).toBe('会话事实');
      });
    });
  });

  // ===== 预测管理测试 =====
  describe('Predictions', () => {
    let clientId: string;
    let sessionId: string;

    beforeEach(async () => {
      clientId = await storage.createClient({ name: '测试' });
      sessionId = await storage.createSession({ clientId, platform: 'cli' });
    });

    describe('addPrediction', () => {
      it('should create prediction with pending status', async () => {
        const predId = await storage.addPrediction({
          clientId,
          sessionId,
          prediction: '28年会有一个风口',
          targetYear: 2028,
          category: 'career',
        });

        const preds = await storage.getClientPredictions(clientId);
        expect(preds[0].status).toBe('pending');
        expect(preds[0].targetYear).toBe(2028);
      });
    });

    describe('updatePredictionStatus', () => {
      it('should update prediction status', async () => {
        const predId = await storage.addPrediction({
          clientId,
          sessionId,
          prediction: '测试预测',
        });

        await storage.updatePredictionStatus(predId, 'confirmed', '已验证');

        const preds = await storage.getClientPredictions(clientId);
        expect(preds[0].status).toBe('confirmed');
        expect(preds[0].verificationNotes).toBe('已验证');
        expect(preds[0].verifiedAt).toBeTruthy();
      });
    });
  });

  // ===== 消息管理测试 =====
  describe('Messages', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await storage.createSession({ platform: 'cli' });
    });

    describe('addMessage', () => {
      it('should store user message', async () => {
        await storage.addMessage(sessionId, 'user', '你好');

        const msgs = await storage.getSessionMessages(sessionId);
        expect(msgs).toHaveLength(1);
        expect(msgs[0].role).toBe('user');
        expect(msgs[0].content).toBe('你好');
      });

      it('should store assistant message with raw content', async () => {
        await storage.addMessage(
          sessionId,
          'assistant',
          '你好，有什么可以帮你？',
          '<inner_monologue>用户打招呼...</inner_monologue>你好，有什么可以帮你？'
        );

        const msgs = await storage.getSessionMessages(sessionId);
        expect(msgs[0].rawContent).toContain('inner_monologue');
      });
    });

    describe('getSessionMessages', () => {
      it('should return messages in descending order', async () => {
        await storage.addMessage(sessionId, 'user', '第一条');
        await new Promise(r => setTimeout(r, 10));
        await storage.addMessage(sessionId, 'user', '第二条');

        const msgs = await storage.getSessionMessages(sessionId);
        expect(msgs[0].content).toBe('第二条');
        expect(msgs[1].content).toBe('第一条');
      });

      it('should respect limit parameter', async () => {
        for (let i = 0; i < 10; i++) {
          await storage.addMessage(sessionId, 'user', `消息${i}`);
        }

        const msgs = await storage.getSessionMessages(sessionId, 5);
        expect(msgs).toHaveLength(5);
      });
    });
  });

  // ===== 工具方法测试 =====
  describe('generateClientProfilePrompt', () => {
    it('should generate profile prompt for client', async () => {
      const clientId = await storage.createClient({
        name: '张三',
        gender: 'male',
        birthDate: '1990-05-15',
        birthPlace: '上海',
        currentCity: '深圳',
      });

      const prompt = await storage.generateClientProfilePrompt(clientId);

      expect(prompt).toContain('张三');
      expect(prompt).toContain('男');
      expect(prompt).toContain('1990-05-15');
      expect(prompt).toContain('上海');
      expect(prompt).toContain('深圳');
    });

    it('should include confirmed facts in prompt', async () => {
      const clientId = await storage.createClient({ name: '测试' });
      const sessionId = await storage.createSession({ clientId, platform: 'cli' });

      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '2022年换工作',
        confirmed: true,
      });

      const prompt = await storage.generateClientProfilePrompt(clientId);
      expect(prompt).toContain('已确认的事实');
      expect(prompt).toContain('2022年换工作');
    });

    it('should include predictions in prompt', async () => {
      const clientId = await storage.createClient({ name: '测试' });
      const sessionId = await storage.createSession({ clientId, platform: 'cli' });

      await storage.addPrediction({
        clientId,
        sessionId,
        prediction: '28年有风口',
        targetYear: 2028,
      });

      const prompt = await storage.generateClientProfilePrompt(clientId);
      expect(prompt).toContain('已做出的预测');
      expect(prompt).toContain('28年有风口');
    });

    it('should return empty string for non-existent client', async () => {
      const prompt = await storage.generateClientProfilePrompt('nonexistent');
      expect(prompt).toBe('');
    });
  });
});
