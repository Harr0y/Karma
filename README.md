# Karma - AI 命理师 Agent

> 基于 Claude Agent SDK 的智能命理咨询系统

---

## 项目简介

Karma 是一个模块化的 AI 命理师 Agent，支持多平台部署（CLI、飞书、Discord、Telegram），提供真实的命理咨询服务体验。

**核心特性**：
- 🎭 **多轮对话** - 支持完整的算命对话流程
- 🔌 **多平台支持** - CLI + 飞书 + Discord + Telegram
- 📚 **Skills 系统** - 可扩展的知识库
- 💾 **持久化存储** - 客户档案、会话、事实、预测
- 🔧 **模块化 Prompt** - 可配置的 System Prompt
- 🖥️ **消息路由** - 去重、时效检查、Bot 过滤
- ⚡ **输出节流** - 飞书 500ms 节流发送

---

## 快速开始

### 安装

```bash
cd karma
npm install
```

### 配置

创建 `~/.karma/config.yaml`：

```yaml
# AI 配置
ai:
  authToken: ${ANTHROPIC_AUTH_TOKEN:}
  baseUrl: ${ANTHROPIC_BASE_URL:https://api.anthropic.com}
  model: ${ANTHROPIC_MODEL:claude-sonnet-4-5-20250929}
  timeout: 300000

# 存储配置
storage:
  type: sqlite
  path: ~/.karma/karma.db

# Skills 配置
skills:
  dirs:
    - ~/.karma/skills
    - ./skills

# 平台配置
platforms:
  cli:
    enabled: true
  feishu:
    enabled: false
    appId: ${FEISHU_APP_ID}
    appSecret: ${FEISHU_APP_SECRET}
```

### 运行

```bash
npm run dev
```

---

## 项目架构

```
karma/
├── src/
│   ├── index.ts              # CLI 入口
│   ├── agent/
│   │   ├── runner.ts         # Agent Runner
│   │   ├── monologue-filter.ts
│   │   └── types.ts
│   ├── config/
│   │   ├── loader.ts
│   │   └── index.ts
│   ├── platform/             # 多平台支持 (Phase 5)
│   │   ├── types.ts          # PlatformAdapter 接口
│   │   ├── router.ts         # MessageRouter
│   │   └── adapters/
│   │       └── feishu/       # 飞书适配器
│   │           ├── adapter.ts
│   │           └── file-handler.ts
│   ├── output/               # 输出适配器 (Phase 5)
│   │   ├── types.ts
│   │   └── adapters/
│   │       ├── cli.ts        # CLI 输出
│   │       └── feishu.ts     # 飞书输出 (节流)
│   ├── prompt/
│   │   ├── builder.ts
│   │   └── parts/
│   ├── session/
│   │   ├── manager.ts
│   │   └── types.ts          # SessionIdentity + getSessionKey
│   ├── skills/
│   │   ├── loader.ts
│   │   ├── parser.ts
│   │   └── formatter.ts
│   └── storage/
│       ├── service.ts
│       └── schema.ts
├── skills/
│   ├── methodology/SKILL.md
│   ├── psychology/SKILL.md
│   └── examples/SKILL.md
├── tests/
│   ├── agent/
│   ├── integration/
│   ├── output/
│   ├── platform/
│   ├── prompt/
│   ├── session/
│   ├── skills/
│   └── storage/
└── docs/
    ├── architecture.md
    ├── phase5-multi-platform.md
    └── quality-report.md
```

---

## 已完成功能

### Phase 1-4: MVP ✅

| 模块 | 测试 | 状态 |
|------|------|------|
| Storage Layer | 31 | ✅ |
| Skills System | 39 | ✅ |
| System Prompt | 32 | ✅ |
| Session Manager | 20 | ✅ |
| Agent Runner | 33 | ✅ |

### Phase 5: Multi-Platform ✅

| 模块 | 功能 | 测试 |
|------|------|------|
| PlatformAdapter | 统一接口 | - |
| MessageRouter | 去重、时效、Bot过滤 | 8 |
| OutputAdapter | CLI + Feishu (节流) | 12 |
| FeishuAdapter | WebSocket Bot | 4 |
| FeishuFileHandler | 图片/文件/音频 | - |
| Session 复合键 | platform:chatId | - |

### E2E 测试 ✅

- Agent-vs-Agent 全自动测试
- 两个人设验证 (李婷、张伟)
- 4 轮完整对话

---

## 测试统计

```
Test Files  17 passed
Tests       207 passed
Duration    ~5s
```

---

## 技术栈

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **AI SDK**: @anthropic-ai/claude-agent-sdk
- **Database**: better-sqlite3 + drizzle-orm
- **Test**: Vitest
- **Config**: YAML
- **Feishu SDK**: @larksuiteoapi/node-sdk

---

## 多平台架构

### MessageRouter

```typescript
const router = new MessageRouter();

router.onMessage(async (message) => {
  // 处理消息
});

await router.route(message); // 自动去重、时效检查
```

### OutputAdapter (节流)

```typescript
// Feishu 500ms 节流
const adapter = new FeishuOutputAdapter(chatId, feishuAdapter, {
  throttleMs: 500
});

await adapter.write({ type: 'text', text: 'hello' });
await adapter.flush(); // 发送缓冲内容
```

### Session 复合键

```typescript
// 复合键格式: "platform:chatId"
const key = getSessionKey({ platform: 'feishu', chatId: 'chat-001' });
// => "feishu:chat-001"
```

---

## 待完成功能

### Phase 6: 配置系统完善

- [ ] 日志系统
- [ ] 项目级配置
- [ ] 人设热加载

### Phase 7: Discord/Telegram

- [ ] Discord Adapter
- [ ] Telegram Adapter

### 功能增强

- [ ] 客户档案自动生成
- [ ] 预测验证追踪
- [ ] 多语言支持
- [ ] Web UI

---

## Skills 知识库

| Skill | 说明 |
|-------|------|
| methodology | 双引擎方法论 - 时间线重建 + 心理冷读 |
| psychology | 心理冷读库 - 人生阶段锚点图谱 |
| examples | 真实对话范例 - 高水平命理对话 |

添加新 Skill：

```bash
mkdir -p skills/my-skill
cat > skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: 我的技能
disable-model-invocation: false
---

# 技能内容...
EOF
```

---

## 开发

```bash
# 运行测试
npm test

# 测试覆盖率
npm run test:coverage

# 类型检查
npm run build

# 开发模式
npm run dev
```

---

## 文档

- [architecture.md](docs/architecture.md) - 完整架构设计
- [phase5-multi-platform.md](docs/phase5-multi-platform.md) - 多平台设计
- [quality-report.md](docs/quality-report.md) - 质量报告

---

## License

MIT
