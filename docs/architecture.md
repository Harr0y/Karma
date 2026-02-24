# Karma-V3 架构设计

> 基于 Claude Agent SDK，融合 Alma 和 pi-mono 的优秀设计模式

---

## 实现状态 (2026-02-24) - Phase 7 完成

| 模块 | 状态 | 说明 |
|------|------|------|
| Skills Loader | ✅ 完成 | loadSkills + formatSkillsForPrompt |
| System Prompt Builder | ✅ 完成 | 9 parts 模块化构建 |
| Client Profile | ✅ 完成 | SQLite 持久化 + 5 张表 |
| Session Manager | ✅ 完成 | 内存缓存 + 数据库持久化 |
| Config System | ✅ 完成 | YAML + 环境变量 |
| MonologueFilter | ✅ 完成 | 流式过滤 inner_monologue |
| Agent Runner | ✅ 完成 | 消息持久化 + 信息提取 |
| Info Extractor | ✅ 完成 | client_info/fact/prediction 提取 |
| History Extractor | ✅ 完成 | 客户特征提取 + 微调生成 |
| Persona Manager | ✅ 完成 | SOUL.md + 历史微调 + 客户档案 |
| 八字排盘工具 | ✅ 完成 | lunar-javascript 集成 |
| Platform Adapters | ✅ 完成 | CLI + 飞书 WebSocket |
| Output Adapter | ✅ 完成 | MonologueFilter + 平台适配 |
| 测试系统 | ✅ 完成 | 365 tests (100% passing) |

---

## 测试状态

```
Test Files  28 passed (28)
Tests       365 passed (365)
Duration    ~2s
```

**所有测试通过** ✅

详见：[CURRENT_STATUS.md](./CURRENT_STATUS.md)

---

# Karma-V2 重构架构设计

> 基于 Claude Agent SDK，融合 Alma 和 pi-mono 的优秀设计模式

---

## 一、设计目标

### 1.1 核心原则

1. **可扩展性优先** - Skills/Prompts/工具可动态加载，无需改代码
2. **持久化客户档案** - 记住每个客户的八字、历史、预测
3. **多平台支持** - 统一 Agent 核心 + 平台适配器
4. **简洁清晰** - 每个模块职责单一

### 1.2 借鉴来源

| 来源 | 借鉴内容 |
|------|----------|
| **Claude Agent SDK** | 核心 Agent 调用、会话管理、MCP 集成、Hooks |
| **Alma** | SQLite 持久化、向量记忆、多 Provider、细粒度权限 |
| **pi-mono** | Skills 索引注入、Prompt Templates、模块化 System Prompt |

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Platform Adapters                          │
│                 CLI │ Feishu │ WeChat (未来)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      Karma Orchestrator                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │  Session      │  │  Client       │  │  Persona          │   │
│  │  Manager      │  │  Profile      │  │  Manager          │   │
│  └───────────────┘  └───────────────┘  └───────────────────┘   │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │  Skills       │  │  Prompts      │  │  Output           │   │
│  │  Loader       │  │  Builder      │  │  Adapter          │   │
│  └───────────────┘  └───────────────┘  └───────────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    Claude Agent SDK                             │
│         query() + resume + mcpServers + hooks                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                      Storage Layer                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │  SQLite       │  │  Skills       │  │  Prompts          │   │
│  │  (档案/会话)   │  │  (.md files)  │  │  (.md files)      │   │
│  └───────────────┘  └───────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、核心模块设计

### 3.1 Skills 系统 (参考 pi-mono)

**设计原则**: 文件系统驱动 + 索引注入到 System Prompt

#### 3.1.1 文件结构

```
~/.karmav2/skills/                 # 全局 Skills
├── cold-reading/
│   └── SKILL.md
├── bazi/
│   └── SKILL.md
├── psychology/
│   └── SKILL.md
└── reframe/
    └── SKILL.md

{project}/.karma/skills/           # 项目 Skills (可选)
├── local-custom/
│   └── SKILL.md
```

#### 3.1.2 SKILL.md 格式

```markdown
---
name: cold-reading
description: 心理冷读技术 - 根据年龄阶段进行高命中率推断
disable-model-invocation: false
---

# 心理冷读技能

## 12 阶段断言速查表

| 年龄段 | 阶段 | 核心关切 | 高命中断言 |
|-------|------|---------|----------|
| 15-18 | 高中生 | 学业 | ... |
| 18-22 | 大学生 | 方向感 | ... |
...
```

