# Karma MVP 验证计划

> 在继续构建 Phase 5-6 之前，先迁移老项目内容，然后做最小可用验证

---

## 一、目标

### 1.1 主要目标

1. **迁移老项目内容** - 将 Karma-V2 的 714 行 prompt 拆分为 Skills
2. **创建最小可用 CLI Agent** - 验证 4 个核心模块正确协作

### 1.2 迁移内容

| 原内容 | 迁移到 | 说明 |
|--------|--------|------|
| PERSONA | `prompt/parts/persona.ts` | 已有，需扩充 |
| BAZI_FRAMEWORK | `prompt/parts/bazi.ts` | 已有简化版，需扩充 |
| METHODOLOGY | `skills/methodology/SKILL.md` | 新建 |
| PSYCHOLOGY_LIBRARY | `skills/psychology/SKILL.md` | 新建 |
| GOLD_STANDARD_EXAMPLE | `skills/examples/SKILL.md` | 新建 |

### 1.2 验收标准

| 功能 | 预期结果 |
|------|----------|
| CLI 启动 | Agent 主动打招呼，要求生辰信息 |
| 多轮对话 | 能持续对话，记住上下文 |
| 会话恢复 | 程序重启后能恢复之前的对话 |
| 客户档案 | 能记住客户信息（姓名、生辰） |
| Skills | 能加载并使用 Skills |
| Monologue | 用户看不到 `<inner_monologue>` 内容 |

---

## 二、MVP 范围

### 2.1 需要实现

| 组件 | 说明 | 预计时间 |
|------|------|----------|
| **CLI 入口** | readline 循环，处理用户输入 | 1h |
| **Monologue Filter** | 过滤 `<inner_monologue>` 标签 | 0.5h |
| **Agent Runner** | 封装 SDK 调用，整合所有模块 | 1.5h |
| **集成测试** | 端到端测试 | 1h |

**总计: 约 4 小时**

### 2.2 暂不实现 (Phase 5-6)

- ❌ Platform Adapters (Feishu/WeChat)
- ❌ 配置文件系统
- ❌ Prompts 模板系统
- ❌ MCP 工具

### 2.3 硬编码默认值

```typescript
// MVP 期间的硬编码，Phase 6 改为配置
const DEFAULTS = {
  model: 'claude-sonnet-4-5-20250929',
  dbPath: join(homedir(), '.karma', 'karma.db'),
  skillsDir: join(homedir(), '.karma', 'skills'),
};
```

---

## 三、文件结构

```
karma/
├── src/
│   ├── index.ts              # CLI 入口 (新增)
│   ├── agent/
│   │   ├── runner.ts         # Agent Runner (新增)
│   │   └── monologue-filter.ts # Monologue 过滤器 (新增)
│   ├── storage/              # ✅ 已完成
│   ├── skills/               # ✅ 已完成
│   ├── prompt/               # ✅ 已完成
│   └── session/              # ✅ 已完成
├── tests/
│   ├── agent/
│   │   ├── runner.test.ts    # Runner 测试 (新增)
│   │   └── monologue-filter.test.ts # 过滤器测试 (新增)
│   └── integration/
│       └── e2e.test.ts       # 端到端测试 (新增)
└── package.json
```

---

## 四、组件设计

### 4.1 Monologue Filter

```typescript
// src/agent/monologue-filter.ts

export class MonologueFilter {
  private buffer = '';
  private insideMonologue = false;

  /**
   * 处理一段文本，过滤 inner_monologue 标签
   */
  process(text: string): string;

  /**
   * 刷新剩余内容
   */
  flush(): string;
}
```

### 4.2 Agent Runner

```typescript
// src/agent/runner.ts

export interface AgentRunnerConfig {
  storage: StorageService;
  sessionManager: SessionManager;
  skills: Skill[];
  model: string;
}

export interface AgentRunResult {
  sessionId: string;
  clientId?: string;
}

export class AgentRunner {
  constructor(config: AgentRunnerConfig);

  /**
   * 运行一轮对话
   * @returns AsyncGenerator<SDKMessage>
   */
  async *run(
    userInput: string,
    session: ActiveSession
  ): AsyncGenerator<SDKMessage>;

  /**
   * 处理 SDK 消息，过滤 monologue
   */
  private processMessage(msg: SDKMessage): string | null;
}
```

### 4.3 CLI 入口

```typescript
// src/index.ts

async function main() {
  // 1. 初始化
  const storage = new StorageService(dbPath);
  const sessionMgr = new SessionManager(storage);
  const { skills } = await loadSkills({ globalDir: skillsDir });

  // 2. 创建 Runner
  const runner = new AgentRunner({
    storage,
    sessionManager: sessionMgr,
    skills,
    model: DEFAULT_MODEL,
  });

  // 3. 获取/创建会话
  const session = await sessionMgr.getOrCreateSession({ platform: 'cli' });

  // 4. 首次启动 - Agent 主动开场
  if (!session.sdkSessionId) {
    for await (const msg of runner.run(PROMPTS.GREETING, session)) {
      print(msg);
    }
  }

  // 5. REPL 循环
  while (true) {
    const input = await rl.question('你: ');
    if (input === 'exit') break;

    for await (const msg of runner.run(input, session)) {
      print(msg);
    }
  }
}
```

