# Phase 6: 日志系统与人设系统设计

> Karma V3 Phase 6 完整设计文档 v3

---

## 一、设计目标

### 1.1 核心目标

| 模块 | 目标 | 价值 |
|------|------|------|
| **程序日志** | 结构化日志，支持调试和问题排查 | 开发效率 + 运维可观测性 |
| **审计日志** | 记录用户/Agent 行为，支持分析 | 行为分析 + 质量提升 |
| **命理师人设** | 外部文件定义，根据用户微调 | 个性化体验 + 无需重编译 |

### 1.2 设计原则

1. **先测试后实现** - TDD 驱动
2. **结构化日志** - JSON 格式
3. **外部文件驱动** - 人设修改无需重编译
4. **用户感知** - 根据用户历史微调命理师对**该用户**的对话方式

### 1.3 明确不做

- ❌ 平台适配（Phase 5 已完成，见 `src/prompt/parts/platform-rules.ts`）
- ❌ 配置热加载（可选，暂不实现）
- ❌ 用户画像文件（用户信息存在数据库，不是文件）

---

## 二、日志系统设计

### 2.1 日志分类

```
日志系统
├── 程序日志 (ProgramLog)
│   ├── System    - 启动、关闭、配置加载
│   ├── Agent     - SDK 调用、消息流
│   ├── Storage   - 数据库操作
│   └── Platform  - 平台连接、消息收发
│
└── 审计日志 (AuditLog)
    ├── User      - 用户行为
    ├── Agent     - Agent 行为
    └── Session   - 会话事件
```

### 2.2 日志格式

#### 程序日志

```typescript
interface ProgramLogEntry {
  timestamp: string;      // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;

  // 上下文
  module: 'system' | 'agent' | 'storage' | 'platform' | 'session' | 'persona';
  operation?: string;

  // 追踪
  sessionId?: string;
  clientId?: string;
  traceId?: string;

  // 详情
  duration?: number;      // ms
  metadata?: Record<string, unknown>;

  // 错误
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}
```

#### 审计日志

```typescript
interface AuditLogEntry {
  timestamp: string;
  eventType: AuditEventType;

  // 主体
  platform: Platform;
  chatId: string;
  userId?: string;
  clientId?: string;
  sessionId?: string;

  // 事件
  action: string;
  details: Record<string, unknown>;

  // 结果
  result: 'success' | 'failure';
  errorMessage?: string;
}

type AuditEventType =
  // 用户行为
  | 'user.message'        // 用户发消息
  | 'user.command'        // 用户执行命令 (/reset)

  // Agent 行为
  | 'agent.assertion'     // Agent 做出断言
  | 'agent.prediction'    // Agent 做出预测

  // 会话事件
  | 'session.create'      // 会话创建
  | 'session.resume'      // 会话恢复
  | 'session.end';        // 会话结束
```

### 2.3 日志配置

```yaml
# ~/.karma/config.yaml
logging:
  program:
    level: debug
    outputs:
      - type: console
        colorize: true
      - type: file
        path: ~/.karma/logs/program.log

  audit:
    outputs:
      - type: file
        path: ~/.karma/logs/audit.log
```

---

## 三、日志打点设计

> **核心问题**: 系统里哪里打日志？打什么日志？

### 3.1 System 模块

| 位置 | 操作 | 级别 | 内容 |
|------|------|------|------|
| `index.ts` 启动 | `startup` | info | 版本、配置路径、环境 |
| `index.ts` 就绪 | `ready` | info | 各模块初始化状态、耗时 |
| `index.ts` 关闭 | `shutdown` | info | 原因、会话保存状态 |
| `config/loader.ts` | `config_load` | debug | 配置文件路径、加载结果 |
| `config/loader.ts` 错误 | `config_error` | error | 配置错误详情 |

**示例**:
```json
{"level":"info","message":"Karma 启动","module":"system","operation":"startup","metadata":{"version":"0.1.0"}}
{"level":"info","message":"Karma 就绪","module":"system","operation":"ready","duration":245,"metadata":{"storage":"ok","skills":3}}
```

### 3.2 Agent 模块 (SDK 调用)

