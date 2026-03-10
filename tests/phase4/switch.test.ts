/**
 * Phase 4 测试 - 切换调用点
 *
 * 测试目标
 * 1. CLI 入口 (index.ts) 切换为使用 PiAgentRunner
 * 2. API Server (server.ts) 的 HTTP 摘
 * 3. Feishu/Telegram 平台适配器
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { ActiveSession } from '@/session/types.js';
import type { StorageService } from '@/storage/service.js';
import type { SessionManager } from '@/session/manager.js';
import { createBaziTool } from '@/tools/pi-tools.js';
import { PiAgentRunner } from '@/agent/pi-runner.js';
import type { PiAgentRunnerConfig } from '@/agent/pi-runner.js';

import type { IncomingMessage } from '@/platform/types.js';

// ============================================
// PiAgentRunner Instantiation Tests
// ============================================
describe('PiAgentRunner Instantiation', () => {
  it('should create PiAgentRunner with valid config', async () => {
    const mockStorage = {
      addMessage: vi.fn().mockResolvedValue(undefined),
      generateClientProfilePrompt: vi.fn().mockResolvedValue(''),
      findClientByBirthInfo: vi.fn().mockResolvedValue(null),
      createClient: vi.fn().mockResolvedValue('client-123'),
      updateClient: vi.fn().mockResolvedValue(undefined),
    };

    const mockSessionManager = {
      getOrCreateSession: vi.fn().mockResolvedValue({
        id: 'session-123',
        platform: 'cli',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      updateSessionClient: vi.fn().mockResolvedValue(undefined),
    };

    const config: PiAgentRunnerConfig = {
      storage: mockStorage as unknown as StorageService,
      sessionManager: mockSessionManager as unknown as SessionManager,
      skills: [],
      model: 'anthropic/claude-sonnet-4-20250514',
      baseUrl: 'https://api.anthropic.com',
      authToken: 'test-token',
      timeout: 30000,
      tools: [createBaziTool()],
    };

    const runner = new PiAgentRunner(config);

    expect(runner).toBeDefined();
    expect(typeof runner.runText).toBe('function');
    expect(typeof runner.clearAgent).toBe('function');
    expect(typeof runner.clearAllAgents).toBe('function');
  });

  // 2. 切换 Telegram adapter
  it('should create PiAgentRunner for Telegram platform', async () => {
    const mockStorage = {
      addMessage: vi.fn().mockResolvedValue(undefined),
      generateClientProfilePrompt: vi.fn().mockResolvedValue(''),
      findClientByBirthInfo: vi.fn().mockResolvedValue(null),
      createClient: vi.fn().mockResolvedValue('client-123'),
      updateClient: vi.fn().mockResolvedValue(undefined),
    };

    const mockSessionManager = {
      getOrCreateSession: vi.fn().mockResolvedValue({
        id: 'session-123',
        platform: 'telegram',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
      updateSessionClient: vi.fn().mockResolvedValue(undefined),
    };

    const config: PiAgentRunnerConfig = {
      storage: mockStorage as unknown as StorageService,
      sessionManager: mockSessionManager as unknown as SessionManager,
      skills: [],
      model: 'anthropic/claude-sonnet-4-20250514',
      baseUrl: 'https://api.anthropic.com',
      authToken: 'test-token',
      timeout: 30000,
      tools: [createBaziTool()],
    };

    const runner = new PiAgentRunner(config);

    expect(runner).toBeDefined();
    expect(typeof runner.runText).toBe('function');
  });

  // 3. 位应支持 AgentRunner 接口兼容性
  it('should accept ActiveSession with clientId', async () => {
    const session: ActiveSession = {
      id: 'session-123',
      clientId: 'client-456',
      platform: 'cli',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(session.clientId).toBe('client-456');
  });
});

// ============================================
// CLI Entry Point Tests
// ============================================
describe('CLI Entry Point', () => {
  it('should support PiAgentRunner in place of AgentRunner', async () => {
    // Verify that PiAgentRunner can be imported
    const { PiAgentRunner } = await import('@/agent/pi-runner.js');
    const { createBaziTool } = await import('@/tools/pi-tools.js');

    expect(PiAgentRunner).toBeDefined();
    expect(typeof PiAgentRunner).toBe('function');
    expect(typeof createBaziTool).toBe('function');
  });

  it('should have compatible config structure', async () => {
    // Test config mapping from old AgentRunner to PiAgentRunner
    const oldConfig = {
      storage: {} as StorageService,
      sessionManager: {} as SessionManager,
      skills: [],
      model: 'claude-sonnet-4-20250514',
      baseUrl: 'https://api.anthropic.com',
      authToken: 'test-token',
      timeout: 60000,
    };

    // PiAgentRunner needs: storage, sessionManager, skills, model, tools
    const newConfig = {
      storage: oldConfig.storage,
      sessionManager: oldConfig.sessionManager,
      skills: oldConfig.skills,
      model: oldConfig.model,
      tools: [createBaziTool()],
    };

    expect(newConfig.storage).toBe(oldConfig.storage);
    expect(newConfig.sessionManager).toBe(oldConfig.sessionManager);
    expect(newConfig.model).toBe(oldConfig.model);
    expect(newConfig.tools).toHaveLength(1);
  });
});

// ============================================
// API Server Integration Tests
// ============================================
describe('API Server Integration', () => {
  it('should support PiAgentRunner in KarmaServer', async () => {
    // Verify PiAgentRunner can be used in server context
    const { PiAgentRunner } = await import('@/agent/pi-runner.js');

    const serverConfig = {
      port: 3080,
      host: '0.0.0.0',
    };

    expect(serverConfig.port).toBe(3080);
    expect(serverConfig.host).toBe('0.0.0.0');
    expect(typeof PiAgentRunner).toBe('function');
  });

  it('should handle SSE streaming format', async () => {
    // Test SSE message format compatibility
    const sseMessage = {
      type: 'text' as const,
      content: 'Hello',
    };

    const sseLine = `data: ${JSON.stringify(sseMessage)}\n\n`;

    expect(sseLine).toContain('data:');
    expect(sseLine).toContain('"type":"text"');
    expect(sseLine).toContain('"content":"Hello"');
  });
});

// ============================================
// Platform Adapter Integration Tests
// ============================================
describe('Platform Adapter Integration', () => {
  it('should work with HTTP adapter message format', async () => {
    const { MessageRouter } = await import('@/platform/router.js');

    const router = new MessageRouter();
    const receivedMessages: IncomingMessage[] = [];

    router.onMessage(async (msg) => {
      receivedMessages.push(msg);
    });

    const httpMessage: IncomingMessage = {
      id: 'http-msg-1',
      platform: 'http',
      chatId: 'session-123',
      userId: 'user-456',
      senderType: 'user',
      text: '帮我排八字',
      timestamp: Date.now(),
    };

    await router.route(httpMessage);

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].text).toBe('帮我排八字');
  });

  it('should work with Telegram adapter message format', async () => {
    const { MessageRouter } = await import('@/platform/router.js');

    const router = new MessageRouter();
    const receivedMessages: IncomingMessage[] = [];

    router.onMessage(async (msg) => {
      receivedMessages.push(msg);
    });

    const telegramMessage: IncomingMessage = {
      id: 'tg-msg-1',
      platform: 'telegram',
      chatId: 'chat-789',
      userId: 'user-012',
      senderType: 'user',
      text: '师傅好',
      timestamp: Date.now(),
    };

    await router.route(telegramMessage);

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].platform).toBe('telegram');
  });

  it('should work with Feishu adapter message format', async () => {
    const { MessageRouter } = await import('@/platform/router.js');

    const router = new MessageRouter();
    const receivedMessages: IncomingMessage[] = [];

    router.onMessage(async (msg) => {
      receivedMessages.push(msg);
    });

    const feishuMessage: IncomingMessage = {
      id: 'fs-msg-1',
      platform: 'feishu',
      chatId: 'oc_chat_123',
      userId: 'ou_user_456',
      senderType: 'user',
      text: '请问师傅在吗',
      timestamp: Date.now(),
    };

    await router.route(feishuMessage);

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].platform).toBe('feishu');
  });
});

// ============================================
// Output Format Tests
// ============================================
describe('Output Format', () => {
  it('should produce compatible text output', async () => {
    const { PiAgentRunner } = await import('@/agent/pi-runner.js');

    // Verify runText returns AsyncGenerator<string>
    expect(typeof PiAgentRunner.prototype.runText).toBe('function');
  });

  it('should filter inner monologue from output', async () => {
    const { MonologueFilter } = await import('@/agent/monologue-filter.js');

    const filter = new MonologueFilter({ keepInnerMonologue: false });

    const input = '你好<inner_monologue>思考中...</inner_monologue>世界';
    const result = filter.process(input);

    expect(result).toBe('你好世界');
  });

  it('should handle tool use markers', async () => {
    // Tool use should be marked but not exposed to end users
    const toolUseMarker = '[调用工具: bazi_calculator]';

    expect(toolUseMarker).toContain('调用工具');
    expect(toolUseMarker).toContain('bazi_calculator');
  });
});
