# Karma V3 架构设计

> 模块化、可扩展的 AI 命理师 Agent 架构

---

## 一、设计目标

### 1.1 核心目标

- **模块化** - 各组件独立、可测试、可替换
- **可扩展** - Skills 系统支持动态加载
- **可维护** - 178 个测试保障质量
- **平台无关** - 支持 CLI、Feishu、WeChat

### 1.2 技术选型

| 领域 | 技术 | 原因 |
|------|------|------|
| Runtime | Node.js 18+ | TypeScript 原生支持 |
| AI SDK | @anthropic-ai/claude-agent-sdk | 官方支持 |
| Database | SQLite + Drizzle ORM | 轻量、持久化 |
| Config | YAML | 人类可读、环境变量支持 |
| Test | Vitest | 快速、ESM 原生 |

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI / Platform                        │
│                    (src/index.ts)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Agent Runner                           │
│                   (src/agent/runner.ts)                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  MonologueFilter - 过滤 inner_monologue             │    │
│  │  SDK Integration - 调用 Claude Agent SDK            │    │
│  │  Session Management - SDK session resume            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    Prompt    │    │   Session    │    │   Storage    │
│    Builder   │    │   Manager    │    │   Service    │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    Parts     │    │ Memory Cache │    │   SQLite     │
│  - persona   │    │              │    │              │
│  - bazi      │    └──────────────┘    └──────────────┘
│  - cold-read │
│  - time      │    ┌──────────────┐
│  - platform  │    │    Skills    │
└──────────────┘    │   Loader     │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ SKILL.md     │
                    │ - methodology│
                    │ - psychology │
                    │ - examples   │
                    └──────────────┘
```

---

## 三、核心模块

### 3.1 Storage Layer

**职责**: 持久化存储

```typescript
// src/storage/service.ts
export class StorageService {
  // 客户管理
  createClient(data: ClientInput): Promise<string>
  getClient(id: string): Promise<Client | null>
  updateClient(id: string, data: Partial<ClientInput>): Promise<void>

  // 会话管理
  createSession(data: SessionInput): Promise<string>
  getSession(id: string): Promise<Session | null>
  updateSdkSessionId(id: string, sdkSessionId: string): Promise<void>
  endSession(id: string, summary?: string): Promise<void>

  // 事实追踪
  addConfirmedFact(fact: FactInput): Promise<void>
  getClientFacts(clientId: string): Promise<Fact[]>

  // 预测管理
  addPrediction(prediction: PredictionInput): Promise<void>
  getClientPredictions(clientId: string): Promise<Prediction[]>

  // 消息历史
  addMessage(sessionId: string, role: string, content: string, rawContent?: string): Promise<void>
  getSessionMessages(sessionId: string): Promise<Message[]>

  // 客户档案生成
  generateClientProfilePrompt(clientId: string): Promise<string>
}
```

**Schema**:
```typescript
// src/storage/schema.ts
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name'),
  gender: text('gender'),
  birthDate: text('birth_date'),
  birthPlace: text('birth_place'),
  currentCity: text('current_city'),
  occupation: text('occupation'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  platform: text('platform').notNull(),
  externalChatId: text('external_chat_id'),
  sdkSessionId: text('sdk_session_id'),
  status: text('status').default('active'),
  summary: text('summary'),
  startedAt: integer('started_at'),
  endedAt: integer('ended_at'),
});
```

### 3.2 Skills System

**职责**: 动态加载知识库

```typescript
// src/skills/loader.ts
export async function loadSkills(options: {
  globalDir?: string;
  projectDir?: string;
}): Promise<{
  skills: Skill[];
  errors: LoadError[];
}>

// src/skills/parser.ts
export function parseSkillMarkdown(content: string): Skill | null

// src/skills/formatter.ts
export function formatSkillsForPrompt(skills: Skill[]): string
```

**SKILL.md 格式**:
```markdown
---
name: skill-name
description: 技能描述
disable-model-invocation: false
---

# 技能内容...
```

### 3.3 Prompt Builder

**职责**: 组合式 System Prompt

```typescript
// src/prompt/builder.ts
export async function buildSystemPrompt(
  context: PromptContext,
  options?: PromptOptions
): Promise<string>

