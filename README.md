# Karma - AI 命理师 Agent

> 基于 Claude Agent SDK 的智能命理咨询系统

---

## 项目状态

✅ **Phase 7 完成** | **368 tests passing (100%)**

核心功能：
- ✅ 数据闭环（自动提取客户信息、事实、预测）
- ✅ Persona 系统（SOUL.md + 历史微调）
- ✅ 八字排盘工具
- ✅ 飞书多平台支持

详见：[docs/CURRENT_STATUS.md](docs/CURRENT_STATUS.md)

---

## 项目简介

Karma 是一个模块化的 AI 命理师 Agent，支持多平台部署（CLI、飞书），提供真实的命理咨询服务体验。

**核心特性**：
- 🎭 **多轮对话** - 支持完整的算命对话流程
- 💾 **数据闭环** - 自动保存消息、提取客户信息、记录事实和预测
- 🎭 **Persona 系统** - SOUL.md 人设 + 客户个性化微调
- 🔮 **八字排盘** - 集成 lunar-javascript，支持四柱/大运/流年
- 🔌 **多平台支持** - CLI + 飞书
- 📚 **Skills 系统** - 可扩展的知识库
- 🔧 **模块化 Prompt** - 可配置的 System Prompt

---

## 快速开始

### Docker 部署（推荐）

前置要求：Colima 或 Docker Desktop

#### 生产环境

```bash
# 1. 创建 .env 文件
cp .env.example .env
# 编辑 .env 填写实际值

# 2. 创建配置文件
cp config.example.yaml config.yaml

# 3. 启动服务
./start.sh up

# 4. 查看状态
./start.sh status

# 5. 查看日志
./start.sh logs
```

服务启动后访问 http://localhost:3080

#### 测试环境

测试环境与生产环境完全隔离：
- 端口：3004（vs 3080）
- 数据库：karma-test-data（vs karma-data）
- 配置：config.test.yaml（vs config.yaml）

```bash
# 1. 创建测试环境变量
cp .env.test.example .env.test
# 编辑 .env.test 填写实际值

# 2. 创建测试配置
cp config.test.example.yaml config.test.yaml

# 3. 启动测试服务
docker-compose -f docker-compose.test.yml --env-file .env.test up -d

# 4. 查看日志
docker-compose -f docker-compose.test.yml logs -f
```

测试服务访问 http://localhost:3004

#### 环境对比

| 项目 | 生产环境 | 测试环境 |
|------|---------|---------|
| 端口 | 3080 | 3004 |
| Volume | karma-data | karma-test-data |
| 配置文件 | config.yaml | config.test.yaml |
| 环境变量 | .env | .env.test |
| 容器名 | karma-api | karma-api-test |

两个环境可同时运行，互不干扰。

### 本地开发

```bash
pnpm install

# 配置
mkdir -p ~/.karma
cat > ~/.karma/config.yaml << 'EOF'
ai:
  authToken: ${ANTHROPIC_AUTH_TOKEN:}
  baseUrl: ${ANTHROPIC_BASE_URL:https://api.anthropic.com}
  model: ${ANTHROPIC_MODEL:claude-sonnet-4-5-20250929}
  timeout: 300000

storage:
  path: ~/.karma/karma.db

skills:
  dirs:
    - ~/.karma/skills
    - ./.karma/skills
EOF

# 运行
pnpm dev
```

---

## 项目架构

