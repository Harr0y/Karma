# Karma V3 Phase 5: 多平台适配器设计 (合并版)

> 合并 phase5-multi-platform.md 和 MULTI_PLATFORM_ARCHITECTURE.md

---

## 一、设计目标

### 1.1 核心原则

1. **平台无关核心** - Agent 核心逻辑与平台解耦
2. **统一接口** - 所有平台使用相同的接口
3. **向后兼容** - 新增平台不影响现有功能
4. **功能对等** - 文本、图片、文件、语音全平台支持

### 1.2 目标平台

| 平台 | 优先级 | 特点 |
|------|--------|------|
| CLI | ✅ 已完成 | 终端交互 |
| Feishu | 🎯 Phase 5 | 企业通讯，卡片消息 |
| Discord | 🔮 未来 | 游戏社区，Embed |
| Telegram | 🔮 未来 | 开放API，Bot |

---

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Platform Layer                           │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐       │
│  │   CLI   │  │ Feishu  │  │ Discord  │  │ Telegram │       │
│  │ Adapter │  │ Adapter │  │ Adapter  │  │ Adapter  │       │
│  └────┬────┘  └────┬────┘  └────┬─────┘  └────┬─────┘       │
│       │            │            │             │              │
│       └────────────┴─────┬──────┴─────────────┘              │
│                          │                                   │
├──────────────────────────┼───────────────────────────────────┤
│                  Message Router                              │
│           (去重、时效检查、Bot消息过滤)                        │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                   Session Manager                             │
│         (多平台会话管理、SDK resume、复合键)                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                    Agent Runner                               │
│         (SDK 调用、消息过滤、流式处理)                         │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                    Output Adapter                             │
│      (平台特定的输出格式化：文本、卡片、语音、图片、节流)       │
└──────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                     Storage Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│  │   Clients   │ │  Sessions   │ │    Facts    │             │
│  └─────────────┘ └─────────────┘ └─────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

---

## 三、核心接口定义

### 3.1 平台类型

```typescript
// src/platform/types.ts

export type Platform = 'cli' | 'feishu' | 'discord' | 'telegram';

export interface IncomingMessage {
  id: string;
  platform: Platform;
  chatId: string;
  userId?: string;
  senderType: 'user' | 'bot';
  text?: string;
  media?: MediaContent;
  timestamp: number;
  replyTo?: string;
}

export interface MediaContent {
  type: 'image' | 'audio' | 'video' | 'file';
  fileId: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  localPath?: string;
}

export interface SendMessageOptions {
  type?: 'text' | 'card' | 'image' | 'audio' | 'file';
  replyTo?: string;
  metadata?: Record<string, any>;
}
```

### 3.2 PlatformAdapter 接口

```typescript
export interface PlatformAdapter {
  readonly platform: Platform;

  // 生命周期
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;

  // 消息发送
  sendMessage(chatId: string, content: string, options?: SendMessageOptions): Promise<string>;
  sendCard?(chatId: string, card: any): Promise<string>;
  sendImage?(chatId: string, image: ImageContent): Promise<string>;
  sendAudio?(chatId: string, audio: AudioContent): Promise<string>;
  sendFile?(chatId: string, file: FileContent): Promise<string>;

  // 媒体处理
  downloadMedia?(media: MediaContent): Promise<string>;

  // 事件
  onMessage(handler: MessageHandler): void;
}

export type MessageHandler = (message: IncomingMessage) => Promise<void>;
```

---

## 四、MessageRouter（消息路由器）

> 参考 MULTI_PLATFORM_ARCHITECTURE.md

```typescript
// src/platform/router.ts

export interface MessageRouterConfig {
  maxMessageAge?: number;        // 消息最大年龄（毫秒）
  deduplicationTTL?: number;     // 去重缓存时间
}

export class MessageRouter {
  private processedMessages = new Map<string, number>();
  private handlers: MessageHandler[] = [];

  constructor(private config: MessageRouterConfig = {}) {
    this.config.maxMessageAge ??= 24 * 60 * 60 * 1000; // 24 小时
    this.config.deduplicationTTL ??= 60 * 60 * 1000;   // 1 小时
  }

  async route(message: IncomingMessage): Promise<void> {
    // 1. 去重检查
    if (this.isDuplicate(message.id)) {
      console.log('[Router] 跳过重复消息:', message.id);
      return;
    }

    // 2. 时效性检查
    if (this.isExpired(message)) {
      console.log('[Router] 跳过过期消息:', message.id);
      return;
    }

    // 3. Bot 自消息过滤
    if (message.senderType === 'bot') {
      console.log('[Router] 跳过 Bot 消息');
      return;
    }

    // 4. 标记已处理
    this.markProcessed(message.id);

    // 5. 分发给处理器
    for (const handler of this.handlers) {
      try {
        await handler(message);
      } catch (err) {
        console.error('[Router] 处理器错误:', err);
      }
    }
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  private isDuplicate(messageId: string): boolean {
    const processed = this.processedMessages.get(messageId);
    if (!processed) return false;
    return Date.now() - processed < this.config.deduplicationTTL!;
  }

  private isExpired(message: IncomingMessage): boolean {
    return Date.now() - message.timestamp > this.config.maxMessageAge!;
  }

  private markProcessed(messageId: string): void {
    this.processedMessages.set(messageId, Date.now());
    this.cleanupOldEntries();
  }

  private cleanupOldEntries(): void {
    const now = Date.now();
    for (const [id, timestamp] of this.processedMessages) {
      if (now - timestamp > this.config.deduplicationTTL!) {
        this.processedMessages.delete(id);
      }
    }
  }
}
```

