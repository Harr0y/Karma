# Karma 平台适配层设计文档

**版本:** 1.0
**日期:** 2026-02-20
**状态:** 已实现

---

## 一、设计目标

将 Karma 重构为**平台无关的命理师 Agent 核心层**，支持多种前端接入方式：

- HTTP API（无状态）
- 飞书（WebSocket 长连接）
- Discord（WebSocket 长连接）
- Telegram（Long Polling）
- CLI（终端交互）

---

## 二、架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                      入口层 (Entry Points)                    │
│  CLI main()  │  HTTP Server  │  Discord Bot  │  Telegram Bot │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                 平台适配层 (Platform Adapters)                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  PlatformAdapter 接口                                    │ │
│  │  - start() / stop() / isRunning()                       │ │
│  │  - sendMessage() / onMessage()                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  adapters/                                                   │
│  ├── HttpAdapter     (stateless, SSE)      ← 本次新增        │
│  ├── FeishuAdapter   (WebSocket)           ← 已有            │
│  ├── DiscordAdapter  (WebSocket)           ← 待实现          │
│  └── TelegramAdapter (Long Polling)        ← 待实现          │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    Agent 核心层 (Karma Core)                  │
│  AgentRunner                                                 │
│  - 平台无关的命理师对话处理                                   │
│  - 接收统一消息，返回统一响应                                 │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    支撑层 (Infrastructure)                    │
│  SessionManager  │  StorageService  │  PersonaService        │
│  (支持 stateless/persistent 两种模式)                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、核心类型定义

### 3.1 统一平台类型

**文件:** `src/types/platform.ts`

```typescript
/**
 * 支持的平台类型
 */
export type Platform = 'cli' | 'http' | 'feishu' | 'discord' | 'telegram';

/**
 * 平台连接模式
 */
export type ConnectionMode = 'stateless' | 'persistent';

/**
 * 平台特性配置
 */
export interface PlatformConfig {
  type: Platform;
  connectionMode: ConnectionMode;
  features: {
    streaming: boolean;      // 是否支持流式输出
    richContent: boolean;    // 是否支持富文本/卡片
    media: boolean;          // 是否支持媒体消息
    longMessage: boolean;    // 是否支持长消息
  };
}

/**
 * 平台配置表
 */
export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  cli: { type: 'cli', connectionMode: 'persistent', features: {...} },
  http: { type: 'http', connectionMode: 'stateless', features: {...} },
  feishu: { type: 'feishu', connectionMode: 'persistent', features: {...} },
  discord: { type: 'discord', connectionMode: 'persistent', features: {...} },
  telegram: { type: 'telegram', connectionMode: 'persistent', features: {...} },
};
```

### 3.2 统一消息结构

**文件:** `src/platform/types.ts`

```typescript
/**
 * 统一的消息结构（所有平台通用）
 */
export interface IncomingMessage {
  id: string;                    // 消息唯一 ID
  platform: Platform;            // 来源平台
  chatId: string;                // 会话 ID（平台相关）
  userId?: string;               // 用户 ID
  senderType: 'user' | 'bot';    // 发送者类型
  text?: string;                 // 文本内容
  media?: MediaContent;          // 媒体内容
  timestamp: number;             // 消息时间戳
  replyTo?: string;              // 回复的消息 ID
}
```

---

## 四、会话管理策略

### 4.1 两种会话模式

| 模式 | 平台 | 特点 | 会话恢复方式 |
|------|------|------|-------------|
| **stateless** | HTTP | 每次请求独立，无连接状态 | 通过 `sessionId` 从数据库恢复 |
| **persistent** | 飞书/Discord/Telegram/CLI | 长连接，会话持续 | 优先内存缓存，再查数据库 |

### 4.2 SessionManager 策略

```typescript
async getOrCreateSession(context: GetOrCreateSessionContext): Promise<ActiveSession> {
  const { platform, sessionId } = context;

  if (isStatelessPlatform(platform) && sessionId) {
    // 无状态平台：通过 sessionId 从数据库恢复
    return this.getStatelessSession(context);
  } else if (isPersistentPlatform(platform)) {
    // 长连接平台：优先内存缓存
    return this.getPersistentSession(context);
  }

  // 默认：创建新会话
  return this.createNewSession(context);
}
```

### 4.3 会话上下文

