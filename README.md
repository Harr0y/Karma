# Karma - AI 命理师 Agent

> 基于 Claude Agent SDK 的智能命理咨询系统

---

## 项目简介

Karma 是一个模块化的 AI 命理师 Agent，通过组合式 System Prompt 和 Skills 系统，提供真实的命理咨询服务体验。

**核心特性**：
- 🎭 **多轮对话** - 支持完整的算命对话流程
- 📚 **Skills 系统** - 可扩展的知识库
- 💾 **持久化存储** - 客户档案、会话、事实、预测
- 🔧 **模块化 Prompt** - 可配置的 System Prompt
- 🖥️ **CLI 支持** - 命令行交互界面

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
```

或直接设置环境变量：

```bash
export ANTHROPIC_AUTH_TOKEN="your_token"
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
export ANTHROPIC_MODEL="claude-sonnet-4-5-20250929"
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
│   │   ├── runner.ts         # Agent Runner - 封装 SDK 调用
│   │   ├── monologue-filter.ts # 过滤 inner_monologue
│   │   └── types.ts
│   ├── config/
│   │   ├── loader.ts         # 配置加载器
│   │   └── index.ts
│   ├── prompt/
│   │   ├── builder.ts        # Prompt 组合器
│   │   ├── parts/
│   │   │   ├── persona.ts    # 人设
│   │   │   ├── bazi.ts       # 八字框架
│   │   │   ├── cold-reading.ts # 冷读引擎
│   │   │   ├── platform-rules.ts # 平台规则
│   │   │   ├── time-anchor.ts   # 时间锚点
│   │   │   ├── tool-guidelines.ts
│   │   │   └── output-rules.ts
│   │   └── types.ts
│   ├── session/
│   │   ├── manager.ts        # 会话管理器
│   │   └── types.ts
│   ├── skills/
│   │   ├── loader.ts         # Skills 加载器
│   │   ├── parser.ts         # SKILL.md 解析器
│   │   ├── formatter.ts      # Skills 格式化
│   │   └── types.ts
│   └── storage/
│       ├── service.ts        # 存储服务
│       ├── schema.ts         # 数据库 Schema
│       └── types.ts
├── skills/
│   ├── methodology/SKILL.md  # 双引擎方法论
│   ├── psychology/SKILL.md   # 心理冷读库
│   └── examples/SKILL.md     # 对话范例
├── tests/
│   ├── agent/                # Agent 测试
│   ├── integration/          # 集成测试
│   ├── prompt/               # Prompt 测试
│   ├── session/              # Session 测试
│   ├── skills/               # Skills 测试
│   └── storage/              # Storage 测试
└── docs/
    ├── mvp-plan.md           # MVP 计划
    ├── phase1-storage-tests.md
    ├── phase2-skills-tests.md
    ├── phase3-prompt-tests.md
    └── phase4-session-tests.md
```

---

## 已完成功能

### Phase 1: Storage Layer ✅

- SQLite 持久化存储
- 客户档案管理
- 会话管理
- 确认事实追踪
- 预测记录
- 消息历史

**测试**: 31 个测试通过

### Phase 2: Skills 系统 ✅

- 从目录加载 SKILL.md
- YAML frontmatter 解析
- Skills 索引注入 System Prompt
- 支持禁用特定 Skill

**测试**: 39 个测试通过

### Phase 3: System Prompt ✅

- 组合式 Prompt 构建
- 时间锚点 (zh-CN)
- 人设配置 (默认/文件)
- 八字框架
- 冷读引擎
- 平台规则

**测试**: 32 个测试通过

### Phase 4: Session Manager ✅

- 会话创建/恢复
- 内存缓存
- SDK session_id 管理
- 并发安全

**测试**: 20 个测试通过

### Phase 5: Agent MVP ✅

- MonologueFilter (26 测试)
- AgentRunner (7 测试)
- CLI 入口
- 配置系统

### E2E 测试 ✅

- Agent-vs-Agent 全自动测试
- 两个人设验证 (李婷、张伟)
- 4 轮完整对话

---

## 测试统计

```
Test Files  13 passed
Tests       178 passed
```

---

## 技术栈

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **AI SDK**: @anthropic-ai/claude-agent-sdk
- **Database**: better-sqlite3 + drizzle-orm
- **Test**: Vitest
- **Config**: YAML

---

## 待完成功能

### Phase 5: Platform Adapters

- [ ] Feishu 平台适配器
- [ ] WeChat 平台适配器
- [ ] 输出格式转换 (Markdown → Feishu Card)

### Phase 6: 配置系统完善

- [ ] 项目级配置 (.karma/config.yaml)
- [ ] 人设热加载
- [ ] 日志系统

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

## 配置参考

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

## Agent-vs-Agent 测试

全自动测试框架，模拟真实用户与 Karma 对话：

```bash
# 李婷人设 (28岁教师，婚恋焦虑)
npx tsx tests/e2e/agent-test.ts

# 张伟人设 (34岁程序员，事业关注)
npx tsx tests/e2e/agent-test.ts zhangwei
```

---

## License

MIT
