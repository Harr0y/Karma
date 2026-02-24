# Karma 部署指南

> 生产环境部署完整指南

---

## 目录

1. [环境准备](#环境准备)
2. [本地部署](#本地部署)
3. [飞书部署](#飞书部署)
4. [服务器部署](#服务器部署)
5. [监控和日志](#监控和日志)
6. [备份和恢复](#备份和恢复)

---

## 环境准备

### 系统要求

| 组件 | 要求 |
|------|------|
| **操作系统** | macOS / Linux / Windows |
| **Node.js** | >= 18.0.0 |
| **内存** | >= 1GB |
| **磁盘** | >= 500MB |

### 依赖安装

```bash
# 安装 Node.js（推荐使用 nvm）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 安装 pnpm
npm install -g pnpm

# 验证安装
node --version  # v18.x.x
pnpm --version  # 8.x.x
```

---

## 本地部署

### 快速部署

```bash
# 1. 克隆代码
git clone https://github.com/Harr0y/Karma.git
cd Karma

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
export ANTHROPIC_AUTH_TOKEN="your-token-here"

# 4. 运行
pnpm start
```

### 配置文件

创建 `~/.karma/config.yaml`：

```yaml
# AI 配置
ai:
  authToken: ${ANTHROPIC_AUTH_TOKEN:}
  baseUrl: ${ANTHROPIC_BASE_URL:https://api.anthropic.com}
  model: ${ANTHROPIC_MODEL:claude-sonnet-4-5-20250929}

# 存储配置
storage:
  path: ~/.karma/karma.db

# Skills 配置
skills:
  dirs:
    - ~/.karma/skills
    - ./.claude/skills

# 日志配置（可选）
logging:
  level: info  # trace | debug | info | warn | error
  file: ~/.karma/logs/karma.log
```

### 验证部署

```bash
# 运行测试
pnpm test

# 预期结果
Test Files  28 passed (28)
Tests       365 passed (365)

# 启动服务
pnpm start

# 测试对话
# 输入: 1990年5月15日早上6点，男，北京
# 预期: 师傅正常回复
```

---

## 飞书部署

### 1. 创建飞书应用

**步骤**：

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 点击"创建企业自建应用"
3. 填写应用信息：
   - 应用名称：Karma 命理师
   - 应用描述：AI 命理咨询服务
   - 应用图标：上传图标

4. 获取凭证：
   - App ID: `cli_xxxxx`
   - App Secret: `xxxxx`

---

### 2. 配置机器人

**权限配置**：

1. 进入"权限管理"
2. 申请以下权限：
   - `im:chat` - 获取与发送消息
   - `im:chat:readonly` - 读取消息
   - `im:message` - 获取用户 ID

**事件订阅**：

1. 进入"事件订阅"
2. 配置 WebSocket 长连接：
   - 模式：使用长连接接收事件
   - 不需要配置服务器地址

3. 订阅事件：
   - `im.message.receive_v1` - 接收消息

**发布应用**：

1. 进入"版本管理与发布"
2. 创建版本并发布
3. 添加到组织

---

### 3. 配置 Karma

**更新配置文件**：

```yaml
# ~/.karma/config.yaml

ai:
  authToken: ${ANTHROPIC_AUTH_TOKEN:}
  model: claude-sonnet-4-5-20250929

# 飞书配置
feishu:
  appId: cli_xxxxx          # 替换为你的 App ID
  appSecret: xxxxx          # 替换为你的 App Secret

storage:
  path: ~/.karma/karma.db

skills:
  dirs:
    - ~/.karma/skills
    - ./.claude/skills
```

---

### 4. 运行飞书机器人

```bash
# 构建
pnpm build

# 启动飞书模式
karma feishu

# 预期输出
✦ Karma 命理师 ✦

飞书机器人启动中...
WebSocket 连接成功
等待消息...
```

**测试**：
1. 在飞书中找到你的机器人
2. 发送消息："你好"
3. 机器人应该正常回复

---

### 5. PM2 部署（推荐）

**安装 PM2**：
```bash
npm install -g pm2
```

**创建 ecosystem.config.cjs**：
```javascript
module.exports = {
  apps: [{
    name: 'karma-feishu',
    script: 'dist/index.js',
    args: 'feishu',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      ANTHROPIC_AUTH_TOKEN: 'your-token-here',
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
  }]
};
```

**运行**：
```bash
# 构建
pnpm build

# 启动
pm2 start ecosystem.config.cjs

# 查看状态
pm2 status

# 查看日志
pm2 logs karma-feishu

# 停止
pm2 stop karma-feishu

# 重启
pm2 restart karma-feishu
```

---

## 服务器部署

### 云服务器部署

**推荐配置**：
- CPU: 2 核
- 内存: 4GB
- 磁盘: 40GB
- 系统: Ubuntu 22.04

**步骤**：

```bash
# 1. 连接服务器
ssh user@your-server-ip

# 2. 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. 安装 pnpm
sudo npm install -g pnpm

# 4. 克隆代码
git clone https://github.com/Harr0y/Karma.git
cd Karma

# 5. 安装依赖
pnpm install

# 6. 构建
pnpm build

# 7. 配置
export ANTHROPIC_AUTH_TOKEN="your-token"
# 编辑 ~/.karma/config.yaml

# 8. 启动（PM2）
pm2 start ecosystem.config.cjs

# 9. 设置开机自启
pm2 startup
pm2 save
```

---

### Docker 部署（可选）

**Dockerfile**：
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/index.js", "server"]
```

**构建和运行**：
```bash
# 构建镜像
docker build -t karma:latest .

# 运行容器
docker run -d \
  --name karma \
  -p 3000:3000 \
  -v ~/.karma:/root/.karma \
  -e ANTHROPIC_AUTH_TOKEN="your-token" \
  karma:latest
```

---

## 监控和日志

### 日志配置

**Pino 日志系统**（已集成）：

```yaml
# ~/.karma/config.yaml
logging:
  level: info
  file: ~/.karma/logs/karma.log
  rotate: true  # 日志轮转
```

**日志级别**：
- `trace` - 详细调试信息
- `debug` - 调试信息
- `info` - 一般信息（推荐）
- `warn` - 警告
- `error` - 错误

---

### 日志查看

```bash
# 实时查看
tail -f ~/.karma/logs/karma.log

# 查看错误
grep "ERROR" ~/.karma/logs/karma.log

# 查看性能
grep "duration" ~/.karma/logs/karma.log

# PM2 日志
pm2 logs karma-feishu
```

---

### 性能监控

**关键指标**：
- 响应时间（目标 < 2s）
- 内存占用（目标 < 500MB）
- 错误率（目标 < 1%）
- 并发数（目标 > 10）

**监控工具**：
```bash
# PM2 监控
pm2 monit

# 系统资源
top
htop

# 数据库大小
ls -lh ~/.karma/karma.db
```

---

### 错误追踪（Sentry）

**配置 Sentry**：
```bash
# 安装 Sentry SDK
pnpm add @sentry/node
```

**初始化**：
```typescript
// src/index.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://xxx@sentry.io/xxx',
  environment: 'production',
});
```

---

## 备份和恢复

### 数据备份

**自动备份脚本**：
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR=~/.karma/backups
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
cp ~/.karma/karma.db $BACKUP_DIR/karma_$DATE.db

# 压缩备份
gzip $BACKUP_DIR/karma_$DATE.db

# 删除 30 天前的备份
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: karma_$DATE.db.gz"
```

**定时备份**：
```bash
# 添加到 crontab
crontab -e

# 每天凌晨 2 点备份
0 2 * * * /path/to/backup.sh
```

---

### 数据恢复

```bash
# 解压备份
gunzip ~/.karma/backups/karma_20260219_020000.db.gz

# 恢复数据库
cp ~/.karma/backups/karma_20260219_020000.db ~/.karma/karma.db

# 重启服务
pm2 restart karma-feishu
```

---

### 数据迁移

**导出数据**：
```bash
# 导出为 SQL
sqlite3 ~/.karma/karma.db .dump > backup.sql

# 或导出为 JSON
sqlite3 ~/.karma/karma.db <<EOF
.headers on
.mode json
.output clients.json
SELECT * FROM clients;
.quit
EOF
```

**导入数据**：
```bash
# 从 SQL 导入
sqlite3 ~/.karma/karma.db < backup.sql

# 或从 JSON 导入（需要脚本）
# 编写脚本读取 JSON 并插入数据库
```

---

## 安全配置

### 环境变量

**推荐方式**：
```bash
# 不在配置文件中写死密钥
ai:
  authToken: ${ANTHROPIC_AUTH_TOKEN:}  # 从环境变量读取
```

**生产环境**：
```bash
# 使用 .env 文件（不提交到 Git）
cat > .env << EOF
ANTHROPIC_AUTH_TOKEN=sk-ant-xxx
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
EOF

# 加载环境变量
export $(cat .env | xargs)
```

---

### 防火墙配置

**Ubuntu UFW**：
```bash
# 允许 SSH
sudo ufw allow 22

# 允许 HTTP API（如果需要）
sudo ufw allow 3000

# 启用防火墙
sudo ufw enable
```

---

### HTTPS 配置（可选）

**Nginx 反向代理**：
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 故障排查

### 常见问题

#### 问题 1: WebSocket 连接失败

**症状**：
```
WebSocket connection failed
```

**解决**：
1. 检查飞书配置
2. 确认 App ID 和 Secret 正确
3. 检查网络连接

---

#### 问题 2: 内存占用过高

**症状**：
```
内存 > 1GB
```

**解决**：
```bash
# 重启服务
pm2 restart karma-feishu

# 或设置内存限制
pm2 start ecosystem.config.cjs --max-memory-restart 500M
```

---

#### 问题 3: 数据库锁定

**症状**：
```
Error: database is locked
```

**解决**：
```bash
# 关闭其他连接
pkill karma

# 或重启
pm2 restart karma-feishu
```

---

## 更新和维护

### 更新代码

```bash
# 1. 备份数据
./backup.sh

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖
pnpm install

# 4. 构建
pnpm build

# 5. 重启服务
pm2 restart karma-feishu

# 6. 验证
pm2 logs karma-feishu --lines 50
```

---

### 数据清理

```bash
# 清理 30 天前的会话
sqlite3 ~/.karma/karma.db <<EOF
DELETE FROM sessions WHERE started_at < date('now', '-30 days');
DELETE FROM messages WHERE session_id NOT IN (SELECT id FROM sessions);
VACUUM;
EOF
```

---

## 联系支持

### 文档
- [CURRENT_STATUS.md](./CURRENT_STATUS.md) - 项目现状
- [USER_GUIDE.md](./USER_GUIDE.md) - 用户指南
- [README.md](../README.md) - 项目说明

### 社区
- GitHub Issues: https://github.com/Harr0y/Karma/issues

---

**部署完成！** 🎉