```typescript
export interface GetOrCreateSessionContext {
  platform: Platform;
  externalChatId?: string;   // 平台会话 ID（飞书群 ID 等）
  clientId?: string;         // 业务客户 ID
  sessionId?: string;        // 无状态平台使用的会话 ID
}
```

---

## 五、如何接入新平台

### 5.1 步骤一：添加平台类型

在 `src/types/platform.ts` 中添加新平台：

```typescript
export type Platform = 'cli' | 'http' | 'feishu' | 'discord' | 'telegram' | 'wechat';  // 新增 wechat

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  // ... 现有配置
  wechat: {
    type: 'wechat',
    connectionMode: 'persistent',  // 或 'stateless'
    features: {
      streaming: false,
      richContent: true,
      media: true,
      longMessage: false,
    },
  },
};
```

### 5.2 步骤二：实现 PlatformAdapter 接口

创建 `src/platform/adapters/wechat/adapter.ts`：

```typescript
import type {
  PlatformAdapter,
  IncomingMessage,
  MessageHandler,
} from '../../types.js';
import type { Platform } from '../../../types/platform.js';

export class WeChatAdapter implements PlatformAdapter {
  readonly platform: Platform = 'wechat';

  // 1. 生命周期管理
  async start(): Promise<void> {
    // 初始化微信连接
  }

  async stop(): Promise<void> {
    // 断开微信连接
  }

  isRunning(): boolean {
    return true;  // 返回连接状态
  }

  // 2. 消息发送
  async sendMessage(chatId: string, content: string): Promise<string> {
    // 调用微信 API 发送消息
    return messageId;
  }

  // 3. 消息接收
  onMessage(handler: MessageHandler): void {
    // 注册消息处理器
    // 当收到微信消息时，转换为 IncomingMessage 并调用 handler
  }
}
```

### 5.3 步骤三：消息转换

在 `onMessage` 回调中，将平台消息转换为统一格式：

```typescript
onMessage(handler: MessageHandler): void {
  wechatClient.on('message', async (rawMsg) => {
    const incomingMessage: IncomingMessage = {
      id: rawMsg.MsgId,
      platform: 'wechat',
      chatId: rawMsg.FromUserName,  // 微信会话 ID
      userId: rawMsg.ActualUserName,  // 微信用户 ID
      senderType: 'user',
      text: rawMsg.Content,
      timestamp: rawMsg.CreateTime * 1000,
    };

    await handler(incomingMessage);
  });
}
```

### 5.4 步骤四：注册到入口

在 `main.ts` 或启动脚本中：

```typescript
import { WeChatAdapter } from './platform/adapters/wechat/index.js';

const wechatAdapter = new WeChatAdapter();
await wechatAdapter.start();

wechatAdapter.onMessage(async (msg) => {
  const session = await sessionManager.getOrCreateSession({
    platform: 'wechat',
    externalChatId: msg.chatId,
  });

  for await (const response of agentRunner.run({
    userInput: msg.text || '',
    session,
  })) {
    if (response.type === 'text') {
      await wechatAdapter.sendMessage(msg.chatId, response.content);
    }
  }
});
```

---

## 六、HTTP 接入指南

### 6.1 创建会话

```bash
POST /api/session
Content-Type: application/json

{
  "userId": "user-12345"  // 可选，用于标识用户
}
```

**响应:**

```json
{
  "sessionId": "session_abc123",
  "createdAt": "2026-02-20T10:00:00.000Z"
}
```

### 6.2 发送消息

```bash
POST /api/chat
Content-Type: application/json

{
  "sessionId": "session_abc123",
  "message": "你好，我是1998年5月15日下午两点半出生的，男，长沙人"
}
```

**响应 (SSE 流式):**

```
data: {"type":"text","content":"你好！欢迎..."}

data: {"type":"text","content":"让我看看你的八字..."}

data: {"type":"done"}
```

### 6.3 获取历史

```bash
GET /api/history/session_abc123
```

**响应:**

```json
{
  "sessionId": "session_abc123",
  "messages": [
    {
      "role": "user",
      "content": "你好...",
      "timestamp": "2026-02-20T10:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "你好！欢迎...",
      "timestamp": "2026-02-20T10:00:05.000Z"
    }
  ],
  "extractedInfo": {
    "name": "小明",
    "birthDate": "1998-05-15 14:30",
    "birthPlace": "长沙"
  }
}
```