#### 3.1.3 Skills 加载器

```typescript
// src/skills/loader.ts

export interface Skill {
  name: string;
  description: string;
  filePath: string;
  content: string;
  disableModelInvocation: boolean;
}

export function loadSkills(options: {
  globalDir?: string;    // ~/.karmav2/skills/
  projectDir?: string;   // {cwd}/.karma/skills/
}): Skill[] {
  // 扫描目录，解析 frontmatter，返回 Skills 列表
}

export function formatSkillsForPrompt(skills: Skill[]): string {
  // 只注入索引，不注入内容
  // 类似 pi-mono 的做法
  return `
The following skills provide specialized instructions.
Use the Read tool to load a skill's file when needed.

<available_skills>
  <skill>
    <name>cold-reading</name>
    <description>心理冷读技术</description>
    <location>/path/to/skills/cold-reading/SKILL.md</location>
  </skill>
</available_skills>
`;
}
```

### 3.2 Prompts 系统 (参考 pi-mono)

**设计原则**: 模板 + 参数替换，用户可通过 `/template args` 触发

#### 3.2.1 文件结构

```
~/.karmav2/prompts/               # 全局模板
├── daily-fortune.md
├── marriage.md
└── career.md

{project}/.karma/prompts/         # 项目模板
└── custom.md
```

#### 3.2.2 模板格式

```markdown
---
description: 每日运势简批
---

请为 $1 年 $2 月 $3 日出生的 $4 性客人分析今日运势。
```

#### 3.2.3 模板引擎

```typescript
// src/prompts/builder.ts

export interface PromptTemplate {
  name: string;
  description: string;
  content: string;
  filePath: string;
}

export function expandTemplate(template: PromptTemplate, args: string[]): string {
  // 支持 $1, $2, ... 位置参数
  // 支持 $@ / $ARGUMENTS 所有参数
  return template.content
    .replace(/\$(\d+)/g, (_, n) => args[n - 1] || '')
    .replace(/\$@/g, args.join(' '));
}
```

### 3.3 System Prompt Builder (模块化)

**设计原则**: 组合式构建，每个部分独立可配置

```typescript
// src/prompt/builder.ts

export interface SystemPromptContext {
  now: Date;
  clientProfile?: ClientProfile;
  skills: Skill[];
  platform: 'cli' | 'feishu' | 'wechat';
  personaConfig?: PersonaConfig;
}

export function buildSystemPrompt(context: SystemPromptContext): string {
  const parts: string[] = [];

  // 1. 时间锚点 (必须)
  parts.push(buildTimeAnchor(context.now));

  // 2. 人设 (可从 SOUL.md 加载)
  parts.push(buildPersona(context.personaConfig));

  // 3. 八字框架 (核心方法)
  parts.push(buildBaziFramework());

  // 4. 冷读引擎
  parts.push(buildColdReadingEngine());

  // 5. Skills 索引 (动态)
  parts.push(formatSkillsForPrompt(context.skills));

  // 6. 客户档案 (如果有)
  if (context.clientProfile) {
    parts.push(formatClientProfile(context.clientProfile));
  }

  // 7. 平台规则
  parts.push(buildPlatformRules(context.platform));

  // 8. 工具使用指南
  parts.push(buildToolGuidelines());

  // 9. 输出格式规则
  parts.push(buildOutputRules());

  return parts.join('\n\n');
}
```

### 3.4 客户档案系统 (参考 Alma)

**设计原则**: SQLite 持久化，支持历史会话和预测追踪

#### 3.4.1 数据库 Schema

