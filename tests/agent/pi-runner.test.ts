/**
 * PiAgentRunner 集成测试
 *
 * 测试目标：验证 pi-mono Agent 能否正确集成到 Karma 项目
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Agent, type AgentEvent, type AgentTool } from '@mariozechner/pi-agent-core';
import { getModel, type Model } from '@mariozechner/pi-ai';
import { Type } from '@sinclair/typebox';

describe('PiAgentRunner Integration', () => {
  // 检查 API Key
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  // ============================================
  // MonologueFilter Tests
  // ============================================
  describe('MonologueFilter (No API)', () => {
    it('should filter inner_monologue tags', async () => {
      const { MonologueFilter } = await import('@/agent/monologue-filter.js');
      const filter = new MonologueFilter({ keepInnerMonologue: false });

      const input = 'Hello<inner_monologue>thinking...</inner_monologue>World';
      const result = filter.process(input);

      expect(result).toBe('HelloWorld');
    });

    it('should filter client_info tags', async () => {
      const { MonologueFilter } = await import('@/agent/monologue-filter.js');
      const filter = new MonologueFilter();

      const input = '你好<client_info>姓名：张三</client_info>，欢迎！';
      const result = filter.process(input);

      expect(result).toBe('你好，欢迎！');
    });

    it('should filter confirmed_fact tags with attributes', async () => {
      const { MonologueFilter } = await import('@/agent/monologue-filter.js');
      const filter = new MonologueFilter();

      const input = '好的<confirmed_fact category="career">是工程师</confirmed_fact>收到';
      const result = filter.process(input);

      expect(result).toBe('好的收到');
    });

    it('should filter prediction tags with year attribute', async () => {
      const { MonologueFilter } = await import('@/agent/monologue-filter.js');
      const filter = new MonologueFilter();

      const input = '看来<prediction year="2025">有好运</prediction>不错';
      const result = filter.process(input);

      expect(result).toBe('看来不错');
    });

    it('should handle streaming text correctly', async () => {
      const { MonologueFilter } = await import('@/agent/monologue-filter.js');
      const filter = new MonologueFilter();

      // Simulate streaming chunks
      const chunks = [
        'Hello ',
        '<inner_monologue>',
        'thinking',
        '</inner_monologue>',
        ' World',
      ];

      let result = '';
      for (const chunk of chunks) {
        result += filter.process(chunk);
      }
      result += filter.flush();

      expect(result).toBe('Hello  World');
    });

    it('should keep inner_monologue content when configured', async () => {
      const { MonologueFilter } = await import('@/agent/monologue-filter.js');
      const filter = new MonologueFilter({ keepInnerMonologue: true });

      const input = 'Hello<inner_monologue>thinking...</inner_monologue>World';
      const result = filter.process(input);

      expect(result).toBe('Hellothinking...World');
    });

    it('should trim leading whitespace on first output', async () => {
      const { MonologueFilter } = await import('@/agent/monologue-filter.js');
      const filter = new MonologueFilter();

      const input = '   \n\nHello World';
      const result = filter.process(input);

      expect(result).toBe('Hello World');
    });
  });

  // ============================================
  // InfoExtractor Tests
  // ============================================
  describe('InfoExtractor (No API)', () => {
    it('should extract client info from XML tags', async () => {
      const { extractClientInfo } = await import('@/agent/info-extractor.js');

      const text = `
        <client_info>
        姓名：张三
        性别：男
        生辰：1990年5月15日早上6点
        出生地：北京
        现居：上海
        </client_info>
      `;

      const result = extractClientInfo(text);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('张三');
      expect(result?.gender).toBe('male');
      expect(result?.birthDate).toBe('1990年5月15日早上6点');
      expect(result?.birthPlace).toBe('北京');
      expect(result?.currentCity).toBe('上海');
    });

    it('should return null for no client info', async () => {
      const { extractClientInfo } = await import('@/agent/info-extractor.js');

      const text = '这是一段普通的文本，没有客户信息';
      const result = extractClientInfo(text);

      expect(result).toBeNull();
    });

    it('should extract confirmed facts', async () => {
      const { extractAllFacts } = await import('@/agent/info-extractor.js');

      const text = `
        <confirmed_fact category="career">目前在互联网公司工作</confirmed_fact>
        <confirmed_fact>已婚，有一个孩子</confirmed_fact>
      `;

      const result = extractAllFacts(text);

      expect(result).toHaveLength(2);
      expect(result[0].fact).toBe('目前在互联网公司工作');
      expect(result[0].category).toBe('career');
      expect(result[1].fact).toBe('已婚，有一个孩子');
      expect(result[1].category).toBeUndefined();
    });

    it('should extract predictions with year', async () => {
      const { extractAllPredictions } = await import('@/agent/info-extractor.js');

      const text = `
        <prediction year="2025">下半年有晋升机会</prediction>
        <prediction>未来三年财运会好转</prediction>
      `;

      const result = extractAllPredictions(text);

      expect(result).toHaveLength(2);
      expect(result[0].prediction).toBe('下半年有晋升机会');
      expect(result[0].year).toBe(2025);
      expect(result[1].prediction).toBe('未来三年财运会好转');
      expect(result[1].year).toBeUndefined();
    });
  });

  // ============================================
  // Agent Creation Tests
  // ============================================
  describe('Agent Creation (No API)', () => {
    it('should create Agent with Claude model definition', () => {
      const model = getModel('anthropic', 'claude-sonnet-4-20250514');

      expect(model).toBeDefined();
      expect(model.provider).toBe('anthropic');
      expect(model.id).toBe('claude-sonnet-4-20250514');
    });

    it('should create Agent instance with system prompt', () => {
      const model = getModel('anthropic', 'claude-sonnet-4-20250514');

      const agent = new Agent({
        initialState: {
          systemPrompt: 'You are a helpful assistant.',
          model,
          tools: [],
          thinkingLevel: 'off',
        },
      });

      expect(agent).toBeDefined();
      expect(agent.state.systemPrompt).toBe('You are a helpful assistant.');
    });

    it('should create Agent with custom tools', () => {
      const model = getModel('anthropic', 'claude-sonnet-4-20250514');

      const testTool: AgentTool<any, any> = {
        name: 'test_tool',
        label: 'Test Tool',
        description: 'A test tool for unit testing',
        parameters: Type.Object({
          message: Type.String({ description: 'Test message' }),
        }),
        execute: async (toolCallId, params) => {
          return {
            content: [{ type: 'text' as const, text: `Received: ${params.message}` }],
            details: { echo: params.message },
          };
        },
      };

      const agent = new Agent({
        initialState: {
          systemPrompt: 'You are a helpful assistant.',
          model,
          tools: [testTool],
          thinkingLevel: 'off',
        },
      });

      expect(agent.state.tools).toHaveLength(1);
      expect(agent.state.tools[0].name).toBe('test_tool');
    });
  });

  describe('Bazi Tool (No API)', () => {
    it('should create bazi tool with correct schema', async () => {
      const { createBaziTool } = await import('@/tools/pi-tools.js');

      const baziTool = createBaziTool();

      expect(baziTool.name).toBe('bazi_calculator');
      expect(baziTool.label).toBe('八字排盘');
      expect(baziTool.description).toContain('八字');
      expect(baziTool.parameters).toBeDefined();
    });

    it('should execute bazi tool and return formatted result', async () => {
      const { createBaziTool } = await import('@/tools/pi-tools.js');

      const baziTool = createBaziTool();

      const result = await baziTool.execute('test-id', {
        birthDate: '1990-05-15T06:00:00',
        gender: 'male',
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect((result.content[0] as any).text).toContain('年柱');
    });

    it('should handle invalid birth date gracefully', async () => {
      const { createBaziTool } = await import('@/tools/pi-tools.js');

      const baziTool = createBaziTool();

      const result = await baziTool.execute('test-id', {
        birthDate: 'invalid-date',
        gender: 'male',
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      // 应该包含错误信息
      expect((result.content[0] as any).text).toContain('失败');
    });
  });

  describe('Session Management (No API)', () => {
    it('should maintain session ID', () => {
      const model = getModel('anthropic', 'claude-sonnet-4-20250514');

      const agent = new Agent({
        initialState: {
          systemPrompt: 'You are a helpful assistant.',
          model,
          tools: [],
          thinkingLevel: 'off',
        },
        sessionId: 'test-session-123',
      });

      expect(agent.sessionId).toBe('test-session-123');

      // 更新 session ID
      agent.sessionId = 'new-session-456';
      expect(agent.sessionId).toBe('new-session-456');
    });

    it('should track streaming state', () => {
      const model = getModel('anthropic', 'claude-sonnet-4-20250514');

      const agent = new Agent({
        initialState: {
          systemPrompt: 'You are a helpful assistant.',
          model,
          tools: [],
          thinkingLevel: 'off',
        },
      });

      expect(agent.state.isStreaming).toBe(false);
    });
  });

  // API 需要的测试使用 skipIf
  describe.skipIf(!hasApiKey)('Agent Events (Requires API)', () => {
    it('should emit events during prompt', async () => {
      const model = getModel('anthropic', 'claude-sonnet-4-20250514');

      const agent = new Agent({
        initialState: {
          systemPrompt: 'Reply with exactly "Hello" and nothing else.',
          model,
          tools: [],
          thinkingLevel: 'off',
        },
      });

      const events: AgentEvent[] = [];
      const unsub = agent.subscribe((e) => events.push(e));

      await agent.prompt('Say hello');

      // 验证事件序列
      expect(events.some(e => e.type === 'agent_start')).toBe(true);
      expect(events.some(e => e.type === 'message_start')).toBe(true);
      expect(events.some(e => e.type === 'message_end')).toBe(true);
      expect(events.some(e => e.type === 'agent_end')).toBe(true);

      unsub();
    });

    it('should stream text deltas', async () => {
      const model = getModel('anthropic', 'claude-sonnet-4-20250514');

      const agent = new Agent({
        initialState: {
          systemPrompt: 'Reply with exactly "Hello World" and nothing else.',
          model,
          tools: [],
          thinkingLevel: 'off',
        },
      });

      const textDeltas: string[] = [];
      const unsub = agent.subscribe((e) => {
        if (e.type === 'message_update' && (e as any).assistantMessageEvent?.type === 'text_delta') {
          textDeltas.push((e as any).assistantMessageEvent.delta);
        }
      });

      await agent.prompt('Say hello world');

      expect(textDeltas.length).toBeGreaterThan(0);

      unsub();
    });
  });

  // ============================================
  // PiAgentRunner Unit Tests (No API)
  // ============================================
  describe('PiAgentRunner (No API)', () => {
    it('should create PiAgentRunner instance', async () => {
      const { PiAgentRunner } = await import('@/agent/pi-runner.js');
      const { createBaziTool } = await import('@/tools/pi-tools.js');

      const mockStorage = {
        addMessage: vi.fn().mockResolvedValue(undefined),
        generateClientProfilePrompt: vi.fn().mockResolvedValue(''),
        findClientByBirthInfo: vi.fn().mockResolvedValue(null),
        createClient: vi.fn().mockResolvedValue('client-123'),
        updateClient: vi.fn().mockResolvedValue(undefined),
        addConfirmedFact: vi.fn().mockResolvedValue(undefined),
        addPrediction: vi.fn().mockResolvedValue(undefined),
      };

      const mockSessionManager = {
        updateSessionClient: vi.fn().mockResolvedValue(undefined),
      };

      const runner = new PiAgentRunner({
        storage: mockStorage as any,
        sessionManager: mockSessionManager as any,
        skills: [],
        model: 'anthropic/claude-sonnet-4-20250514',
        tools: [createBaziTool()],
      });

      expect(runner).toBeDefined();
    });

    it('should clear agent for session', async () => {
      const { PiAgentRunner } = await import('@/agent/pi-runner.js');
      const { createBaziTool } = await import('@/tools/pi-tools.js');

      const mockStorage = {
        addMessage: vi.fn().mockResolvedValue(undefined),
      };

      const mockSessionManager = {
        updateSessionClient: vi.fn().mockResolvedValue(undefined),
      };

      const runner = new PiAgentRunner({
        storage: mockStorage as any,
        sessionManager: mockSessionManager as any,
        skills: [],
        model: 'anthropic/claude-sonnet-4-20250514',
        tools: [createBaziTool()],
      });

      // Should not throw
      runner.clearAgent('test-session-id');
      runner.clearAllAgents();
    });
  });

  // ============================================
  // Karma Tools Integration Tests
  // ============================================
  describe('Karma Tools Integration (No API)', () => {
    it('should create all karma tools', async () => {
      const { createKarmaTools } = await import('@/tools/pi-tools.js');

      const tools = createKarmaTools();

      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].name).toBe('bazi_calculator');
    });

    it('should have valid tool schemas', async () => {
      const { createKarmaTools } = await import('@/tools/pi-tools.js');

      const tools = createKarmaTools();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.label).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.parameters).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      }
    });
  });
});
