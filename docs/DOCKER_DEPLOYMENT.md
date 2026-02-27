# Karma Docker 部署指南

> 使用 Docker 部署 Karma API 服务的完整指南

---

## 目录

1. [快速开始](#1-快速开始)
2. [配置说明](#2-配置说明)
3. [Dockerfile 详解](#3-dockerfile-详解)
4. [docker-compose.yml 详解](#4-docker-composeyml-详解)
5. [常见问题](#5-常见问题)
6. [运维命令](#6-运维命令)

---

## 1. 快速开始

### 1.1 前置条件

- Docker 或 Colima 已安装
- GLM API Token（或其他兼容 Anthropic SDK 的 API）

### 1.2 一键启动

```bash
# 1. 创建配置文件
cat > config.yaml << EOF
# 服务器配置
server:
  host: "0.0.0.0"
  port: 3080

# AI 配置
ai:
  authToken: "your_token_here"
  baseUrl: "https://open.bigmodel.cn/api/anthropic"
  model: "glm-5"
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
  autoLoad: true

# 日志配置
logging:
  level: info
  file: ~/.karma/logs/karma.log
EOF

# 2. 启动服务
docker compose up -d

# 3. 验证服务
curl http://localhost:3080/health
# 期望输出: {"status":"ok","service":"karma-api"}
```

---

## 2. 配置说明

### 2.1 配置优先级

```
配置文件 > 默认值
```

**说明：**
- 配置文件是主要配置源
- 配置文件中可使用 `${ENV_VAR:default}` 语法引用环境变量
- 例如：`authToken: ${ANTHROPIC_AUTH_TOKEN:}` 表示：
  - 如果 `ANTHROPIC_AUTH_TOKEN` 环境变量存在，使用它
  - 否则使用空字符串
- 命令行参数 `--host` / `--port` 可以覆盖配置文件

### 2.2 配置文件

配置文件路径（按优先级）：
1. `./config.yaml` - 当前目录
2. `~/.karma/config.yaml` - 用户主目录

```yaml
# 服务器配置
server:
  host: "0.0.0.0"    # 监听地址
  port: 3080         # 监听端口

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
  autoLoad: true

# 日志配置
logging:
  level: info
  file: ~/.karma/logs/karma.log
```

### 2.3 环境变量

| 变量名 | 对应配置 | 默认值 | 说明 |
|--------|----------|--------|------|
| `ANTHROPIC_AUTH_TOKEN` | `ai.authToken` | - | API 认证 Token |
| `ANTHROPIC_BASE_URL` | `ai.baseUrl` | `https://api.anthropic.com` | API 基础 URL |
| `ANTHROPIC_MODEL` | `ai.model` | `claude-sonnet-4-5-20250929` | 使用的模型 |
| `KARMA_SERVER_HOST` | `server.host` | `0.0.0.0` | 监听地址 |
| `KARMA_SERVER_PORT` | `server.port` | `3080` | 监听端口 |

### 2.4 Docker 环境变量示例

```env
# .env 文件
ANTHROPIC_AUTH_TOKEN=your_token_here
ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic
ANTHROPIC_MODEL=glm-5
KARMA_SERVER_HOST=0.0.0.0
KARMA_SERVER_PORT=3080
```

---

## 3. Dockerfile 详解

### 3.1 完整 Dockerfile

```dockerfile
# Karma Dockerfile
# Multi-stage build for production deployment

# Stage 1: Build
FROM node:20-alpine AS builder

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ git

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Stage 2: Production
FROM node:20-alpine AS production

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config
COPY --from=builder /app/skills ./skills

# Create non-root user for security
# 重要：必须使用非 root 用户，否则 CLI 会拒绝 --dangerously-skip-permissions
RUN addgroup -g 1001 -S karma && \
    adduser -S -D -H -u 1001 -h /home/karma -s /sbin/nologin -G karma -g karma karma && \
    mkdir -p /home/karma/.karma && \
    chown -R karma:karma /home/karma

# Create data directory for SQLite and set permissions
RUN mkdir -p /data && \
    chown -R karma:karma /app /data

# Set environment variables
ENV NODE_ENV=production
ENV HOME=/home/karma

# Expose port
EXPOSE 3080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3080/health || exit 1

# Switch to non-root user
USER karma

# Run the server
CMD ["node", "dist/index.js", "server"]
```

### 3.2 关键设计决策

#### 为什么需要非 root 用户？

`@anthropic-ai/claude-agent-sdk` 包含内置的 `cli.js`，SDK 会自动 spawn 这个 CLI 作为子进程。但 CLI 有安全限制：

```
--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons
```

因此必须创建非 root 用户运行容器。

#### 为什么用 Alpine Linux？

- 镜像体积小（~200MB vs ~1GB）
- 适合生产环境
- 需要额外安装 `python3 make g++` 用于 `better-sqlite3` 原生模块

---

## 4. docker-compose.yml 详解

### 4.1 完整配置

```yaml
services:
  karma:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: karma-api
    restart: unless-stopped
    ports:
      - "3080:3080"
    environment:
      # GLM API 配置
      - ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}
      - ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL:-https://open.bigmodel.cn/api/anthropic}
      - ANTHROPIC_MODEL=${ANTHROPIC_MODEL:-glm-5}
      # 存储路径 (容器内) - 必须与非 root 用户的 HOME 一致
      - HOME=/home/karma
    volumes:
      # 持久化数据库 - 路径必须与 HOME/.karma 一致
      - karma-data:/home/karma/.karma
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  karma-data:
    driver: local
```

### 4.2 关键配置说明

| 配置项 | 说明 |
|--------|------|
| `HOME=/home/karma` | 必须与 Dockerfile 中创建的用户 HOME 一致 |
| `volumes: karma-data:/home/karma/.karma` | 持久化数据库，路径基于 HOME |
| `restart: unless-stopped` | 自动重启策略 |

---

## 5. 常见问题

### 5.1 CLI 退出码 1

**错误信息：**
```
Error: Claude Code process exited with code 1
```

**原因：** 容器以 root 用户运行

**解决方案：** 确保 Dockerfile 中有 `USER karma` 且 docker-compose.yml 中 `HOME=/home/karma`

### 5.2 数据库只读

**错误信息：**
```
attempt to write a readonly database
```

**原因：** 卷权限问题

**解决方案：**
```bash
# 删除旧卷重新创建
docker compose down -v
docker compose up -d
```

### 5.3 无法连接到服务

**可能原因：**
1. Colima 未运行 - 运行 `colima start`
2. 端口被占用 - 检查 `lsof -i :3080`
3. 代理干扰 - 见下方解决方案

**代理干扰解决方案：**

方式一：临时绕过（推荐）
```bash
curl --noproxy '*' http://localhost:3080/health
```

方式二：配置环境变量（永久）
```bash
# 添加到 ~/.zshrc 或 ~/.bashrc
export NO_PROXY=localhost,127.0.0.1,0.0.0.0
export no_proxy=localhost,127.0.0.1,0.0.0.0
```

方式三：curl 配置文件
```bash
# 创建 ~/.curlrc
echo "noproxy = localhost,127.0.0.1,0.0.0.0" >> ~/.curlrc
```

### 5.4 SDK 找不到 CLI

**错误信息：**
```
Claude Code executable not found
```

**说明：** SDK 自带 `cli.js`（约 11MB），无需外部安装 `claude` CLI

**验证：**
```bash
docker exec karma-api ls -la /app/node_modules/@anthropic-ai/claude-agent-sdk/cli.js
```

---

## 6. 运维命令

### 6.1 日常操作

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 查看日志
docker compose logs -f

# 查看状态
docker compose ps

# 重启服务
docker compose restart
```

### 6.2 更新部署

```bash
# 拉取最新代码后重新构建
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 6.3 数据备份

```bash
# 导出数据卷
docker run --rm -v karma_karma-data:/data -v $(pwd):/backup alpine tar czf /backup/karma-backup.tar.gz /data

# 恢复数据卷
docker run --rm -v karma_karma-data:/data -v $(pwd):/backup alpine tar xzf /backup/karma-backup.tar.gz -C /
```

### 6.4 健康检查

```bash
# 检查服务状态
curl http://localhost:3080/health

# 测试聊天 API
curl -X POST http://localhost:3080/api/session \
  -H "Content-Type: application/json" \
  -d '{"userId": "test"}'

curl -X POST http://localhost:3080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "session_xxx", "message": "你好"}'
```

---

## 附录：启动脚本

创建 `start.sh` 简化操作：

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"

case "${1:-up}" in
  up)
    docker compose up -d
    echo "✅ 服务已启动: http://localhost:3080"
    echo "📋 查看日志: ./start.sh logs"
    ;;
  down)
    docker compose down
    ;;
  logs)
    docker compose logs -f
    ;;
  restart)
    docker compose restart
    ;;
  rebuild)
    docker compose down
    docker compose build --no-cache
    docker compose up -d
    ;;
  status)
    docker compose ps
    ;;
  *)
    echo "用法: $0 {up|down|logs|restart|rebuild|status}"
    exit 1
    ;;
esac
```

---

*最后更新: 2026-02-25*