```typescript
// src/storage/schema.ts

// 客户档案
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),

  // 基本信息
  name: text('name'),
  gender: text('gender'),           // 'male' | 'female'
  birthDate: text('birth_date'),    // 公历
  birthDateLunar: text('birth_date_lunar'),
  birthPlace: text('birth_place'),
  currentCity: text('current_city'),

  // 八字/命理信息
  baziSummary: text('bazi_summary'),
  zodiacWestern: text('zodiac_western'),
  zodiacChinese: text('zodiac_chinese'),
  personaArchetype: text('persona_archetype'),
  coreElements: text('core_elements', { mode: 'json' }),

  // 元数据
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  sessionCount: integer('session_count').default(1),
});

// 会话记录
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  sdkSessionId: text('sdk_session_id'),    // Claude SDK session_id

  platform: text('platform'),              // 'cli' | 'feishu' | 'wechat'
  externalChatId: text('external_chat_id'),

  status: text('status').default('active'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),

  summary: text('summary'),
  keyPredictions: text('key_predictions', { mode: 'json' }),
});

// 确认/否认的事实
export const confirmedFacts = sqliteTable('confirmed_facts', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  sessionId: text('session_id').references(() => sessions.id),

  fact: text('fact').notNull(),
  category: text('category'),    // 'career' | 'marriage' | 'health' | 'family'
  confirmed: integer('confirmed', { mode: 'boolean' }),

  originalPrediction: text('original_prediction'),
  clientResponse: text('client_response'),
  reframe: text('reframe'),      // 转义话术
});

// 预测记录
export const predictions = sqliteTable('predictions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  sessionId: text('session_id').references(() => sessions.id),

  prediction: text('prediction').notNull(),
  targetYear: integer('target_year'),
  category: text('category'),
  status: text('status').default('pending'), // 'pending' | 'confirmed' | 'denied' | 'expired'

  createdAt: text('created_at').notNull(),
  verifiedAt: text('verified_at'),
});

// 消息记录
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),

  role: text('role').notNull(),    // 'user' | 'assistant'
  content: text('content').notNull(),
  rawContent: text('raw_content'),  // 包含 inner_monologue

  toolCalls: text('tool_calls', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});
```

#### 3.4.2 Storage Service

```typescript
// src/storage/service.ts

export class StorageService {
  // 客户管理
  async getOrCreateClient(birthInfo: BirthInfo): Promise<Client>;
  async updateClient(id: string, data: Partial<Client>): Promise<void>;

  // 会话管理
  async createSession(clientId: string, platform: string): Promise<Session>;
  async getSession(id: string): Promise<Session | null>;
  async updateSdkSessionId(sessionId: string, sdkSessionId: string): Promise<void>;

  // 档案管理
  async addConfirmedFact(fact: ConfirmedFact): Promise<void>;
  async getClientFacts(clientId: string): Promise<ConfirmedFact[]>;
  async addPrediction(prediction: Prediction): Promise<void>;
  async getClientPredictions(clientId: string): Promise<Prediction[]>;

  // 生成 System Prompt 用的客户档案
  async generateClientProfilePrompt(clientId: string): Promise<string>;
}
```

### 3.5 Session Manager

**设计原则**: 基于 SDK resume 能力，管理多平台会话

```typescript
// src/session/manager.ts

export class SessionManager {
  private storage: StorageService;
  private activeSessions: Map<string, ActiveSession>;

  async getOrCreateSession(context: {
    platform: 'cli' | 'feishu' | 'wechat';
    externalChatId?: string;
    userInfo?: { name?: string; id?: string };
  }): Promise<ActiveSession> {
    // 1. 尝试从内存缓存获取
    // 2. 尝试从数据库恢复
    // 3. 创建新会话
  }

  async saveSession(session: ActiveSession): Promise<void> {
    // 持久化 sdkSessionId 和状态
  }
}

interface ActiveSession {
  id: string;
  clientId?: string;
  sdkSessionId?: string;
  platform: string;
  externalChatId?: string;
  startedAt: Date;
}
```

### 3.6 Output Adapter (平台适配)

**设计原则**: 统一的消息处理 + 平台特定输出

```typescript
// src/output/adapter.ts

export interface OutputMessage {
  type: 'text' | 'tool_use' | 'tool_result' | 'status' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface OutputAdapter {
  send(message: OutputMessage): Promise<void>;
  sendBatch(messages: OutputMessage[]): Promise<void>;
}

// CLI 适配器
export class CLIOutputAdapter implements OutputAdapter {
  send(msg: OutputMessage): Promise<void> {
    // 直接 console.log，支持 ANSI 颜色
  }
}

// Feishu 适配器
export class FeishuOutputAdapter implements OutputAdapter {
  private chatId: string;
  private sender: FeishuSender;

  send(msg: OutputMessage): Promise<void> {
    // 1. 过滤 inner_monologue (已在 SDK 层处理)
    // 2. 转换 Markdown 为 Feishu 卡片
    // 3. 节流发送
  }
}
```

