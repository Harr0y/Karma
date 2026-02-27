# Karma 代码重构计划

> 基于 Issue #21: 代码架构评估与重构建议

## 现状分析

### 代码行数分布 (Top 10)

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/api/server.ts` | 522 | HTTP Server + 路由 + Telegram 集成 |
| `src/storage/service.ts` | 444 | 数据存储服务 |
| `src/platform/adapters/telegram/adapter.ts` | 386 | Telegram 适配器 |
| `src/agent/runner.ts` | 407 | Agent 运行器 |
| `src/session/manager.ts` | 257 | 会话管理 |
| `src/index.ts` | 256 | CLI 入口 |
| `src/platform/adapters/feishu/adapter.ts` | 243 | 飞书适配器 |
| `tests/platform/telegram/adapter.test.ts` | 583 | Telegram 测试 |
| `tests/storage/service.test.ts` | 522 | Storage 测试 |

### 发现的问题

#### 1. 模块边界模糊 (P0)
- `src/api/server.ts` 承担过多职责：
  - HTTP 服务器生命周期管理
  - 路由处理 (4 个端点)
  - Telegram 消息处理
  - 打字指示器管理
- `GREETING_PROMPT` 硬编码在 `index.ts` 和 `server.ts` 两处

#### 2. 重复代码 (P1)
- Adapter 共性逻辑未抽取：
  - `messageHandlers: MessageHandler[]`
  - `running: boolean` + `isRunning()`
  - `onMessage(handler)` 模式
  - 错误处理 try-catch 模式
- Telegram 有去重逻辑，Feishu 缺失

#### 3. 配置分散 (P1)
- `GREETING_PROMPT` 硬编码
- 默认配置分散在多处

#### 4. 测试覆盖 (P2)
- Integration 测试偏多
- Config 模块缺少独立单元测试

---

## 重构计划

### Phase 0: 测试先行 (Week 1)

#### 0.1 Config 模块单元测试
**目标**: 为 `config/loader.ts` 建立完整的单元测试覆盖

```typescript
// tests/config/loader.test.ts
describe('ConfigLoader', () => {
  describe('loadConfig', () => {
    it('should load default config when no file exists')
    it('should merge user config with defaults')
    it('should replace environment variables')
    it('should expand ~ to home directory')
    it('should validate required fields')
  })

  describe('getConfig', () => {
    it('should return singleton instance')
    it('should reset config with resetConfig()')
  })
})
```

#### 0.2 Server 路由测试
**目标**: 为 `api/server.ts` 的路由建立集成测试

```typescript
// tests/api/routes.test.ts
describe('API Routes', () => {
  describe('POST /api/session', () => {
    it('should create new session')
    it('should return session id')
  })

  describe('POST /api/chat', () => {
    it('should stream response via SSE')
    it('should handle empty message for greeting')
    it('should return error for missing sessionId')
  })

  describe('GET /api/history/:sessionId', () => {
    it('should return message history')
    it('should return 404 for non-existent session')
  })
})
```

#### 0.3 Adapter 基础测试
**目标**: 为 Adapter 共性逻辑建立测试

```typescript
// tests/platform/base-adapter.test.ts
describe('BaseAdapter', () => {
  describe('message handling', () => {
    it('should register multiple handlers')
    it('should call all handlers on message')
    it('should continue on handler error')
  })

  describe('deduplication', () => {
    it('should skip duplicate messages')
    it('should cleanup old entries')
  })
})
```

---

### Phase 1: 配置集中化 (Week 1-2)

#### 1.1 统一常量配置
**文件**: `src/config/constants.ts`

```typescript
export const PROMPTS = {
  GREETING: '一位新的客人到来了...',
} as const;

export const DEFAULTS = {
  HTTP_PORT: 3000,
  HTTP_HOST: '0.0.0.0',
  MAX_MESSAGE_LENGTH: 4096,
} as const;
```

#### 1.2 迁移硬编码配置
- [ ] 移除 `index.ts` 中的 `GREETING_PROMPT`
- [ ] 移除 `server.ts` 中的 `GREETING_PROMPT`
- [ ] 统一使用 `config/constants.ts`

---

### Phase 2: Server 职责拆分 (Week 2-3)

#### 2.1 拆分 api/server.ts

**新文件结构**:
```
src/api/
├── server.ts          # HTTP 服务器生命周期 (100 行)
├── router.ts          # 路由注册 (50 行)
├── handlers/
│   ├── session.ts     # POST /api/session
│   ├── chat.ts        # POST /api/chat
│   └── history.ts     # GET /api/history/:id
├── types.ts           # API 类型定义 (已存在)
└── sse.ts             # SSE 工具函数
```

#### 2.2 抽取 Telegram 处理逻辑

**新文件**: `src/platform/telegram-handler.ts`

```typescript
export class TelegramMessageHandler {
  constructor(
    private sessionManager: SessionManager,
    private runner: AgentRunner,
    private telegramAdapter: TelegramAdapter,
  ) {}

  async handle(message: IncomingMessage): Promise<void>
  startTypingIndicator(chatId: string): void
  stopTypingIndicator(chatId: string): void
}
```

---

### Phase 3: Adapter 共性抽取 (Week 3-4)

#### 3.1 创建 BaseAdapter

**文件**: `src/platform/base-adapter.ts`

```typescript
export abstract class BaseAdapter implements PlatformAdapter {
  protected messageHandlers: MessageHandler[] = [];
  protected running = false;
  protected logger: Logger;