```
karma/
├── src/
│   ├── index.ts              # CLI 入口
│   ├── agent/
│   │   ├── runner.ts         # Agent Runner（消息持久化 + 信息提取）
│   │   ├── info-extractor.ts # 从输出提取结构化信息
│   │   └── monologue-filter.ts
│   ├── api/                  # HTTP API 服务器
│   │   └── server.ts
│   ├── config/               # YAML 配置加载
│   ├── logger/               # Pino 日志系统
│   ├── output/               # 输出适配器
│   │   └── adapters/
│   │       ├── cli.ts
│   │       └── feishu.ts
│   ├── persona/              # 人设服务
│   │   ├── service.ts        # PersonaService
│   │   └── history-extractor.ts
│   ├── platform/             # 平台适配器
│   │   └── adapters/
│   │       ├── feishu/       # 飞书 WebSocket
│   │       └── http/         # HTTP API
│   ├── prompt/               # System Prompt 构建
│   │   └── parts/            # 7 个模块化部分
│   ├── session/              # 会话管理
│   ├── skills/               # Skills 加载器
│   ├── storage/              # SQLite 存储
│   │   ├── service.ts        # 22 个 CRUD 方法
│   │   └── schema.ts         # 5 张表定义
│   ├── tools/                # 命理专用工具
│   │   ├── bazi-calculator.ts
│   │   └── registry.ts
│   └── types/                # 类型定义
├── skills/
│   ├── methodology/SKILL.md
│   ├── psychology/SKILL.md
│   └── examples/SKILL.md
└── tests/                    # 365 tests
```

---

## 核心功能

### 1. 数据闭环

每轮对话自动：
- 保存用户/助手消息到 `messages` 表
- 提取 `<client_info>` 创建/更新客户档案
- 提取 `<confirmed_fact>` 记录确认事实
- 提取 `<prediction>` 记录预测

```xml
<!-- Agent 输出中的结构化标签（用户看不到） -->
<client_info>
姓名：张三
性别：男
生辰：1990年5月15日早上6点
出生地：北京
</client_info>

<confirmed_fact category="career">目前在互联网公司工作</confirmed_fact>

<prediction year="2025">下半年有晋升机会</prediction>
```

### 2. Persona 系统

- `SOUL.md` 定义人设（可选，有默认值）
- 老客户自动注入个性化微调（"这是第 N 次来咨询的老客户"）
- 客户档案注入 System Prompt

### 3. 八字排盘

```typescript
import { calculateBazi, formatBaziResult } from '@/tools/index.js';

const result = await calculateBazi({
  birthDate: '1990-05-15T06:00:00',
  gender: 'male',
});

console.log(formatBaziResult(result));
// 年柱：庚午
// 月柱：辛巳
// 日柱：甲寅
// 时柱：丁卯
// 大运：...
```

---

## 数据模型

```
clients          # 客户档案
├── id
├── name, gender
├── birthDate, birthPlace
├── baziSummary
└── sessionCount

sessions         # 会话
├── id
├── clientId
├── sdkSessionId
└── platform

messages         # 对话消息
├── id
├── sessionId
├── role (user/assistant)
└── content

confirmed_facts  # 确认事实
├── id
├── clientId
├── fact
└── category

predictions      # 预测
├── id
├── clientId
├── prediction
├── targetYear
└── status
```

---

## 测试统计

```
Test Files  28 passed
Tests       368 passed
Duration    ~2s
```

覆盖模块：
- Agent: 90 tests (消息持久化、信息提取、Persona 集成)
- Integration: 51 tests
- Prompt: 51 tests
- Skills: 39 tests
- Storage: 35 tests
- Platform: 30 tests
- Session: 24 tests
- Persona: 17 tests
- Output: 11 tests
- Tools: 10 tests (八字排盘)
- Logger: 10 tests

---

## 技术栈

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **AI SDK**: @anthropic-ai/claude-agent-sdk
- **Database**: better-sqlite3 + drizzle-orm
- **Test**: Vitest
- **Config**: YAML
- **Logging**: Pino
- **Feishu SDK**: @larksuiteoapi/node-sdk
- **Bazi**: lunar-javascript

---

## Skills 知识库

| Skill | 说明 |
|-------|------|
| methodology | 双引擎方法论 - 时间线重建 + 心理冷读 |
| psychology | 心理冷读库 - 人生阶段锚点图谱 |
| examples | 真实对话范例 - 高水平命理对话 |

---

## 开发

```bash
# 运行测试
pnpm test

# 测试覆盖率
pnpm test:coverage

# 开发模式
pnpm dev
```

---

## 文档

- **[CURRENT_STATUS.md](docs/CURRENT_STATUS.md)** - 项目当前状态（推荐先看）
- [architecture.md](docs/architecture.md) - 完整架构设计
- [docs/README.md](docs/README.md) - 文档索引

---

## License

MIT