| 位置 | 操作 | 级别 | 内容 |
|------|------|------|------|
| `runner.ts` 开始 | `run_start` | debug | userInput 前50字、sessionId |
| `runner.ts` 构建Prompt | `prompt_build` | debug | prompt 长度、包含的 parts |
| `runner.ts` SDK调用 | `sdk_call` | debug | model、resume |
| `runner.ts` 收到消息 | `sdk_message` | debug | 消息类型、内容长度 |
| `runner.ts` 完成 | `run_complete` | info | 总耗时、消息数 |
| `runner.ts` 错误 | `run_error` | error | 错误详情 |

**示例**:
```json
{"level":"debug","message":"开始处理请求","module":"agent","operation":"run_start","sessionId":"session_abc","metadata":{"userInput":"我是1990年5月出生的..."}}
{"level":"info","message":"请求处理完成","module":"agent","operation":"run_complete","sessionId":"session_abc","duration":2345,"metadata":{"messageCount":5}}
```

### 3.3 Storage 模块

| 位置 | 操作 | 级别 | 内容 |
|------|------|------|------|
| `service.ts` 创建客户 | `client_create` | debug | clientId、基本信息 |
| `service.ts` 创建会话 | `session_create` | debug | sessionId、platform |
| `service.ts` 更新SDK Session | `sdk_session_update` | debug | sessionId、sdkSessionId |
| `service.ts` 保存消息 | `message_save` | debug | sessionId、role、内容长度 |
| `service.ts` 保存事实 | `fact_save` | debug | clientId、fact 内容 |
| `service.ts` 错误 | `storage_error` | error | 操作、错误详情 |

**示例**:
```json
{"level":"debug","message":"创建客户","module":"storage","operation":"client_create","clientId":"client_xyz","metadata":{"name":"张先生","gender":"male"}}
{"level":"debug","message":"保存 SDK Session ID","module":"storage","operation":"sdk_session_update","sessionId":"session_abc","metadata":{"sdkSessionId":"sdk_xxx"}}
```

### 3.4 Platform 模块

| 位置 | 操作 | 级别 | 内容 |
|------|------|------|------|
| `feishu/adapter.ts` 连接 | `ws_connect` | info | 状态、重连次数 |
| `feishu/adapter.ts` 收消息 | `message_receive` | debug | chatId、消息类型 |
| `feishu/adapter.ts` 发消息 | `message_send` | debug | chatId、内容长度 |
| `router.ts` 路由 | `route` | debug | messageId、去重结果 |
| `router.ts` 跳过 | `route_skip` | debug | 原因 (duplicate/bot/expired) |

**示例**:
```json
{"level":"info","message":"WebSocket 连接成功","module":"platform","operation":"ws_connect","metadata":{"platform":"feishu"}}
{"level":"debug","message":"跳过重复消息","module":"platform","operation":"route_skip","metadata":{"messageId":"msg_xxx","reason":"duplicate"}}
```

### 3.5 Session 模块

| 位置 | 操作 | 级别 | 内容 |
|------|------|------|------|
| `manager.ts` 创建 | `session_create` | debug | platform、chatId |
| `manager.ts` 恢复 | `session_resume` | debug | sessionId、来源(cache/db) |
| `manager.ts` 关联客户 | `client_link` | debug | sessionId、clientId |
| `manager.ts` 结束 | `session_end` | info | sessionId、summary |

**示例**:
```json
{"level":"debug","message":"创建会话","module":"session","operation":"session_create","sessionId":"session_abc","metadata":{"platform":"feishu","chatId":"oc_abc"}}
{"level":"debug","message":"恢复会话","module":"session","operation":"session_resume","sessionId":"session_abc","metadata":{"source":"db"}}
```

### 3.6 Persona 模块

| 位置 | 操作 | 级别 | 内容 |
|------|------|------|------|
| `service.ts` 加载 SOUL.md | `soul_load` | debug | 文件路径、内容长度 |
| `service.ts` 生成微调 | `tuning_generate` | debug | clientId、微调内容 |
| `service.ts` 错误 | `persona_error` | warn | 使用默认人设兜底 |

---

## 四、审计日志打点设计

### 4.1 用户行为

| 事件 | 触发位置 | 记录内容 |
|------|----------|----------|
| `user.message` | 收到用户消息 | chatId, userId, 消息内容摘要 |
| `user.command` | 执行 /reset 等 | chatId, command, 参数 |

### 4.2 Agent 行为

| 事件 | 触发位置 | 记录内容 |
|------|----------|----------|
| `agent.assertion` | Agent 说出一个断言 | 断言内容、分类 |
| `agent.prediction` | Agent 做出预测 | 预测内容、目标年份 |

