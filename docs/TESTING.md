# 测试规范文档

本文档定义了 Karma 项目的测试策略和规范，明确 Mock vs 真实 API 的边界。

## 测试分层

### 1. 单元测试 (Unit Tests)

**目的：** 测试单个函数/模块的逻辑

**Mock 策略：** ✅ **应该 Mock 所有外部依赖**

**应该 Mock 的内容：**
- 外部 API 调用（如 DuckDuckGo API）
- 数据库操作（使用内存数据库 `:memory:` 除外）
- 文件系统操作
- 网络请求

**示例文件：**
- `tests/tools/web-search.test.ts` - Mock fetch API
- `tests/agent/monologue-filter.test.ts` - 纯字符串处理
- `tests/agent/info-extractor.test.ts` - 纯字符串处理
- `tests/storage/service.test.ts` - 使用内存数据库

```typescript
// ✅ 正确：单元测试 Mock 外部 API
it('should call DuckDuckGo API with correct URL', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => ({ Abstract: 'Test', RelatedTopics: [] }),
  } as Response);

  await webSearch('test query');

  expect(fetchSpy).toHaveBeenCalledWith(
    'https://api.duckduckgo.com/?q=test%20query&format=json',
    expect.objectContaining({ headers: { Accept: 'application/json' } })
  );
});
```

### 2. 集成测试 (Integration Tests)

**目的：** 测试多个模块协作，验证端到端流程

**Mock 策略：** ❌ **不应该 Mock 外部服务**

**应该使用真实调用的场景：**
- WebSearch 真实调用 DuckDuckGo
- 数据库读写流程（使用内存数据库）
- 文件系统操作（使用临时目录）
- 完整的模块协作流程

**示例文件：**
- `tests/integration/web-search-real.test.ts` - 真实 API 调用
- `tests/integration/e2e.test.ts` - 端到端流程
- `tests/integration/workflow.test.ts` - 完整工作流

```typescript
// ✅ 正确：集成测试使用真实 API
describe('Integration: WebSearch Real API', () => {
  it('should return results for a real query', async () => {
    const result = await webSearch('2008年 北京 奥运会');

    expect(result.query).toBe('2008年 北京 奥运会');
    expect(result.results.length).toBeGreaterThan(0);
  });
});
```

### 3. E2E 测试 (End-to-End Tests)

**目的：** 测试真实用户场景

**环境：** 生产或 staging 环境

**策略：** 手动或自动化测试，不在本仓库范围内

## CI 环境处理

### 跳过集成测试

集成测试可能因为网络问题或 API 限制而失败。在 CI 环境中，可以通过环境变量跳过：

```bash
# 跳过集成测试
SKIP_INTEGRATION_TESTS=true npm run test
```

### 在测试中使用

```typescript
describe('Integration: WebSearch Real API', () => {
  it.skipIf(process.env.SKIP_INTEGRATION_TESTS === 'true')(
    'should call real API',
    async () => {
      // 真实 API 调用
    }
  );
});
```

## 测试命名约定

为了明确区分测试类型，使用以下命名约定：

| 类型 | 命名模式 | Mock 策略 |
|------|----------|----------|
| 单元测试 | `*.test.ts` 或 `*.unit.test.ts` | ✅ 可以 Mock |
| 集成测试 | `*.integration.test.ts` | ❌ 真实调用 |
| E2E 测试 | `*.e2e.test.ts` | ❌ 全部真实 |

**示例：**
- `runner.unit.test.ts` - AgentRunner 单元测试（Mock SDK）
- `runner.integration.test.ts` - AgentRunner 集成测试（真实 SDK）
- `agent.e2e.test.ts` - 端到端测试（真实 LLM）

## 测试文件组织