---

## 五、测试计划

### 5.1 单元测试

#### MonologueFilter 测试 (~8 个)

```typescript
describe('MonologueFilter', () => {
  it('should pass through normal text', () => {
    const filter = new MonologueFilter();
    expect(filter.process('Hello')).toBe('Hello');
  });

  it('should filter inner_monologue tags', () => {
    const filter = new MonologueFilter();
    const input = '<inner_monologue>thinking...</inner_monologue>Hello';
    expect(filter.process(input)).toBe('Hello');
  });

  it('should handle partial tags', () => {
    const filter = new MonologueFilter();
    filter.process('<inner_monologue>thin');
    const result = filter.process('king...</inner_monologue>Hello');
    expect(result).toBe('Hello');
  });

  it('should handle multiple monologues', () => {
    const filter = new MonologueFilter();
    const input = '<inner_monologue>a</inner_monologue>text<inner_monologue>b</inner_monologue>';
    expect(filter.process(input)).toBe('text');
  });

  it('should flush remaining content on stream end', () => {
    const filter = new MonologueFilter();
    filter.process('<inner_monologue>thinking');
    expect(filter.flush()).toBe('thinking'); // 被截断时输出内容
  });

  it('should handle nested tags gracefully', () => {
    const filter = new MonologueFilter();
    const input = '<inner_monologue><tag>nested</tag></inner_monologue>after';
    expect(filter.process(input)).toBe('after');
  });

  it('should preserve text before monologue', () => {
    const filter = new MonologueFilter();
    const input = 'before<inner_monologue>hidden</inner_monologue>after';
    expect(filter.process(input)).toBe('beforeafter');
  });

  it('should handle empty monologue', () => {
    const filter = new MonologueFilter();
    const input = '<inner_monologue></inner_monologue>text';
    expect(filter.process(input)).toBe('text');
  });
});
```

#### AgentRunner 测试 (~6 个)

```typescript
describe('AgentRunner', () => {
  // Mock SDK 和其他依赖

  it('should create runner with config', () => {
    const runner = new AgentRunner(mockConfig);
    expect(runner).toBeDefined();
  });

  it('should build system prompt with skills', async () => {
    // 验证 System Prompt 包含 Skills
  });

  it('should update SDK session ID after run', async () => {
    // 验证 session.sdkSessionId 被更新
  });

  it('should filter monologue from output', async () => {
    // 验证输出不包含 <inner_monologue>
  });

  it('should handle SDK errors gracefully', async () => {
    // 验证错误处理
  });

  it('should resume session with existing sdkSessionId', async () => {
    // 验证 resume 功能
  });
});
```

### 5.2 集成测试 (端到端)

#### E2E 测试 (~5 个)

```typescript
describe('E2E: CLI Agent', () => {
  it('should complete a basic conversation flow', async () => {
    // 1. 启动 Agent
    // 2. 发送用户输入
    // 3. 收到响应
    // 4. 验证会话 ID 被保存
  });

  it('should remember client info across turns', async () => {
    // 1. 第一轮：用户提供姓名
    // 2. 第二轮：询问 Agent 用户姓名
    // 3. 验证 Agent 记住了姓名
  });

  it('should resume conversation after restart', async () => {
    // 1. 第一轮对话
    // 2. 模拟程序重启（清除内存缓存）
    // 3. 恢复会话
    // 4. 验证上下文被保留
  });

  it('should handle multi-line user input', async () => {
    // 验证多行输入处理
  });

  it('should respect skills loaded from directory', async () => {
    // 验证 Skills 被加载和使用
  });
});
```

---

## 六、测试统计

| 类型 | 现有 | 新增 | 合计 |
|------|------|------|------|
| 单元测试 | 129 | 14 | 143 |
| 集成测试 | 7 | 5 | 12 |
| **总计** | **136** | **19** | **155** |

---

## 七、时间表

| 阶段 | 内容 | 时间 |
|------|------|------|
| 0 | 迁移老项目内容到 Skills | 2h |
| 1 | MonologueFilter + 测试 | 0.5h |
| 2 | AgentRunner + 测试 | 1.5h |
| 3 | CLI 入口 | 0.5h |
| 4 | E2E 测试 | 1h |
| 5 | 调试修复 | 0.5h |
| **总计** | | **6h** |

---

## 八、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| SDK API 变化 | 使用已验证的 V1 query() API |
| Monologue 过滤不完整 | 充分的单元测试覆盖 |
| 会话恢复失败 | 参考 disclaude 已验证的实现 |
| 性能问题 | MVP 不关注性能，先跑通 |

---

## 九、成功标准

MVP 验证成功的标准：

1. ✅ CLI 能启动并运行
2. ✅ 多轮对话正常
3. ✅ 会话恢复正常
4. ✅ 155 个测试全部通过
5. ✅ 实际对话体验流畅

成功后：
- 继续构建 Phase 5 (Platform Adapters)
- 继续构建 Phase 6 (配置系统)
- 集成到 Feishu

失败后：
- 修复问题
- 重新验证
- 再决定是否继续
