# Karma 用户指南

> 快速上手 Karma AI 命理师

---

## 目录

1. [快速开始](#快速开始)
2. [配置说明](#配置说明)
3. [使用方法](#使用方法)
4. [常见问题](#常见问题)
5. [最佳实践](#最佳实践)
6. [故障排查](#故障排查)

---

## 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/Harr0y/Karma.git
cd Karma

# 安装依赖
pnpm install
```

### 配置

创建 `~/.karma/config.yaml`：

```yaml
ai:
  authToken: ${ANTHROPIC_AUTH_TOKEN:}
  baseUrl: ${ANTHROPIC_BASE_URL:https://api.anthropic.com}
  model: ${ANTHROPIC_MODEL:claude-sonnet-4-5-20250929}

storage:
  path: ~/.karma/karma.db

skills:
  dirs:
    - ~/.karma/skills
    - ./.claude/skills
```

设置环境变量：

```bash
export ANTHROPIC_AUTH_TOKEN="your-token-here"
```

### 运行

```bash
# CLI 模式
pnpm start

# 服务器模式
karma server --port 3080
```

---

## 配置说明

### AI 配置

```yaml
ai:
  # API Token（必填）
  authToken: ${ANTHROPIC_AUTH_TOKEN:}
  
  # API 地址（可选）
  baseUrl: ${ANTHROPIC_BASE_URL:https://api.anthropic.com}
  
  # 模型选择（可选）
  model: ${ANTHROPIC_MODEL:claude-sonnet-4-5-20250929}
```

**支持的环境变量**：
- `ANTHROPIC_AUTH_TOKEN` - Claude API Token
- `ANTHROPIC_BASE_URL` - 自定义 API 地址
- `ANTHROPIC_MODEL` - 模型选择

**可用模型**：
- `claude-sonnet-4-5-20250929`（推荐）
- `claude-3-5-sonnet-20241022`
- `claude-3-opus-20240229`

---

### 存储配置

```yaml
storage:
  # 数据库路径
  path: ~/.karma/karma.db
```

**数据库结构**：
```
~/.karma/
├── karma.db          # SQLite 数据库
├── config.yaml       # 配置文件
└── skills/           # 自定义 Skills
```

---

### Skills 配置

```yaml
skills:
  dirs:
    - ~/.karma/skills    # 全局 Skills
    - ./.claude/skills   # 项目 Skills
```

**内置 Skills**：
- `methodology` - 双引擎方法论
- `psychology` - 12 阶段断言图谱
- `examples` - 真实对话范例

**自定义 Skills**：
```bash
# 创建自定义 Skill
mkdir -p ~/.karma/skills/my-skill
echo "---\nname: my-skill\ndescription: 我的自定义技能\n---\n\n# 技能内容" > ~/.karma/skills/my-skill/SKILL.md
```

---

## 使用方法

### CLI 模式

```bash
# 启动 CLI
pnpm start

# 或
karma
```

**交互示例**：
```
✦ Karma 命理师 ✦

模型: claude-sonnet-4-5-20250929
API: https://api.anthropic.com

已加载 3 个 Skills: methodology, psychology, examples

师傅:
你好，把生辰时间发给我就行。时间尽量具体，还有性别和出生地。

你: 1990年5月15日早上6点，男，北京

师傅:
嗯，信息有这些就行了。

你这个八字...
```

**命令**：
- 输入 `exit` 或 `退出` - 退出程序
- 输入消息 - 与师傅对话

---

### 服务器模式

```bash
# 启动服务器
karma server --port 3080 --host localhost
```

**API 端点**：
```bash
# 发送消息
POST http://localhost:3080/chat
Content-Type: application/json

{
  "message": "1990年5月15日早上6点，男，北京",
  "sessionId": "optional-session-id"
}

# 响应
{
  "response": "嗯，信息有这些就行了...",
  "sessionId": "session_xxx"
}
```

---

### 飞书模式

**配置飞书机器人**：
1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建应用，获取 App ID 和 App Secret
3. 启用机器人能力
4. 配置 WebSocket 长连接
5. 订阅事件：`im.message.receive_v1`

**配置文件**：
```yaml
feishu:
  appId: cli_xxx
  appSecret: yyy
```

**运行**：
```bash
karma feishu
```

---

## 常见问题

### Q1: 提示 "ANTHROPIC_AUTH_TOKEN 未设置"

**解决方案**：
```bash
# 设置环境变量
export ANTHROPIC_AUTH_TOKEN="sk-ant-xxx"

# 或在配置文件中直接填写
ai:
  authToken: "sk-ant-xxx"
```

---

### Q2: 数据库文件在哪里？

**位置**：`~/.karma/karma.db`

**查看数据**：
```bash
sqlite3 ~/.karma/karma.db

# 查看客户
SELECT * FROM clients;

# 查看消息
SELECT * FROM messages LIMIT 10;

# 查看预测
SELECT * FROM predictions;
```

---

### Q3: 如何清空对话历史？

**方法 1：删除数据库**
```bash
rm ~/.karma/karma.db
```

**方法 2：清空表数据**
```bash
sqlite3 ~/.karma/karma.db
DELETE FROM messages;
DELETE FROM sessions;
DELETE FROM clients;
```

---

### Q4: 响应速度慢怎么办？

**优化方法**：
1. 使用更快的模型（`claude-sonnet-4-5` 最快）
2. 检查网络连接
3. 减少对话历史长度

**性能监控**：
```bash
# 查看日志
tail -f ~/.karma/logs/karma.log

# 检查响应时间
grep "duration" ~/.karma/logs/karma.log
```

---

### Q5: 如何添加自定义 Skills？

**步骤**：
```bash
# 1. 创建 Skill 目录
mkdir -p ~/.karma/skills/my-skill

# 2. 创建 SKILL.md
cat > ~/.karma/skills/my-skill/SKILL.md << EOF
---
name: my-skill
description: 我的自定义技能
disable-model-invocation: false
---

# 技能内容

这里写你的技能描述...
EOF

# 3. 重启 Karma
karma
```

---

## 最佳实践

### 1. 信息收集

**推荐做法**：
- ✅ 第一次对话收集基本信息（生辰、性别、出生地）
- ✅ 逐步深入，不要一次问太多
- ✅ 使用断言引导用户开口

**避免**：
- ❌ 漫无目的的开放式提问
- ❌ 一次问多个问题
- ❌ 过早暴露推理过程

---

### 2. 对话节奏

**推荐**：
```
师傅: 短消息 1
（等待用户回复）

师傅: 短消息 2
（等待用户回复）

师傅: 短消息 3
```

**避免**：
```
师傅: 一大段长文...（用户看不完）
```

---

### 3. 数据管理

**定期备份**：
```bash
# 备份数据库
cp ~/.karma/karma.db ~/.karma/karma.db.backup

# 或导出为 SQL
sqlite3 ~/.karma/karma.db .dump > backup.sql
```

**数据清理**：
```bash
# 删除 30 天前的会话
sqlite3 ~/.karma/karma.db
DELETE FROM sessions WHERE started_at < date('now', '-30 days');
```

---

## 故障排查

### 日志查看

```bash
# 查看日志
tail -f ~/.karma/logs/karma.log

# 查看错误
grep "ERROR" ~/.karma/logs/karma.log

# 查看特定模块
grep "\[agent\]" ~/.karma/logs/karma.log
```

---

### 常见错误

#### 错误 1: "API key not found"

**原因**：未设置 API Token

**解决**：
```bash
export ANTHROPIC_AUTH_TOKEN="your-token"
```

---

#### 错误 2: "Database locked"

**原因**：多个进程同时访问数据库

**解决**：
```bash
# 关闭其他 Karma 进程
pkill karma

# 或重启
```

---

#### 错误 3: "Model not found"

**原因**：模型名称错误

**解决**：
```yaml
ai:
  model: claude-sonnet-4-5-20250929  # 使用正确的模型名称
```

---

### 性能调优

**问题**：响应慢

**诊断**：
```bash
# 检查网络
ping api.anthropic.com

# 检查数据库大小
ls -lh ~/.karma/karma.db

# 检查日志
grep "duration" ~/.karma/logs/karma.log | tail -10
```

**优化**：
1. 清理历史数据
2. 使用更快的模型
3. 添加数据库索引

---

## 获取帮助

### 文档
- [CURRENT_STATUS.md](./CURRENT_STATUS.md) - 项目现状
- [architecture.md](./architecture.md) - 架构设计
- [README.md](../README.md) - 项目说明

### 社区
- GitHub Issues: https://github.com/Harr0y/Karma/issues
- 文档: https://github.com/Harr0y/Karma/tree/main/docs

### 调试模式

```bash
# 启用调试日志
export LOG_LEVEL=debug
karma

# 查看详细日志
tail -f ~/.karma/logs/karma.log | grep DEBUG
```

---

## 更新日志

### 2026-02-19
- ✅ 创建用户指南
- ✅ 添加常见问题
- ✅ 添加最佳实践
