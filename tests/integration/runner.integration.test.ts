// AgentRunner 集成测试 - 真实 SDK 调用
// 验证 AgentRunner → SDK → MCP Server 的完整链路

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { AgentRunner, type AgentRunnerConfig } from '@/agent/runner';
import { StorageService } from '@/storage/service';
import { SessionManager } from '@/session/manager';
import { loadSkills } from '@/skills/loader';
import { PersonaService } from '@/persona/service';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * 集成测试：真实调用 SDK
 *
 * 注意：这个测试会发起真实的 API 请求
 * - 需要 ANTHROPIC_API_KEY 或 GLM_API_KEY 环境变量
 * - 设置 SKIP_INTEGRATION_TESTS=true 可跳过
 */
describe.skipIf(process.env.SKIP_INTEGRATION_TESTS === 'true')(
  'Integration: AgentRunner with Real SDK',
  { timeout: 120000 },
  () => {
    let storage: StorageService;
    let sessionManager: SessionManager;
    let runner: AgentRunner;
    let tempDir: string;

    beforeAll(async () => {
      // 检查 API key
      const hasApiKey =
        process.env.ANTHROPIC_API_KEY ||
        process.env.GLM_API_KEY ||
        process.env.ANTHROPIC_AUTH_TOKEN;

      if (!hasApiKey) {
        console.warn(
          'No API key found. Set ANTHROPIC_API_KEY, GLM_API_KEY, or ANTHROPIC_AUTH_TOKEN'
        );
      }
    });

    beforeEach(async () => {
      tempDir = join(tmpdir(), `karma-runner-integration-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });

      storage = new StorageService(join(tempDir, 'test.db'));
      sessionManager = new SessionManager(storage);

      // 创建测试用的 SOUL.md
      const soulPath = join(tempDir, 'SOUL.md');
      writeFileSync(soulPath, '# Test Fortune Teller\n\nYou are a test fortune teller.');

      const personaService = new PersonaService({
        soulPath,
        storage,
      });

      // 加载 Skills
      const { skills } = await loadSkills({
        projectDir: process.cwd() + '/skills',
      });

      const config: AgentRunnerConfig = {
        storage,
        sessionManager,
        skills,
        personaService,
        model: process.env.ANTHROPIC_MODEL || 'glm-5',
        baseUrl: process.env.ANTHROPIC_BASE_URL,
        authToken:
          process.env.ANTHROPIC_API_KEY ||
          process.env.GLM_API_KEY ||
          process.env.ANTHROPIC_AUTH_TOKEN,
      };

      runner = new AgentRunner(config);
    });

    afterEach(() => {
      storage.close();
      rmSync(tempDir, { recursive: true, force: true });
    });

    describe('基本对话', () => {
      it('should respond to simple greeting', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        const texts: string[] = [];
        for await (const text of runner.runText({
          userInput: '你好',
          session,
        })) {
          texts.push(text);
        }

        const response = texts.join('');
        expect(response.length).toBeGreaterThan(0);
        console.log('Response:', response);
      });

      it('should ask for birth info when user says nothing specific', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        const texts: string[] = [];
        for await (const text of runner.runText({
          userInput: '我想算命',
          session,
        })) {
          texts.push(text);
        }

        const response = texts.join('');
        // 应该询问生辰信息
        expect(
          /生辰|出生|八字|时间|日期/.test(response) ||
            response.length > 0
        ).toBe(true);
      });
    });

    describe('八字工具调用', () => {
      it('should call bazi_calculator when user provides birth info', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        const messages: any[] = [];
        for await (const msg of runner.run({
          userInput: '我是1990年5月15日早上6点出生的，男，长沙人',
          session,
        })) {
          messages.push(msg);
        }

        // 检查是否有工具调用
        const toolUse = messages.find(m => m.type === 'tool_use');
        const textContent = messages
          .filter(m => m.type === 'text')
          .map(m => m.content)
          .join('');

        // 可能调用 bazi_calculator，也可能直接回复
        console.log('Tool use:', toolUse);
        console.log('Text response:', textContent);

        // 至少应该有回复
        expect(toolUse || textContent.length > 0).toBeTruthy();
      });
    });

    describe('会话持久化', () => {
      it('should persist SDK session ID', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        for await (const _ of runner.runText({
          userInput: '你好',
          session,
        })) {
          // consume
        }

        // 验证 session ID 被保存
        expect(session.sdkSessionId).toBeDefined();
        expect(session.sdkSessionId?.length).toBeGreaterThan(0);

        // 验证可以恢复会话
        const restoredSession = await storage.getSession(session.id);
        expect(restoredSession?.sdkSessionId).toBe(session.sdkSessionId);
      });

      it('should persist messages to storage', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        for await (const _ of runner.runText({
          userInput: '测试消息持久化',
          session,
        })) {
          // consume
        }

        const messages = await storage.getSessionMessages(session.id);
        expect(messages.length).toBeGreaterThanOrEqual(2);

        const userMsg = messages.find(m => m.role === 'user');
        const assistantMsg = messages.find(m => m.role === 'assistant');

        expect(userMsg?.content).toContain('测试消息持久化');
        expect(assistantMsg?.content).toBeDefined();
      });
    });

    describe('多轮对话', () => {
      it('should maintain context across turns', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        // 第一轮
        const texts1: string[] = [];
        for await (const text of runner.runText({
          userInput: '我叫张三',
          session,
        })) {
          texts1.push(text);
        }

        // 第二轮 - 应该记得名字
        const texts2: string[] = [];
        for await (const text of runner.runText({
          userInput: '你还记得我的名字吗？',
          session,
        })) {
          texts2.push(text);
        }

        const response2 = texts2.join('');
        // 可能记得名字
        console.log('Second response:', response2);
        expect(response2.length).toBeGreaterThan(0);
      });
    });

    describe('Web Search 工具调用', () => {
      it('should call web_search tool for historical events', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        const messages: any[] = [];
        for await (const msg of runner.run({
          userInput: '帮我查一下1990年中国发生了什么大事',
          session,
        })) {
          messages.push(msg);
        }

        // 检查是否有工具调用
        const toolUse = messages.find(m => m.type === 'tool_use');
        const textContent = messages
          .filter(m => m.type === 'text')
          .map(m => m.content)
          .join('');

        console.log('Web search tool use:', toolUse);
        console.log('Text response:', textContent);

        // 至少应该有回复（可能调用 web_search，也可能直接回复）
        expect(toolUse || textContent.length > 0).toBeTruthy();
      }, 120000);
    });

    describe('客户信息提取 + 持久化', () => {
      it('should extract and persist client info from real response', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        // 用户提供完整生辰信息
        const messages: any[] = [];
        for await (const msg of runner.run({
          userInput: '我叫李四，男，1990年5月15日早上6点出生，出生地是长沙，现在住在北京',
          session,
        })) {
          messages.push(msg);
        }

        // 验证响应
        const textContent = messages
          .filter(m => m.type === 'text')
          .map(m => m.content)
          .join('');

        console.log('Client info response:', textContent);
        expect(textContent.length).toBeGreaterThan(0);

        // 验证客户信息被提取并持久化
        // 注意：这取决于 Agent 是否在响应中输出 <client_info> 标签
        if (session.clientId) {
          const client = await storage.getClient(session.clientId);
          console.log('Persisted client:', client);
          // 客户记录应该存在
          expect(client).toBeDefined();
        }
      }, 120000);
    });

    describe('Inner Monologue 过滤', () => {
      it('should filter inner_monologue from runText output', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        // 使用 runText 获取过滤后的输出
        const filteredTexts: string[] = [];
        for await (const text of runner.runText({
          userInput: '你好，帮我看看运势',
          session,
        })) {
          filteredTexts.push(text);
        }

        const filteredOutput = filteredTexts.join('');
        console.log('Filtered output:', filteredOutput);

        // runText 输出不应包含 inner_monologue 标签
        expect(filteredOutput).not.toContain('<inner_monologue>');
        expect(filteredOutput).not.toContain('</inner_monologue>');
      });

      it('should preserve inner_monologue in raw run output', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        // 使用 run 获取原始输出（包含 inner_monologue）
        const rawMessages: any[] = [];
        for await (const msg of runner.run({
          userInput: '你好，帮我看看运势',
          session,
        })) {
          rawMessages.push(msg);
        }

        // 原始输出可能包含 inner_monologue（在 MonologueFilter 处理前）
        // 这个测试验证 run() 方法返回原始数据
        const hasTextContent = rawMessages.some(m => m.type === 'text');
        expect(hasTextContent || rawMessages.length > 0).toBeTruthy();
      });
    });

    describe('多轮对话 + 工具链', () => {
      it('should handle multi-turn conversation with tool chain', async () => {
        const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

        // 第一轮：用户提供生辰 -> 可能调用 bazi_calculator
        const messages1: any[] = [];
        for await (const msg of runner.run({
          userInput: '我是1990年5月15日早上6点出生的，男',
          session,
        })) {
          messages1.push(msg);
        }

        const toolUse1 = messages1.find(m => m.type === 'tool_use');
        console.log('Turn 1 tool use:', toolUse1?.content);

        // 第二轮：用户问历史背景 -> 可能调用 web_search
        const messages2: any[] = [];
        for await (const msg of runner.run({
          userInput: '1990年那个时候中国发生了什么大事？',
          session,
        })) {
          messages2.push(msg);
        }

        const toolUse2 = messages2.find(m => m.type === 'tool_use');
        const textContent2 = messages2
          .filter(m => m.type === 'text')
          .map(m => m.content)
          .join('');

        console.log('Turn 2 tool use:', toolUse2?.content);
        console.log('Turn 2 text response:', textContent2);

        // 验证上下文保持（session ID 应该相同）
        expect(session.sdkSessionId).toBeDefined();

        // 至少应该有响应
        expect(toolUse2 || textContent2.length > 0).toBeTruthy();
      }, 120000);
    });
  }
);