---

## 四、配置系统

### 4.1 配置文件

```
~/.karmav2/
├── config.yaml           # 主配置
├── SOUL.md               # 人设配置 (参考 pi-mono)
├── skills/               # 全局 Skills
│   └── */SKILL.md
└── prompts/              # 全局 Prompt 模板
    └── *.md

{project}/.karma/
├── config.yaml           # 项目配置
├── AGENTS.md             # 项目上下文
├── skills/               # 项目 Skills
└── prompts/              # 项目 Prompts
```

### 4.2 配置格式

```yaml
# ~/.karmav2/config.yaml

# AI 配置
ai:
  provider: anthropic     # anthropic | glm | openai
  model: claude-sonnet-4-5-20250929

# 存储配置
storage:
  type: sqlite
  path: ~/.karmav2/karma.db

# Skills 配置
skills:
  dirs:
    - ~/.karmav2/skills
  autoLoad: true

# 人设配置
persona:
  path: ~/.karmav2/SOUL.md

# 平台配置
platforms:
  cli:
    enabled: true
  feishu:
    enabled: true
    appId: ${FEISHU_APP_ID}
    appSecret: ${FEISHU_APP_SECRET}

# 日志配置
logging:
  dir: ~/.karmav2/logs
  level: info
  includeMonologue: true   # 记录 inner_monologue
```

### 4.3 SOUL.md 人设配置

```markdown
---
name: 师傅
title: 命理师
experience: 三十年
---

# 你的身份

你是一位有三十年经验的命理师，精通八字...

## 性格与语气
- 像朋友聊天，不端着
- 多段短消息节奏
...
```

---

## 五、SDK 集成

### 5.1 核心 Query 封装

```typescript
// src/agent/client.ts

import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export interface KarmaQueryOptions {
  userMessage: string;
  session: ActiveSession;
  clientProfile?: ClientProfile;
  skills: Skill[];
  platform: 'cli' | 'feishu' | 'wechat';
}

export async function* karmaQuery(
  options: KarmaQueryOptions
): AsyncGenerator<SDKMessage> {
  const { userMessage, session, clientProfile, skills, platform } = options;

  // 构建 System Prompt
  const systemPrompt = buildSystemPrompt({
    now: new Date(),
    clientProfile,
    skills,
    platform,
  });

  // 配置 MCP 服务器
  const mcpServers = {
    'feishu-tools': createFeishuMcpServer(session.externalChatId),
  };

  // 调用 SDK
  const q = query({
    prompt: userMessage,
    options: {
      cwd: Config.getWorkspaceDir(),
      model: Config.getModel(),
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,

      systemPrompt,
      resume: session.sdkSessionId,
      mcpServers,

      // 加载项目设置 (Skills)
      settingSources: ['project'],

      // 环境变量
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: Config.getApiKey(),
      },
    },
  });

  // 流式返回
  for await (const msg of q) {
    // 捕获 session_id
    if ('session_id' in msg && msg.session_id) {
      session.sdkSessionId = msg.session_id;
    }

    yield msg;
  }
}
```

### 5.2 MCP 工具

```typescript
// src/mcp/feishu-tools.ts

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

export function createFeishuMcpServer(chatId: string) {
  return createSdkMcpServer({
    name: 'feishu-tools',
    version: '1.0.0',
    tools: [
      tool(
        'send_user_feedback',
        'Send a message to the user in Feishu',
        {
          content: z.string().describe('Message content'),
          format: z.enum(['text', 'markdown']).optional(),
        },
        async (args) => {
          await feishuSender.send(chatId, args.content, args.format);
          return { content: [{ type: 'text', text: 'Message sent' }] };
        }
      ),

      tool(
        'send_file_to_feishu',
        'Send a file to the user in Feishu',
        {
          filePath: z.string().describe('Path to the file'),
        },
        async (args) => {
          await feishuFileSender.send(chatId, args.filePath);
          return { content: [{ type: 'text', text: 'File sent' }] };
        }
      ),
    ],
  });
}
```

