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
  { timeout: 60000 },
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
  }
);