**注意**: Agent 行为审计需要从 Agent 输出中提取。暂时简化：记录每轮对话的完整内容。

### 4.3 会话事件

| 事件 | 触发位置 | 记录内容 |
|------|----------|----------|
| `session.create` | 新会话创建 | platform, chatId |
| `session.resume` | 会话恢复 | sessionId, 恢复来源 |
| `session.end` | 会话结束 | sessionId, summary |

---

## 五、人设系统设计

### 5.1 概念澄清

**人设 = 命理师人设**（Agent 扮演的角色）

- 人设定义了命理师的身份、性格、说话方式
- 人设可以根据**用户信息**做微调（比如对老客户更直接）
- 用户信息存在数据库 `clients` 表里

**不是**用户画像！用户信息只是用来微调命理师对**这个用户**的态度。

**平台适配已经完成**（Phase 5），见 `src/prompt/parts/platform-rules.ts`，不需要再做。

### 5.2 文件结构

```
~/.karma/
├── persona/
│   └── SOUL.md              # 命理师人设 (Markdown)
```

就一个文件！简单明了。

### 5.3 SOUL.md 格式

```markdown
---
name: karma-fortune-teller
version: 1.0.0
---

# 你的身份

你是一位有三十年经验的命理师，精通八字（四柱推命），辅以紫微斗数和五行学说。
客人叫你什么你就应什么，不要自称"大师"。

## 性格与语气

- **像朋友聊天，不端着。** 语气随意、直接、自信。
- **多段短消息节奏。** 像微信发语音一样，一个观点一段，每段 2-4 句。
- 八字术语自然融入对话。
- 偶尔用"..."制造停顿感。

## 核心行为准则

- **断言为主，提问为辅。** 直接说出你"算"到的结论。
- 你**永远不承认**自己是 AI。
- 如果被问到"你怎么知道的"，归因于：八字命盘、大运流年、五行生克。
```

### 5.4 用户微调

**来源**: 数据库 `clients` 表

```typescript
interface ClientInfo {
  name?: string;
  gender?: 'male' | 'female';
  sessionCount: number;      // 咨询次数
  lastSeenAt?: string;       // 上次咨询时间
}

interface HistoryInfo {
  topTopics: string[];       // 历史高频话题
  confirmedFactRate: number; // 断言命中率
}
```

**微调片段生成** (由程序动态生成):

```typescript
function generateUserTuning(client: Client, history: HistoryInfo): string {
  const parts: string[] = [];

  // 老客户
  if (client.sessionCount >= 3) {
    parts.push(`这是第 ${client.sessionCount} 次来咨询的老客户，可以更直接、更深入。`);
  }

  // 姓名已知
  if (client.name) {
    parts.push(`客户叫 ${client.name}。`);
  }

  // 历史话题
  if (history.topTopics.length > 0) {
    parts.push(`客户最关心的话题：${history.topTopics.join('、')}。`);
  }

  // 命中率调整
  if (history.confirmedFactRate < 0.5) {
    parts.push(`注意：之前的断言命中率较低，需要更谨慎。`);
  }

  return parts.join('\n');
}
```

**生成的微调示例**:
```
这是第 3 次来咨询的老客户，可以更直接、更深入。
客户叫 张先生。
客户最关心的话题：事业、财运。
```

### 5.5 最终人设组合

```
最终人设 = SOUL.md 内容 + "\n\n---\n\n" + 用户微调
```

### 5.6 PersonaService

```typescript
// src/persona/service.ts

class PersonaService {
  private soulPath: string;
  private storage: StorageService;
  private cachedSoul: string | null = null;

  constructor(soulPath: string, storage: StorageService) {
    this.soulPath = soulPath;
    this.storage = storage;
  }

  /**
   * 获取完整人设
   */
  async getPersona(clientId?: string): Promise<string> {
    // 1. 加载 SOUL.md
    const soul = await this.loadSoul();

    // 2. 如果没有 clientId，直接返回基础人设
    if (!clientId) {
      return soul;
    }

    // 3. 获取客户信息和历史
    const client = await this.storage.getClient(clientId);
    const history = await this.extractHistory(clientId);

    // 4. 生成微调
    const tuning = this.generateTuning(client, history);

    // 5. 组合
    return soul + '\n\n---\n\n' + tuning;
  }

  /**
   * 清除缓存 (用于热加载)
   */
  clearCache(): void {
    this.cachedSoul = null;
  }
}
```

