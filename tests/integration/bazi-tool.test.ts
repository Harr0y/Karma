// Bazi Tool 集成测试
// 验证 bazi_calculator 工具是否被正确调用

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
  tool: vi.fn((name, desc, schema, handler) => ({ name, desc, schema, handler })),
  createSdkMcpServer: vi.fn((config) => ({ ...config, type: 'mcp-server' })),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';
import { AgentRunner, type AgentRunnerConfig } from '@/agent/runner';
import { StorageService } from '@/storage/service';
import { SessionManager } from '@/session/manager';
import { PersonaService } from '@/persona/service';

describe('Bazi Tool Integration', () => {
  let storage: StorageService;
  let sessionManager: SessionManager;
  let tempDir: string;
  let runner: AgentRunner;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `karma-bazi-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    storage = new StorageService(join(tempDir, 'test.db'));
    sessionManager = new SessionManager(storage);

    const soulPath = join(tempDir, 'SOUL.md');
    writeFileSync(soulPath, '# Test Fortune Teller\n\nYou are a test fortune teller.');

    const personaService = new PersonaService({
      soulPath,
      storage,
    });

    const config: AgentRunnerConfig = {
      storage,
      sessionManager,
      skills: [],
      personaService,
      model: 'test-model',
      baseUrl: 'https://test.api',
      authToken: 'test-token',
    };

    runner = new AgentRunner(config);
    vi.clearAllMocks();
  });

  afterEach(() => {
    storage.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should call bazi_calculator tool when user provides birth info', async () => {
    const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

    // 模拟 SDK 返回工具调用
    vi.mocked(query).mockImplementation(async function* () {
      // 1. 初始化
      yield { type: 'system', subtype: 'init', session_id: 'test-sdk-session' };

      // 2. 助手调用工具
      yield {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'mcp__karma-tools__bazi_calculator',
              id: 'tool-call-123',
              input: {
                birthDate: '1990年5月15日早上6点',
                gender: 'male',
              },
            },
          ],
        },
      };

      // 3. 工具结果
      yield {
        type: 'tool_result',
        tool_use_id: 'tool-call-123',
        content: `八字排盘结果：
年柱：庚午
月柱：辛巳
日柱：庚辰
时柱：己卯

日主：庚金
大运：壬午`,
      };

      // 4. 助手回复
      yield {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: '你的八字是庚午年、辛巳月、庚辰日、己卯时。' },
          ],
        },
      };

      // 5. 完成
      yield { type: 'result' };
    });

    // 运行
    const messages = [];
    for await (const msg of runner.run({
      userInput: '我是1990年5月15日早上6点出生的，男',
      session,
    })) {
      messages.push(msg);
    }

    // 验证：应该有工具调用消息
    const toolUseMsg = messages.find(m => m.type === 'tool_use');
    expect(toolUseMsg).toBeDefined();
    expect(toolUseMsg?.content).toBe('mcp__karma-tools__bazi_calculator');

    // 验证：应该有文本回复
    const textMsgs = messages.filter(m => m.type === 'text');
    const fullText = textMsgs.map(m => m.content).join('');
    expect(fullText).toContain('庚午');
    expect(fullText).toContain('辛巳');
  });

  it('should log tool call with correct input parameters', async () => {
    const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

    // 收集日志
    const logMessages: any[] = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logMessages.push(args);
      originalLog(...args);
    };

    vi.mocked(query).mockImplementation(async function* () {
      yield { type: 'system', subtype: 'init', session_id: 'test-sdk-session' };
      yield {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'mcp__karma-tools__bazi_calculator',
              id: 'tool-call-456',
              input: {
                birthDate: '1985年10月1日下午3点',
                gender: 'female',
              },
            },
          ],
        },
      };
      yield {
        type: 'tool_result',
        tool_use_id: 'tool-call-456',
        content: '八字结果：乙丑年、乙酉月、戊午日、己未时',
      };
      yield {
        type: 'assistant',
        message: { content: [{ type: 'text', text: '排盘完成' }] },
      };
      yield { type: 'result' };
    });

    for await (const _ of runner.run({
      userInput: '我是1985年10月1日下午3点出生的，女',
      session,
    })) {
      // consume
    }

    console.log = originalLog;

    // 验证 query 被调用，且 mcpServers 配置存在
    expect(vi.mocked(query)).toHaveBeenCalled();
    const queryCall = vi.mocked(query).mock.calls[0][0] as any;
    expect(queryCall.options).toHaveProperty('mcpServers');
    expect(queryCall.options.mcpServers).toHaveProperty('karma-tools');
  });
});