export interface PromptContext {
  now: Date;
  skills: Skill[];
  platform: 'cli' | 'feishu' | 'wechat';
  clientId?: string;
}

export interface PromptOptions {
  includeBazi?: boolean;
  includeColdReading?: boolean;
  includeOutputRules?: boolean;
  includeToolGuidelines?: boolean;
  persona?: PersonaConfig;
}
```

**Prompt Parts**:
```
src/prompt/parts/
├── persona.ts          # 人设
├── bazi.ts             # 八字框架
├── cold-reading.ts     # 冷读引擎
├── time-anchor.ts      # 时间锚点
├── platform-rules.ts   # 平台规则
├── tool-guidelines.ts  # 工具使用指南
└── output-rules.ts     # 输出格式规则
```

### 3.4 Session Manager

**职责**: 会话生命周期管理

```typescript
// src/session/manager.ts
export class SessionManager {
  private cache: Map<string, ActiveSession>;

  getOrCreateSession(input: SessionInput): Promise<ActiveSession>
  updateSdkSessionId(id: string, sdkSessionId: string): Promise<void>
  endSession(id: string, summary?: string): Promise<void>
  clearCache(): void
  getSessionFromCache(key: string): ActiveSession | undefined
}
```

**内存缓存 + 持久化**:
- 活跃会话缓存在内存
- SDK session_id 持久化到 SQLite
- 程序重启后恢复会话

### 3.5 Agent Runner

**职责**: 封装 SDK 调用

```typescript
// src/agent/runner.ts
export class AgentRunner {
  constructor(config: AgentRunnerConfig);

  async *run(options: RunOptions): AsyncGenerator<ProcessedMessage>
  async *runText(options: RunOptions): AsyncGenerator<string>
}

export interface AgentRunnerConfig {
  storage: StorageService;
  sessionManager: SessionManager;
  skills: Skill[];
  model: string;
  baseUrl?: string;
  authToken?: string;
}
```

**SDK 集成**:
```typescript
const q = query({
  prompt: userInput,
  options: {
    model,
    systemPrompt,
    resume: session.sdkSessionId,
    permissionMode: 'bypassPermissions',
    env: {
      ANTHROPIC_AUTH_TOKEN: authToken,
      ANTHROPIC_BASE_URL: baseUrl,
    },
  },
});

for await (const msg of q) {
  if (msg.type === 'assistant') {
    // 过滤 monologue
    const filtered = filter.process(block.text);
    yield filtered;
  }
}
```

### 3.6 Monologue Filter

**职责**: 过滤 inner_monologue

```typescript
// src/agent/monologue-filter.ts
export class MonologueFilter {
  process(text: string): string
  flush(): string
  reset(): void
}
```

**特性**:
- 流式处理（跨 chunk）
- 处理被截断的 monologue
- 状态管理

---

## 四、数据流

### 4.1 完整对话流程

```
用户输入
    │
    ▼
┌─────────────────┐
│   CLI / API     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SessionManager  │ ──── 获取/创建会话
│ getOrCreate()   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PromptBuilder   │ ──── 构建 System Prompt
│ build()         │     - 时间锚点
└────────┬────────┘     - Skills 索引
         │              - 平台规则
         ▼
┌─────────────────┐
│  AgentRunner    │ ──── 调用 SDK
│  run()          │     - resume 支持
└────────┬────────┘     - 流式输出
         │
         ▼
┌─────────────────┐
│ MonologueFilter │ ──── 过滤 inner_monologue
│ process()       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SessionManager  │ ──── 更新 SDK session_id
│ updateSdkId()   │
└────────┬────────┘
         │
         ▼
       输出
```

### 4.2 客户档案生成

```
getClient(clientId)
        │
        ▼
┌─────────────────────┐
│ StorageService      │
│ generateProfile()   │
└─────────┬───────────┘
          │
          ├──── 基本信息
          ├──── 已确认事实
          ├──── 已否认事实
          └──── 已做出的预测
          │
          ▼
    格式化 Prompt
          │
          ▼
    注入 System Prompt
```

---

## 五、配置系统

### 5.1 配置文件

```yaml
# ~/.karma/config.yaml