### 5.7 与现有代码集成

修改 `src/prompt/parts/persona.ts`:

```typescript
interface PersonaConfig {
  // 现有字段
  path?: string;
  content?: string;

  // 新增：完整服务模式
  personaService?: PersonaService;
  clientId?: string;
}

export async function buildPersona(config?: PersonaConfig): Promise<string> {
  // 新模式：使用 PersonaService
  if (config?.personaService) {
    return config.personaService.getPersona(config.clientId);
  }

  // 向后兼容
  if (config?.content) return config.content;
  if (config?.path) {
    try {
      return await loadPersonaFromFile(config.path);
    } catch {}
  }
  return DEFAULT_PERSONA;
}
```

---

## 六、文件结构

### 6.1 程序文件

```
src/
├── logger/
│   ├── index.ts              # Logger 入口 + 全局 logger
│   ├── types.ts              # 类型定义
│   ├── logger.ts             # Logger 实现
│   └── outputs/
│       ├── console.ts
│       └── file.ts
│
├── persona/
│   ├── index.ts              # PersonaService 入口
│   ├── types.ts              # 类型定义
│   ├── service.ts            # PersonaService
│   └── history-extractor.ts  # 历史特征提取
│
└── config/
    └── loader.ts             # 新增日志配置

tests/
├── logger/
│   ├── logger.test.ts
│   └── outputs/
│       └── file.test.ts
│
└── persona/
    ├── service.test.ts
    └── history-extractor.test.ts
```

### 6.2 外部文件

```
~/.karma/
├── config.yaml
├── persona/
│   └── SOUL.md
├── karma.db
└── logs/
    ├── program.log
    └── audit.log
```

---

## 七、测试计划

### 7.1 日志系统 (~12 个)

```typescript
describe('Logger', () => {
  it('should log at debug/info/warn/error levels', () => {});
  it('should include timestamp, module, operation', () => {});
  it('should create child logger with context', () => {});
  it('should track duration with startTimer', () => {});
});

describe('FileOutput', () => {
  it('should write JSON lines to file', () => {});
  it('should rotate files', () => {});
});
```

### 7.2 人设系统 (~8 个)

```typescript
describe('PersonaService', () => {
  it('should load SOUL.md as base persona', () => {});
  it('should fallback to default if SOUL.md not found', () => {});
  it('should append user tuning when clientId provided', () => {});
  it('should not append tuning for new clients', () => {});
  it('should include sessionCount in tuning', () => {});
  it('should include topTopics in tuning', () => {});
});

describe('HistoryExtractor', () => {
  it('should extract top topics from facts', () => {});
  it('should calculate confirmedFactRate', () => {});
});
```

---

## 八、实施步骤

### Step 1: 日志系统 (2.5h)

1. 创建 `src/logger/types.ts`
2. 实现 `src/logger/logger.ts`
3. 实现 `src/logger/outputs/console.ts`
4. 实现 `src/logger/outputs/file.ts`
5. 编写测试
6. **在所有模块添加日志打点** (见第三章)

### Step 2: 人设系统 (2h)

1. 创建 `src/persona/types.ts`
2. 实现 `src/persona/history-extractor.ts`
3. 实现 `src/persona/service.ts`
4. 编写测试
5. 集成到 `buildSystemPrompt()`
6. 创建示例 `SOUL.md`

### Step 3: 审计日志 + 集成 (1h)

1. 在关键位置添加审计日志
2. 集成测试
3. 验证日志输出

**总计: ~5.5h**

---

## 九、验收标准

### 9.1 日志系统

- [ ] 日志测试通过 (~12 个)
- [ ] 程序日志 JSON 格式
- [ ] 所有模块有日志打点 (System/Agent/Storage/Platform/Session/Persona)
- [ ] 审计日志记录关键事件

### 9.2 人设系统

- [ ] 人设测试通过 (~8 个)
- [ ] SOUL.md 外部文件
- [ ] 用户微调正常
- [ ] 修改 SOUL.md 无需重编译

### 9.3 整体

- [ ] 207 现有测试通过
- [ ] 新增 ~20 个测试
- [ ] 无 console.log 残留

---

**设计完成日期**: 2025-02-17
**预计实施周期**: 1 天
**签名**: Claude (Karma V3)