```
tests/
├── agent/              # Agent 相关测试
│   ├── runner.unit.test.ts        # 单元测试（Mock SDK）
│   ├── bazi-tool.unit.test.ts     # 单元测试（Mock SDK）
│   ├── monologue-filter.test.ts
│   ├── info-extractor.test.ts
│   ├── data-extraction.test.ts
│   └── simulation.test.ts
├── tools/              # 工具相关测试
│   ├── web-search.test.ts         # 单元测试（Mock fetch）
│   └── bazi-calculator.test.ts
├── storage/            # 存储层测试
│   └── service.test.ts
├── platform/           # 平台适配器测试
│   ├── feishu-adapter.test.ts
│   └── http-adapter.test.ts
├── integration/        # 集成测试（真实调用）
│   ├── runner.integration.test.ts # 真实 SDK
│   ├── web-search-real.test.ts    # 真实 DuckDuckGo
│   ├── e2e.test.ts
│   └── workflow.test.ts
├── e2e/                # E2E 测试（真实 LLM）
│   └── agent-test.ts
└── fixtures/           # 测试数据
```

## 现有测试审查结果

### 单元测试（Mock 外部依赖 ✅）

| 文件 | Mock 情况 | 说明 |
|------|----------|------|
| `tests/agent/runner.unit.test.ts` | ✅ Mock SDK | 测试 AgentRunner 逻辑 |
| `tests/agent/bazi-tool.unit.test.ts` | ✅ Mock SDK | 测试工具调用逻辑 |
| `tests/agent/monologue-filter.test.ts` | ❌ 无需 | 纯字符串处理 |
| `tests/agent/info-extractor.test.ts` | ❌ 无需 | 纯字符串处理 |
| `tests/tools/web-search.test.ts` | ✅ Mock fetch | 测试搜索逻辑 |
| `tests/storage/service.test.ts` | 内存数据库 | 快速隔离 |
| `tests/platform/*.test.ts` | ✅ Mock | 测试适配器逻辑 |

### 集成测试（真实调用 ✅）

| 文件 | 真实调用 | 说明 |
|------|---------|------|
| `tests/integration/runner.integration.test.ts` | SDK + MCP | 完整调用链路 |
| `tests/integration/web-search-real.test.ts` | DuckDuckGo | 真实 API |
| `tests/integration/e2e.test.ts` | 内存数据库 | 端到端流程 |
| `tests/integration/workflow.test.ts` | 文件系统 | 完整工作流 |

### E2E 测试（真实 LLM ✅）

| 文件 | 真实调用 | 说明 |
|------|---------|------|
| `tests/e2e/agent-test.ts` | LLM API | 需要 API Key |

## 最佳实践

### 1. 测试命名

```typescript
// ✅ 好的命名
describe('MonologueFilter', () => {
  describe('process', () => {
    it('should filter inner_monologue tags', () => {});
  });
});

// ❌ 避免模糊的命名
it('test1', () => {});
it('works', () => {});
```

### 2. 测试隔离

```typescript
// ✅ 每个测试独立
beforeEach(() => {
  filter = new MonologueFilter();
});

afterEach(() => {
  filter.reset();
});
```

### 3. 使用真实数据

```typescript
// ✅ 使用真实的 Agent 输出格式
const agentOutput = `<inner_monologue>
用户提供了基本信息，我需要记录下来。
</inner_monologue>

<client_info>
姓名：张三
性别：男
</client_info>`;
```

### 4. 超时设置

集成测试可能需要更长的超时时间：

```typescript
describe('real DuckDuckGo API calls', { timeout: 30000 }, () => {
  // ...
});
```

## 运行测试

```bash
# 运行所有测试
npm run test

# 运行特定文件
npm run test tests/agent/monologue-filter.test.ts

# 跳过集成测试
SKIP_INTEGRATION_TESTS=true npm run test

# 带覆盖率
npm run test:coverage
```

## 更新日志

- **2026-02-26**: 重构测试分层
  - 将 mock 测试重命名为 `*.unit.test.ts`
  - 新增 `runner.integration.test.ts` 真实 SDK 测试
  - 明确测试命名约定
- **2026-02-26**: 初始版本，完成测试审查