---

## 六、目录结构

```
karma-v2/
├── src/
│   ├── index.ts              # CLI 入口
│   ├── config/
│   │   ├── index.ts          # 配置加载
│   │   └── types.ts
│   ├── storage/
│   │   ├── schema.ts         # Drizzle schema
│   │   ├── service.ts        # Storage service
│   │   └── migrations.ts
│   ├── skills/
│   │   ├── loader.ts         # Skills 加载器
│   │   └── types.ts
│   ├── prompts/
│   │   ├── builder.ts        # System Prompt 构建
│   │   ├── templates.ts      # 模板加载
│   │   └── parts/            # Prompt 各部分
│   │       ├── persona.ts
│   │       ├── bazi.ts
│   │       ├── cold-reading.ts
│   │       └── ...
│   ├── session/
│   │   └── manager.ts
│   ├── agent/
│   │   ├── client.ts         # SDK 封装
│   │   └── monologue-filter.ts
│   ├── output/
│   │   ├── adapter.ts        # 接口
│   │   ├── cli.ts            # CLI 适配器
│   │   └── feishu.ts         # Feishu 适配器
│   ├── mcp/
│   │   └── feishu-tools.ts
│   └── adapters/
│       ├── cli.ts            # CLI 平台适配
│       └── feishu.ts         # Feishu 平台适配
├── data/
│   └── karma.db              # SQLite 数据库
├── ~/.karmav2/
│   ├── config.yaml
│   ├── SOUL.md
│   ├── skills/
│   ├── prompts/
│   └── logs/
├── package.json
└── tsconfig.json
```

---

## 七、实施计划

### Phase 1: 存储层 (2-3 天)

- [ ] 添加 better-sqlite3 + drizzle-orm
- [ ] 实现 schema (clients, sessions, messages, facts, predictions)
- [ ] 实现 StorageService
- [ ] 数据库迁移

### Phase 2: Skills 系统 (2 天)

- [ ] 实现 Skills 加载器 (参考 pi-mono)
- [ ] 实现 formatSkillsForPrompt
- [ ] 迁移现有 prompt 中的冷读库到 Skills

### Phase 3: System Prompt 模块化 (1-2 天)

- [ ] 拆分 prompt.ts 为多个模块
- [ ] 实现 buildSystemPrompt
- [ ] 支持 SOUL.md 人设配置

### Phase 4: 会话管理 (1-2 天)

- [ ] 实现 SessionManager
- [ ] 集成 SDK resume

### Phase 5: 平台适配器 (2-3 天)

- [ ] 重构 CLI 适配器
- [ ] 实现 Feishu 适配器
- [ ] 实现 Output Adapter

### Phase 6: 配置系统 (1 天)

- [ ] 实现 config.yaml 加载
- [ ] 支持环境变量

---

## 八、与现有实现对比

| 方面 | Karma-V2 (现有) | Karma-V2 (新) |
|------|----------------|---------------|
| **Prompt** | 714 行大函数 | 模块化 + Skills + Templates |
| **状态存储** | `/tmp/karma_state.json` | SQLite 持久化 |
| **客户档案** | 临时 | 完整档案 + 预测追踪 |
| **平台支持** | CLI only | CLI + Feishu |
| **Skills** | 无 | 文件系统 + 索引注入 |
| **人设** | 硬编码 | SOUL.md 可配置 |
| **会话** | SDK 内部管理 | 显式 Session Manager |

---

## 九、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 迁移复杂度高 | 分阶段实施，保持向后兼容 |
| 性能问题 | Skills 索引缓存 + 懒加载 |
| 多平台一致性 | 统一 Output Adapter 接口 |
| 配置复杂 | 合理默认值 + 渐进式配置 |

---

## 十、总结

本架构融合了三个优秀项目的精华：

1. **Claude Agent SDK** - 提供稳定的 Agent 运行时
2. **Alma** - SQLite 持久化、客户档案、多 Provider
3. **pi-mono** - Skills 索引、Prompt Templates、模块化

核心改进：
- 从硬编码 → **可配置 Skills + Templates**
- 从临时文件 → **SQLite 持久化档案**
- 从单一 CLI → **多平台适配器**
- 从单一入口 → **统一 Orchestrator + 平台适配器**
