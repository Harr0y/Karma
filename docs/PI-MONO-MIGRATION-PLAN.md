# Karma SDK 迁移计划：Claude Agent SDK → pi-mono

> 创建日期：2026-03-10
> 状态：规划中

---

## 一、背景

### 1.1 当前架构

Karma 项目目前使用 `@anthropic-ai/claude-agent-sdk` 作为 LLM 交互层：

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const q = query({
  prompt: userInput,
  options: {
    model,
    systemPrompt,
    resume: session.sdkSessionId,
    mcpServers: { 'karma-tools': createKarmaMcpServer() },
  },
});
```

### 1.2 目标架构

迁移到 `@mariozechner/pi-agent-core` + `@mariozechner/pi-ai`：

```typescript
import { Agent } from '@mariozechner/pi-agent-core';
import { getModel } from '@mariozechner/pi-ai';

const agent = new Agent({
  initialState: {
    systemPrompt,
    model: getModel('anthropic', 'claude-sonnet-4-20250514'),
    tools: [baziTool],
  },
});

agent.subscribe((event) => {
  if (event.type === 'message_update') {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await agent.prompt(userInput);
```

---

## 二、pi-mono vs Claude Agent SDK 对比

| 特性 | Claude Agent SDK | pi-mono |
|------|------------------|---------|
| **核心 API** | `query()` 函数 | `Agent` 类 |
| **入口** | `import { query } from '@anthropic-ai/claude-agent-sdk'` | `import { Agent } from '@mariozechner/pi-agent-core'` |
| **模型支持** | 仅 Anthropic Claude | 多提供商 (OpenAI, Google, Mistral, etc.) |
| **会话管理** | `resume` 参数 | `Agent` 实例状态 |
| **工具注册** | `createSdkMcpServer()` | `AgentTool` 接口 |
| **事件流** | `SDKMessage` 类型 | `AgentEvent` 类型 |
| **Thinking 支持** | 内置 | `thinkingLevel` 配置 |

---

## 三、迁移计划

### Phase 1: 依赖安装与适配层 (1天)

| 任务 | 说明 |
|------|------|
| **1.1** 安装依赖 | `npm install @mariozechner/pi-ai @mariozechner/pi-agent-core @sinclair/typebox` |
| **1.2** 创建适配层 | 新建 `src/agent/pi-runner.ts` |
| **1.3** 配置迁移 | 更新 `config.yaml` 支持 pi-mono 配置 |

### Phase 2: 工具迁移 (2天)

| 任务 | 说明 |
|------|------|
| **2.1** 定义 AgentTool | 将 `bazi_calculator` 从 MCP 改为 AgentTool |
| **2.2** 工具接口适配 | 实现新的 `execute()` 签名 |

**工具迁移示例:**

```typescript
// 旧: MCP Server (src/tools/registry.ts)
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const baziTool = tool('bazi_calculator', '...', schema, async (args) => {...});
return createSdkMcpServer({ name: 'karma-tools', tools: [baziTool] });

// 新: AgentTool (src/tools/pi-tools.ts)
import { Type } from '@sinclair/typebox';
import type { AgentTool } from '@mariozechner/pi-agent-core';

export const baziTool: AgentTool = {
  name: 'bazi_calculator',
  label: '八字排盘',
  description: '根据生辰信息排八字命盘，返回四柱、大运、流年、纳音等信息。',
  parameters: Type.Object({
    birthDate: Type.String({
      description: '公历生日，支持 ISO 格式（1990-05-15T06:00:00）或中文格式（1990年5月15日早上6点）'
    }),
    gender: Type.Enum({ male: 'male', female: 'female' }, {
      description: '性别：male（男）或 female（女）'
    }),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    const result = await calculateBazi(params);
    return {
      content: [{ type: 'text', text: formatBaziResult(result) }],
      details: result,
    };
  },
};
```

### Phase 3: Agent Runner 重构 (3天)

| 任务 | 说明 |
|------|------|
| **3.1** 新建 `PiAgentRunner` | 替换现有 `AgentRunner` |
| **3.2** 会话管理适配 | 使用 Agent 实例状态代替 `resume` |
| **3.3** 事件流适配 | 转换 `AgentEvent` 到现有 `ProcessedMessage` |
| **3.4** 信息提取保留 | 保留 `info-extractor.ts` 逻辑 |

**核心重构:**

```typescript
// src/agent/pi-runner.ts
import { Agent, type AgentEvent, type AgentTool } from '@mariozechner/pi-agent-core';
import { getModel, type Model } from '@mariozechner/pi-ai';
import type { StorageService } from '@/storage/service.js';
import type { SessionManager } from '@/session/manager.js';
import type { ActiveSession } from '@/session/types.js';

export interface PiAgentRunnerConfig {
  storage: StorageService;
  sessionManager: SessionManager;
  tools: AgentTool[];
  model: string;
  baseUrl?: string;
  authToken?: string;
}

export class PiAgentRunner {
  private config: PiAgentRunnerConfig;
  private agents = new Map<string, Agent>(); // per-session agents

  constructor(config: PiAgentRunnerConfig) {
    this.config = config;
  }

  async *run(options: { userInput: string; session: ActiveSession }): AsyncGenerator<ProcessedMessage> {
    const { userInput, session } = options;

    // 获取或创建 Agent
    let agent = this.agents.get(session.id);
    if (!agent) {
      agent = this.createAgent(session);
      this.agents.set(session.id, agent);
    }

    // 订阅事件
    const eventQueue: AgentEvent[] = [];
    const unsub = agent.subscribe((e) => eventQueue.push(e));

    // 发起请求
    const promptPromise = agent.prompt(userInput);

    // 处理事件
    try {
      while (true) {
        const event = eventQueue.shift();
        if (!event) {
          if (promptPromise.isSettled?.()) break;
          await new Promise(r => setTimeout(r, 10));
          continue;
        }

        yield* this.processEvent(event);
      }
    } finally {
      unsub();
    }
  }

  private createAgent(session: ActiveSession): Agent {
    return new Agent({
      initialState: {
        systemPrompt: '', // 将在运行时设置
        model: getModel('anthropic', this.config.model),
        tools: this.config.tools,
        thinkingLevel: 'off',
      },
      sessionId: session.id,
    });
  }

  private async *processEvent(event: AgentEvent): AsyncGenerator<ProcessedMessage> {
    switch (event.type) {
      case 'message_start':
        if (event.message.role === 'assistant') {
          yield { type: 'text', content: '', raw: event.message };
        }
        break;

      case 'message_update':
        if (event.assistantMessageEvent.type === 'text_delta') {
          yield { type: 'text', content: event.assistantMessageEvent.delta };
        }
        break;

      case 'tool_execution_start':
        yield { type: 'tool_use', content: event.toolName };
        break;

      case 'message_end':
        if (event.message.role === 'assistant') {
          // 提取结构化信息
          await this.extractInfo(event.message);
        }
        break;

      case 'turn_end':
        yield { type: 'result', content: 'Turn completed' };
        break;
    }
  }
}
```

### Phase 4: 平台适配器更新 (1天)

| 任务 | 说明 |
|------|------|
| **4.1** Feishu 适配器 | 更新使用 `PiAgentRunner` |
| **4.2** CLI 适配器 | 更新 REPL 使用新 Runner |
| **4.3** HTTP API | 更新 `/chat` 端点 |

### Phase 5: 测试与验证 (2天)

| 任务 | 说明 |
|------|------|
| **5.1** 单元测试 | 更新 `agent/*.test.ts` |
| **5.2** 集成测试 | 验证完整对话流程 |
| **5.3** 回归测试 | 确保功能无退化 |

---

## 四、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| API 行为差异 | 中 | 保留原 `AgentRunner` 作为 fallback |
| 事件流不兼容 | 中 | 创建适配层转换事件格式 |
| 工具执行差异 | 低 | AgentTool 接口更简洁 |
| 依赖兼容性 | 低 | pi-mono 依赖较新，需检查 Node.js 版本 |

---

## 五、预期收益

| 收益 | 说明 |
|------|------|
| **多模型支持** | 可切换到 GPT-4o、Gemini、Mistral 等 |
| **更简洁 API** | Agent 类封装更完善，状态管理更清晰 |
| **原生工具支持** | 无需 MCP Server 进程，工具定义更直观 |
| **更好的事件** | 细粒度事件流，UI 友好 |
| **活跃维护** | pi-mono 更新频繁，社区活跃 |

---

## 六、参考资源

- [pi-mono GitHub](https://github.com/badlogic/pi-mono)
- [pi-ai README](../pi-mono/packages/ai/README.md)
- [pi-agent-core README](../pi-mono/packages/agent/README.md)
- [Claude Agent SDK 文档](https://github.com/anthropics/claude-agent-sdk)

---

## 七、时间线

| 阶段 | 预计时间 | 状态 |
|------|----------|------|
| Phase 1: 依赖安装 | 1 天 | ⏳ 待开始 |
| Phase 2: 工具迁移 | 2 天 | ⏳ 待开始 |
| Phase 3: Runner 重构 | 3 天 | ⏳ 待开始 |
| Phase 4: 适配器更新 | 1 天 | ⏳ 待开始 |
| Phase 5: 测试验证 | 2 天 | ⏳ 待开始 |
| **总计** | **9 天** | |