---

## 七、关键设计决策

### 7.1 为什么区分 stateless 和 persistent？

| 问题 | 解决方案 |
|------|----------|
| HTTP 每次请求可能到不同服务器 | 必须依赖数据库恢复会话 |
| 长连接平台会话在内存中 | 优先使用内存缓存，减少数据库访问 |
| SDK session_id 需要持久化 | 存储在数据库中，所有模式共享 |

### 7.2 clientId 持久化的重要性

**问题**: 之前 `clientId` 只存在于内存中，导致：
- 客户信息无法跨请求加载
- LLM 看不到已收集的信息
- 用户反复被询问相同问题

**解决**: 添加 `StorageService.updateSessionClient()` 方法，在创建/关联客户时持久化。

### 7.3 tool_use 不暴露给用户

`tool_use` 是 Agent 内部调用工具的消息，包含技术细节（如 Bash 命令、文件路径等），不应该暴露给最终用户。

---

## 八、文件清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `src/types/platform.ts` | 统一平台类型定义 |
| `src/platform/adapters/http/adapter.ts` | HTTP 无状态适配器 |
| `src/platform/adapters/http/index.ts` | HTTP 适配器导出 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/platform/types.ts` | 导入统一 Platform 类型 |
| `src/session/types.ts` | 添加 sessionId 字段 |
| `src/session/manager.ts` | 区分会话策略，添加 updateSessionClient |
| `src/storage/service.ts` | 添加 updateSessionClient，修复 updateClient |
| `src/agent/runner.ts` | 修复 clientId 持久化 |
| `src/api/server.ts` | 使用无状态会话，移除 tool_use 暴露 |

---

## 九、后续扩展

### 9.1 Discord 适配器

```typescript
// src/platform/adapters/discord/adapter.ts
import { Client, GatewayIntentBits } from 'discord.js';

export class DiscordAdapter implements PlatformAdapter {
  readonly platform = 'discord';
  private client: Client;

  async start() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    });
    await this.client.login(process.env.DISCORD_TOKEN);
  }

  onMessage(handler: MessageHandler) {
    this.client.on('messageCreate', async (msg) => {
      if (msg.author.bot) return;

      await handler({
        id: msg.id,
        platform: 'discord',
        chatId: msg.channelId,
        userId: msg.author.id,
        senderType: 'user',
        text: msg.content,
        timestamp: msg.createdTimestamp,
      });
    });
  }

  async sendMessage(chatId: string, content: string) {
    const channel = await this.client.channels.fetch(chatId);
    if (channel?.isTextBased()) {
      const msg = await channel.send(content);
      return msg.id;
    }
    throw new Error('Channel not found');
  }
}
```

### 9.2 Telegram 适配器

```typescript
// src/platform/adapters/telegram/adapter.ts
import TelegramBot from 'node-telegram-bot-api';

export class TelegramAdapter implements PlatformAdapter {
  readonly platform = 'telegram';
  private bot: TelegramBot;

  async start() {
    this.bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { polling: true });
  }

  onMessage(handler: MessageHandler) {
    this.bot.on('message', async (msg) => {
      if (!msg.text) return;

      await handler({
        id: msg.message_id.toString(),
        platform: 'telegram',
        chatId: msg.chat.id.toString(),
        userId: msg.from?.id.toString(),
        senderType: 'user',
        text: msg.text,
        timestamp: msg.date * 1000,
      });
    });
  }

  async sendMessage(chatId: string, content: string) {
    const result = await this.bot.sendMessage(chatId, content);
    return result.message_id.toString();
  }
}
```

---

## 十、测试建议

### 10.1 单元测试

- `StorageService.updateSessionClient()` 正确更新数据库
- `StorageService.updateClient()` 不覆盖 undefined 字段
- `SessionManager.getStatelessSession()` 正确从数据库恢复
- `HttpAdapter.handleRequest()` 生成正确的 IncomingMessage

### 10.2 集成测试

- HTTP API 创建会话 → 发送消息 → 获取响应
- HTTP API 会话恢复（clientId 持久化验证）
- 空消息触发问候
- 空响应兜底

### 10.3 回归测试

- 飞书适配器正常工作
- CLI 模式正常工作

---

*文档版本: 1.0*
*最后更新: 2026-02-20*