---

## 五、OutputAdapter（输出适配器）

### 5.1 接口定义

```typescript
// src/output/types.ts

export type OutputMessageType = 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'error' | 'complete';

export interface OutputContent {
  type: OutputMessageType;
  text: string;
  metadata?: {
    toolName?: string;
    duration?: number;
    [key: string]: any;
  };
}

export interface OutputAdapter {
  readonly platform: Platform;
  readonly chatId: string;
  write(content: OutputContent): Promise<void>;
  flush?(): Promise<void>;
}
```

### 5.2 CLI OutputAdapter

```typescript
// src/output/adapters/cli.ts

export class CLIOutputAdapter implements OutputAdapter {
  readonly platform: Platform = 'cli';

  constructor(readonly chatId: string) {}

  async write(content: OutputContent): Promise<void> {
    const colored = this.colorize(content);
    process.stdout.write(colored);
  }

  private colorize(content: OutputContent): string {
    const colors: Record<OutputMessageType, string> = {
      text: '\x1b[0m',
      thinking: '\x1b[90m',
      tool_use: '\x1b[33m',
      tool_result: '\x1b[32m',
      error: '\x1b[31m',
      complete: '\x1b[36m',
    };
    return `${colors[content.type]}${content.text}\x1b[0m`;
  }
}
```

### 5.3 Feishu OutputAdapter（带节流）

```typescript
// src/output/adapters/feishu.ts

export class FeishuOutputAdapter implements OutputAdapter {
  readonly platform: Platform = 'feishu';

  private platformAdapter: PlatformAdapter;
  private buffer: string[] = [];
  private lastSendTime = 0;
  private throttleMs = 500;  // 节流间隔

  constructor(readonly chatId: string, platformAdapter: PlatformAdapter) {
    this.platformAdapter = platformAdapter;
  }

  async write(content: OutputContent): Promise<void> {
    // 文本内容缓冲
    if (content.type === 'text') {
      this.buffer.push(content.text);
      await this.tryFlush();
      return;
    }

    // 工具调用立即发送
    if (content.type === 'tool_use') {
      await this.flush();
      const toolText = `🔧 正在使用 ${content.metadata?.toolName || '工具'}...`;
      await this.platformAdapter.sendMessage(this.chatId, toolText);
      return;
    }

    // 完成时刷新
    if (content.type === 'complete') {
      await this.flush();
      return;
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const text = this.buffer.join('');
    this.buffer = [];

    await this.platformAdapter.sendMessage(this.chatId, text);
    this.lastSendTime = Date.now();
  }

  private async tryFlush(): Promise<void> {
    if (Date.now() - this.lastSendTime >= this.throttleMs) {
      await this.flush();
    }
  }
}
```

---

## 六、Session 复合键

```typescript
// src/session/types.ts

export interface SessionIdentity {
  platform: Platform;
  chatId: string;
  userId?: string;
}

/**
 * 会话复合键: "platform:chatId"
 */
export function getSessionKey(identity: SessionIdentity): string {
  return `${identity.platform}:${identity.chatId}`;
}
```

---

## 七、FeishuAdapter 实现

### 7.1 目录结构

```
src/platform/
├── types.ts              # 接口定义
├── router.ts             # 消息路由器
├── index.ts              # 导出
│
├── adapters/
│   ├── cli.ts            # CLI 适配器
│   └── feishu/
│       ├── index.ts      # 飞书适配器
│       ├── bot.ts        # WebSocket Bot
│       ├── sender.ts     # 消息发送
│       ├── receiver.ts   # 消息接收
│       ├── card-builder.ts   # 卡片构建
│       └── file-handler.ts   # 文件处理
```

### 7.2 FeishuAdapter

```typescript
// src/platform/adapters/feishu/bot.ts

import * as lark from '@larksuiteoapi/node-sdk';
import type { PlatformAdapter, IncomingMessage, MessageHandler, MediaContent } from '../../types.js';

export interface FeishuConfig {
  appId: string;
  appSecret: string;
}

export class FeishuAdapter implements PlatformAdapter {
  readonly platform = 'feishu' as const;

  private client: lark.Client;
  private wsClient?: lark.WSClient;
  private messageHandlers: MessageHandler[] = [];
  private running = false;

  constructor(private config: FeishuConfig) {
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Lark,
    });
  }

  async start(): Promise<void> {
    this.wsClient = new lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
    });

    const eventDispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: any) => {
        await this.handleRawMessage(data);
      },
    });

    await this.wsClient.start({ eventDispatcher });
    this.running = true;

    console.log('[Feishu] WebSocket 连接已建立');
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  async sendMessage(chatId: string, content: string): Promise<string> {
    const response = await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text: content }),
      },
    });

    return response.data?.message_id || '';
  }

  async sendImage(chatId: string, image: Buffer | string): Promise<string> {
    // 上传图片并发送
    const fileHandler = new FeishuFileHandler(this.client);
    const imageKey = Buffer.isBuffer(image)
      ? await fileHandler.uploadImage(image)
      : await fileHandler.uploadImageFromUrl(image);

    const response = await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'image',
        content: JSON.stringify({ image_key: imageKey }),
      },
    });

    return response.data?.message_id || '';
  }

  async sendFile(chatId: string, file: Buffer | string, fileName: string): Promise<string> {
    const fileHandler = new FeishuFileHandler(this.client);
    const fileKey = Buffer.isBuffer(file)
      ? await fileHandler.uploadFile(file, fileName)
      : await fileHandler.uploadFileFromUrl(file, fileName);

    const response = await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'file',
        content: JSON.stringify({ file_key: fileKey }),
      },
    });

    return response.data?.message_id || '';
  }

  async sendAudio(chatId: string, audio: Buffer | string): Promise<string> {
    const fileHandler = new FeishuFileHandler(this.client);
    const mediaKey = Buffer.isBuffer(audio)
      ? await fileHandler.uploadMedia(audio, 'opus')
      : await fileHandler.uploadMediaFromUrl(audio, 'opus');

    const response = await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'audio',
        content: JSON.stringify({ file_key: mediaKey }),
      },
    });

    return response.data?.message_id || '';
  }

  async downloadMedia(media: MediaContent): Promise<string> {
    const fileHandler = new FeishuFileHandler(this.client);
    return fileHandler.downloadFile(media.fileId);
  }

  private async handleRawMessage(data: any): Promise<void> {
    const message = this.parseMessage(data);

    for (const handler of this.messageHandlers) {
      try {
        await handler(message);
      } catch (err) {
        console.error('[Feishu] 消息处理错误:', err);
      }
    }
  }

  private parseMessage(data: any): IncomingMessage {
    const { event } = data;
    const { message, sender } = event;

    return {
      id: message.message_id,
      platform: 'feishu',
      chatId: message.chat_id,
      userId: sender?.sender_id?.open_id,
      senderType: sender?.sender_type === 'app' ? 'bot' : 'user',
      text: this.extractText(message),
      timestamp: Number(message.create_time) * 1000,
    };
  }

  private extractText(message: any): string {
    const content = JSON.parse(message.content || '{}');

    if (message.message_type === 'text') {
      return content.text || '';
    }

    if (message.message_type === 'post') {
      return this.extractPostText(content);
    }

    return '';
  }

  private extractPostText(content: any): string {
    return content.content.flat().map((c: any) => c.text || '').join('');
  }
}
```

### 7.3 FeishuFileHandler

```typescript
// src/platform/adapters/feishu/file-handler.ts

import * as lark from '@larksuiteoapi/node-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import fetch from 'node-fetch';

export class FeishuFileHandler {
  private client: lark.Client;

  constructor(client: lark.Client) {
    this.client = client;
  }

  async uploadImage(imageBuffer: Buffer, fileName?: string): Promise<string> {
    const tmpPath = this.saveToTemp(imageBuffer, fileName || 'image.png');

    const response = await this.client.im.image.resources.put({
      data: {
        image_type: 'message',
        image: fs.createReadStream(tmpPath),
      },
    });

    fs.unlinkSync(tmpPath);
    return response.data?.image_key || '';
  }

  async uploadImageFromUrl(url: string): Promise<string> {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadImage(buffer, path.basename(url));
  }

  async uploadFile(fileBuffer: Buffer, fileName: string): Promise<string> {
    const tmpPath = this.saveToTemp(fileBuffer, fileName);

    const response = await this.client.drive.files.upload({
      data: {
        file_name: fileName,
        file_size: fileBuffer.length,
        block_size: fileBuffer.length,
        block_sha1: this.calculateSha1(fileBuffer),
      },
      file: fs.createReadStream(tmpPath),
    });

    fs.unlinkSync(tmpPath);
    return response.data?.file_token || '';
  }

  async uploadFileFromUrl(url: string, fileName: string): Promise<string> {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadFile(buffer, fileName);
  }

  async uploadMedia(mediaBuffer: Buffer, format: string): Promise<string> {
    const fileName = `media.${format}`;
    const tmpPath = this.saveToTemp(mediaBuffer, fileName);

    const response = await this.client.im.file.resources.put({
      data: {
        file_type: 'stream',
        file_name: fileName,
        file: fs.createReadStream(tmpPath),
      },
    });

    fs.unlinkSync(tmpPath);
    return response.data?.file_key || '';
  }

  async uploadMediaFromUrl(url: string, format: string): Promise<string> {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadMedia(buffer, format);
  }

  async downloadFile(fileKey: string): Promise<string> {
    const response = await this.client.im.file.resources.get({
      path: { file_key: fileKey },
    });

    const chunks: Buffer[] = [];
    for await (const chunk of response) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      }
    }

    const buffer = Buffer.concat(chunks);
    const tmpPath = path.join(os.tmpdir(), 'karma-feishu', fileKey);
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, buffer);

    return tmpPath;
  }

  private saveToTemp(buffer: Buffer, fileName: string): string {
    const tmpDir = path.join(os.tmpdir(), 'karma-feishu');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const tmpPath = path.join(tmpDir, fileName);
    fs.writeFileSync(tmpPath, buffer);
    return tmpPath;
  }

  private calculateSha1(buffer: Buffer): string {
    return crypto.createHash('sha1').update(buffer).digest('hex');
  }
}
```

---

## 八、主入口

### 8.1 Bot 入口

```typescript
// src/bot-entry.ts

import { StorageService } from './storage/index.js';
import { SessionManager, getSessionKey } from './session/index.js';
import { AgentRunner } from './agent/index.js';
import { FeishuAdapter } from './platform/adapters/feishu/index.js';
import { FeishuOutputAdapter } from './output/adapters/feishu.js';
import { MessageRouter } from './platform/router.js';
import { getConfig } from './config/index.js';

async function main() {
  const config = getConfig();

  // 初始化核心组件
  const storage = new StorageService(config.storage.path);
  const sessionManager = new SessionManager(storage);
  const runner = new AgentRunner({ /* ... */ });

  // 消息路由器
  const router = new MessageRouter();

  // 飞书适配器
  const feishu = new FeishuAdapter({
    appId: config.platforms.feishu.appId,
    appSecret: config.platforms.feishu.appSecret,
  });

  // 注册消息处理器
  router.onMessage(async (message) => {
    // 获取/创建会话（复合键）
    const session = await sessionManager.getOrCreateSession({
      platform: message.platform,
      chatId: message.chatId,
      userId: message.userId,
    });

    // 输出适配器（带节流）
    const outputAdapter = new FeishuOutputAdapter(message.chatId, feishu);

    try {
      for await (const msg of runner.run({
        userInput: message.text || '',
        session,
      })) {
        await outputAdapter.write({
          type: msg.type as any,
          text: msg.content,
        });
      }
    } catch (err) {
      console.error('[Bot] Agent 错误:', err);
      await feishu.sendMessage(message.chatId, '抱歉，处理出错了，请稍后重试。');
    }
  });

  // 启动
  await feishu.start();
  feishu.onMessage((msg) => router.route(msg));

  console.log('[Bot] 服务已启动');
}

main().catch(console.error);
```

---

## 九、配置扩展

```yaml
# ~/.karma/config.yaml

platforms:
  cli:
    enabled: true

  feishu:
    enabled: true
    appId: ${FEISHU_APP_ID}
    appSecret: ${FEISHU_APP_SECRET}

  discord:
    enabled: false
    botToken: ${DISCORD_BOT_TOKEN}

  telegram:
    enabled: false
    botToken: ${TELEGRAM_BOT_TOKEN}
```

---

## 十、实施计划

| 阶段 | 任务 | 工作量 |
|------|------|--------|
| 5.1 | PlatformAdapter 接口 + types.ts | 1h |
| 5.2 | MessageRouter 实现 | 1h |
| 5.3 | OutputAdapter + 节流 | 1.5h |
| 5.4 | FeishuAdapter 核心 | 2h |
| 5.5 | FeishuFileHandler | 1.5h |
| 5.6 | Session 复合键改造 | 1h |
| 5.7 | 测试 | 2h |
| **总计** | | **10h** |

---

## 十一、验收标准

- [ ] MessageRouter 去重生效
- [ ] FeishuAdapter WebSocket 连接稳定
- [ ] OutputAdapter 节流正常
- [ ] 文本/图片/文件/语音全支持
- [ ] 会话复合键正确
- [ ] 20+ 测试通过

---

**准备好开始实施了吗？**