  // 去重缓存
  protected processedIds = new Map<string, number>();
  protected deduplicationTTL: number;

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  protected async dispatchToHandlers(message: IncomingMessage): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        await handler(message);
      } catch (err) {
        this.logger.error('Handler error', err, { messageId: message.id });
      }
    }
  }

  protected isDuplicate(messageId: string): boolean { ... }
  protected markProcessed(messageId: string): void { ... }
  protected startCleanupTimer(): void { ... }

  abstract readonly platform: string;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract sendMessage(chatId: string, content: string): Promise<string>;
}
```

#### 3.2 重构现有 Adapter

- [ ] `TelegramAdapter extends BaseAdapter`
- [ ] `FeishuAdapter extends BaseAdapter`
- [ ] `HttpAdapter extends BaseAdapter` (如果需要)

---

### Phase 4: 测试重构 (Week 4)

#### 4.1 单元测试/集成测试分离

**新目录结构**:
```
tests/
├── unit/              # 纯单元测试 (无外部依赖)
│   ├── config/
│   ├── platform/
│   └── utils/
├── integration/       # 集成测试 (有依赖)
│   ├── api/
│   ├── agent/
│   └── storage/
└── e2e/              # 端到端测试
```

#### 4.2 统一 Mock 策略

```typescript
// tests/__mocks__/storage.ts
export const mockStorage = {
  getSession: vi.fn(),
  createSession: vi.fn(),
  // ...
};

// tests/__mocks__/agent.ts
export const mockRunner = {
  run: vi.fn(),
  runText: vi.fn(),
};
```

---

## 目标指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 最大文件行数 | 522 | <300 |
| 单元测试覆盖率 | ~60% | >80% |
| Integration/Unit 比例 | 3:1 | 1:2 |
| Adapter 重复代码 | ~100 行 | 0 行 |

---

## PR 策略

**重要**: 所有重构通过 PR 提交，不直接 push 到 main 分支。

每个 PR 必须：
- ✅ 独立可测试
- ✅ 所有测试通过
- ✅ 功能不变（行为一致）
- ✅ 可独立回滚

---

## 执行顺序 (PR 拆分)

### PR #1: Config 单元测试 (Phase 0.1)
```
分支: refactor/config-tests
内容:
  - tests/config/loader.test.ts (新增)
  - 无代码改动
目标: 建立 Config 模块的安全网
```

### PR #2: Server 路由测试 (Phase 0.2)
```
分支: refactor/api-tests
内容:
  - tests/api/routes.test.ts (新增)
  - 可能需要导出内部函数供测试
目标: 建立 API 路由的安全网
```

### PR #3: 配置集中化 (Phase 1)
```
分支: refactor/config-centralize
内容:
  - src/config/constants.ts (新增)
  - src/index.ts (移除 GREETING_PROMPT)
  - src/api/server.ts (移除 GREETING_PROMPT)
  - tests/config/constants.test.ts (新增)
依赖: PR #1
目标: 消除硬编码配置
```

### PR #4: Server 职责拆分 (Phase 2)
```
分支: refactor/server-split
内容:
  - src/api/handlers/*.ts (新增)
  - src/api/server.ts (精简)
  - tests/api/handlers/*.test.ts (新增)
依赖: PR #2
目标: server.ts < 300 行
```

### PR #5: Telegram 处理抽取 (Phase 2.2)
```
分支: refactor/telegram-handler
内容:
  - src/platform/telegram-handler.ts (新增)
  - src/api/server.ts (移除 Telegram 逻辑)
依赖: PR #4
目标: Telegram 逻辑独立
```

### PR #6: BaseAdapter 抽取 (Phase 3)
```
分支: refactor/base-adapter
内容:
  - src/platform/base-adapter.ts (新增)
  - src/platform/adapters/telegram/adapter.ts (重构)
  - src/platform/adapters/feishu/adapter.ts (重构)
  - tests/platform/base-adapter.test.ts (新增)
依赖: 无
目标: 消除 Adapter 重复代码
```

### PR #7: 测试目录重构 (Phase 4)
```
分支: refactor/test-structure
内容:
  - tests/unit/ (新目录)
  - tests/integration/ (重组)
  - tests/__mocks__/ (统一 mock)
依赖: PR #1-6
目标: 测试结构清晰
```

---

## PR 合并顺序

```
PR #1 (config-tests) ──┐
                       ├──→ PR #3 (config-centralize)
PR #2 (api-tests) ─────┘

PR #2 (api-tests) ─────┬──→ PR #4 (server-split) ──→ PR #5 (telegram-handler)
                       │
                       └──→ PR #7 (test-structure)

PR #6 (base-adapter) ──────────────────────────────────────────────────────→ PR #7
```

可以并行开发：PR #1, PR #2, PR #6
需要串行：PR #3, PR #4, PR #5, PR #7

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 重构破坏现有功能 | 高 | 测试先行，小步提交 |
| Adapter 接口变化 | 中 | 保持接口兼容，渐进迁移 |
| 时间估算不准 | 中 | 预留 buffer，优先 P0 |

---

Generated: 2026-02-26