ai:
  authToken: ${ANTHROPIC_AUTH_TOKEN:}
  baseUrl: ${ANTHROPIC_BASE_URL:https://api.anthropic.com}
  model: ${ANTHROPIC_MODEL:claude-sonnet-4-5-20250929}
  timeout: 300000

storage:
  type: sqlite
  path: ~/.karma/karma.db

skills:
  dirs:
    - ~/.karma/skills
    - ./skills
  autoLoad: true

logging:
  level: info
  file: ~/.karma/logs/karma.log
```

### 5.2 环境变量优先

```typescript
// src/config/loader.ts
export function loadConfig(): KarmaConfig {
  let config = { ...DEFAULT_CONFIG };

  // 加载文件
  if (existsSync(configPath)) {
    config = deepMerge(config, parse(yamlContent));
  }

  // 环境变量覆盖
  if (process.env.ANTHROPIC_AUTH_TOKEN) {
    config.ai.authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  }

  return config;
}
```

---

## 六、测试策略

### 6.1 测试金字塔

```
        ┌───────┐
        │  E2E  │ 16 tests
        │       │
      ┌─┴───────┴─┐
      │ Integration│ 7 tests
      │           │
    ┌─┴───────────┴─┐
    │    Unit       │ 155 tests
    │               │
    └───────────────┘
```

### 6.2 测试覆盖

| 模块 | 测试数 | 覆盖率 |
|------|--------|--------|
| Storage | 31 | 95%+ |
| Skills | 39 | 95%+ |
| Prompt | 32 | 95%+ |
| Session | 20 | 95%+ |
| Agent | 33 | 95%+ |
| E2E | 16 | - |
| Integration | 7 | - |

### 6.3 Agent-vs-Agent 测试

```typescript
// tests/e2e/agent-test.ts

// 模拟真实用户人设
const LI_TING: Persona = {
  name: '李婷',
  gender: 'female',
  birthDate: '1997年农历三月初八 早上6点多',
  concerns: ['婚恋', '家庭压力'],
};

// 自动化多轮对话测试
const runner = new AgentTestRunner(persona, 5);
runner.run();
```

---

## 七、扩展点

### 7.1 添加新平台

```typescript
// src/platform/feishu.ts
export class FeishuAdapter implements PlatformAdapter {
  async handleMessage(event: FeishuEvent): Promise<void> {
    const session = await sessionManager.getOrCreateSession({
      platform: 'feishu',
      externalChatId: event.chat_id,
    });

    for await (const text of runner.runText({
      userInput: event.message,
      session,
    })) {
      await this.sendText(event.chat_id, text);
    }
  }
}
```

### 7.2 添加新 Skill

```bash
mkdir -p skills/my-skill
cat > skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: 我的技能
---

# 技能内容...
EOF
```

### 7.3 自定义 Prompt Part

```typescript
// src/prompt/parts/custom.ts
export function buildCustomPart(): string {
  return `
# 自定义部分

...
`;
}

// src/prompt/builder.ts
import { buildCustomPart } from './parts/custom.js';

// 在 buildSystemPrompt 中添加
parts.push(buildCustomPart());
```

---

## 八、性能考量

### 8.1 内存缓存

- SessionManager 使用 Map 缓存活跃会话
- 避免频繁数据库查询
- 程序退出时持久化

### 8.2 流式输出

- SDK 返回 AsyncGenerator
- 逐 token/chunk 输出
- 用户体验更好

### 8.3 SQLite

- 单文件数据库
- 读写快速
- 无需额外服务

---

## 九、安全考量

### 9.1 敏感信息

- Auth Token 通过环境变量传入
- 不写入配置文件
- .gitignore 排除 .env

### 9.2 输出过滤

- MonologueFilter 确保内部思考不泄露
- 用户只看到最终输出

---

## 十、未来演进

### 10.1 Phase 5: Platform Adapters

- Feishu 适配器
- WeChat 适配器
- 输出格式转换

### 10.2 Phase 6: 配置系统完善

- 项目级配置
- 人设热加载
- 日志系统

### 10.3 功能增强

- 客户档案自动生成
- 预测验证追踪
- 多语言支持
- Web UI
