# Karma V3 Phase 5: 多平台适配器设计

> 参考 disclaude 实现，设计可扩展的多平台架构

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
| WeChat | 🔮 未来 | 企业微信/公众号 |

---

## 二、架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                   Platform Adapters                          │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐       │
│  │   CLI   │  │ Feishu  │  │ Discord  │  │ Telegram │       │
│  └────┬────┘  └────┬────┘  └────┬─────┘  └────┬─────┘       │
│       │            │            │             │              │
│       └────────────┴────────────┴─────────────┘              │
│                          │                                   │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │              Platform Interface                        │   │
│  │  - sendMessage(chatId, content)                        │   │
│  │  - sendFile(chatId, file)                              │   │
│  │  - sendImage(chatId, image)                            │   │
│  │  - sendAudio(chatId, audio)                            │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Agent Core                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │
│  │ Agent Runner  │  │ Session Mgr   │  │ Storage       │    │
│  └───────────────┘  └───────────────┘  └───────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Claude Agent SDK                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心接口定义

```typescript
// src/platform/types.ts

/**
 * 消息类型
 */
export type MessageType = 'text' | 'image' | 'audio' | 'file' | 'card';

/**
 * 消息内容
 */
export interface MessageContent {
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  mediaData?: Buffer;
  fileName?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 平台事件
 */
export interface PlatformEvent {
  platform: 'cli' | 'feishu' | 'discord' | 'telegram' | 'wechat';
  chatId: string;
  userId?: string;
  messageId: string;
  timestamp: Date;
  content: MessageContent;
  replyTo?: string;
}

/**
 * 平台适配器接口
 */
export interface PlatformAdapter {
  readonly platform: string;

  // 消息发送
  sendMessage(chatId: string, content: MessageContent): Promise<void>;
  sendText(chatId: string, text: string): Promise<void>;
  sendImage(chatId: string, image: Buffer | string, caption?: string): Promise<void>;
  sendFile(chatId: string, file: Buffer | string, fileName: string): Promise<void>;
  sendAudio(chatId: string, audio: Buffer | string, duration?: number): Promise<void>;

  // 批量发送（流式优化）
  sendBatch(chatId: string, contents: MessageContent[]): Promise<void>;

  // 消息管理
  deleteMessage(chatId: string, messageId: string): Promise<void>;
  editMessage(chatId: string, messageId: string, content: MessageContent): Promise<void>;

  // 生命周期
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

/**
 * 平台事件处理器
 */
export interface PlatformEventHandler {
  onMessage(event: PlatformEvent): Promise<void>;
  onFile?(event: PlatformEvent): Promise<void>;
  onImage?(event: PlatformEvent): Promise<void>;
  onAudio?(event: PlatformEvent): Promise<void>;
  onCommand?(event: PlatformEvent, command: string, args: string[]): Promise<void>;
}

/**
 * 平台配置
 */
export interface PlatformConfig {
  enabled: boolean;
  [key: string]: unknown;
}
```

---

## 三、参考 disclaude 实现

### 3.1 disclaude 架构分析

```
disclaude/src/feishu/
├── bot.ts                    # 主机器人入口
├── message-sender.ts         # 消息发送
├── message-router.ts         # 消息路由
├── file-handler.ts           # 文件处理
├── file-downloader.ts        # 文件下载
├── file-uploader.ts          # 文件上传
├── attachment-manager.ts     # 附件管理
├── content-builder.ts        # 内容构建
├── message-logger.ts         # 消息日志
├── message-history.ts        # 历史记录
├── task-flow-orchestrator.ts # 任务流编排
├── command-handlers.ts       # 命令处理
└── diff-card-builder.ts      # 卡片构建
```

**关键设计**:
1. `MessageSender` - 统一发送接口
2. `FileHandler` - 文件处理抽象
3. `TaskFlowOrchestrator` - 任务流管理

### 3.2 借鉴要点

| 模块 | disclaude | Karma 借鉴 |
|------|-----------|-----------|
| 消息发送 | MessageSender | PlatformAdapter.sendMessage |
| 文件处理 | FileHandler | PlatformAdapter.sendFile/sendImage |
| 附件管理 | AttachmentManager | MediaManager (新建) |
| 消息历史 | MessageHistory | 已有 StorageService |
| 任务流 | TaskFlowOrchestrator | 不需要 (SDK 内置) |

---

## 四、Karma 实现设计

### 4.1 目录结构

```
src/platform/
├── types.ts              # 接口定义
├── index.ts              # 导出
├── adapter.ts            # 基类
├── media-manager.ts      # 媒体管理
├── message-formatter.ts  # 消息格式化
│
├── cli/
│   ├── adapter.ts        # CLI 适配器
│   ├── output.ts         # 输出处理
│   └── input.ts          # 输入处理
│
├── feishu/
│   ├── adapter.ts        # 飞书适配器
│   ├── sender.ts         # 消息发送
│   ├── receiver.ts       # 消息接收
│   ├── card-builder.ts   # 卡片构建
│   ├── file-handler.ts   # 文件处理
│   └── client.ts         # API 客户端
│
├── discord/              # 未来
│   └── adapter.ts
│
└── telegram/             # 未来
    └── adapter.ts
```

### 4.2 PlatformAdapter 基类

```typescript
// src/platform/adapter.ts

import type { PlatformAdapter, MessageContent, PlatformEvent } from './types.js';

export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platform: string;

  // 子类必须实现
  abstract sendMessage(chatId: string, content: MessageContent): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract isRunning(): boolean;

  // 默认实现
  async sendText(chatId: string, text: string): Promise<void> {
    await this.sendMessage(chatId, { type: 'text', text });
  }

  async sendImage(chatId: string, image: Buffer | string, caption?: string): Promise<void> {
    const content: MessageContent = {
      type: 'image',
      text: caption,
      mediaData: typeof image === 'string' ? undefined : image,
      mediaUrl: typeof image === 'string' ? image : undefined,
    };
    await this.sendMessage(chatId, content);
  }

  async sendFile(chatId: string, file: Buffer | string, fileName: string): Promise<void> {
    const content: MessageContent = {
      type: 'file',
      fileName,
      mediaData: typeof file === 'string' ? undefined : file,
      mediaUrl: typeof file === 'string' ? file : undefined,
    };
    await this.sendMessage(chatId, content);
  }

  async sendAudio(chatId: string, audio: Buffer | string, duration?: number): Promise<void> {
    const content: MessageContent = {
      type: 'audio',
      mediaData: typeof audio === 'string' ? undefined : audio,
      mediaUrl: typeof audio === 'string' ? audio : undefined,
      metadata: duration ? { duration } : undefined,
    };
    await this.sendMessage(chatId, content);
  }

  async sendBatch(chatId: string, contents: MessageContent[]): Promise<void> {
    for (const content of contents) {
      await this.sendMessage(chatId, content);
    }
  }

  // 可选方法默认抛出
  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    throw new Error('deleteMessage not supported');
  }

  async editMessage(chatId: string, messageId: string, content: MessageContent): Promise<void> {
    throw new Error('editMessage not supported');
  }
}
```

### 4.3 CLI 适配器

```typescript
// src/platform/cli/adapter.ts

import { BasePlatformAdapter } from '../adapter.js';
import type { MessageContent } from '../types.js';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class CLIAdapter extends BasePlatformAdapter {
  readonly platform = 'cli';
  private running = false;
  private rl?: readline.Interface;
  private onMessageCallback?: (event: any) => Promise<void>;

  async start(): Promise<void> {
    this.running = true;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.rl?.close();
  }

  isRunning(): boolean {
    return this.running;
  }

  onMessage(callback: (event: any) => Promise<void>): void {
    this.onMessageCallback = callback;
  }

  async sendMessage(chatId: string, content: MessageContent): Promise<void> {
    switch (content.type) {
      case 'text':
        process.stdout.write(content.text || '');
        break;
      case 'image':
        console.log(`[图片: ${content.mediaUrl || 'buffer'}]`);
        break;
      case 'file':
        console.log(`[文件: ${content.fileName}]`);
        break;
      case 'audio':
        console.log(`[音频: ${content.metadata?.duration || 0}秒]`);
        break;
    }
  }

  async sendText(chatId: string, text: string): Promise<void> {
    process.stdout.write(text);
  }

  async sendFile(chatId: string, file: Buffer | string, fileName: string): Promise<void> {
    // CLI: 保存到临时目录
    const tmpDir = path.join(os.tmpdir(), 'karma-files');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const filePath = path.join(tmpDir, fileName);
    if (Buffer.isBuffer(file)) {
      fs.writeFileSync(filePath, file);
    } else {
      // 如果是 URL，提示
      console.log(`[文件: ${fileName}]`);
      return;
    }

    console.log(`[文件已保存: ${filePath}]`);
  }
}
```

### 4.4 飞书适配器

```typescript
// src/platform/feishu/adapter.ts

import * as lark from '@larksuiteoapi/node-sdk';
import { BasePlatformAdapter } from '../adapter.js';
import type { MessageContent, PlatformEvent } from '../types.js';
import { FeishuSender } from './sender.js';
import { FeishuFileHandler } from './file-handler.js';
import type { KarmaConfig } from '@/config/loader.js';

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  enabled?: boolean;
}

export class FeishuAdapter extends BasePlatformAdapter {
  readonly platform = 'feishu';

  private config: FeishuConfig;
  private client?: lark.Client;
  private sender?: FeishuSender;
  private fileHandler?: FeishuFileHandler;
  private running = false;

  constructor(config: FeishuConfig) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Feishu] 适配器未启用');
      return;
    }

    this.client = new lark.Client({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Lark,
    });

    this.sender = new FeishuSender(this.client);
    this.fileHandler = new FeishuFileHandler(this.client);
    this.running = true;

    console.log('[Feishu] 适配器已启动');
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log('[Feishu] 适配器已停止');
  }

  isRunning(): boolean {
    return this.running;
  }

  async sendMessage(chatId: string, content: MessageContent): Promise<void> {
    if (!this.sender) throw new Error('Feishu adapter not started');

    switch (content.type) {
      case 'text':
        await this.sender.sendText(chatId, content.text || '');
        break;
      case 'image':
        await this.sender.sendImage(chatId, content.mediaData || content.mediaUrl || '');
        break;
      case 'file':
        await this.sender.sendFile(chatId, content.mediaData || content.mediaUrl || '', content.fileName || 'file');
        break;
      case 'audio':
        await this.sender.sendAudio(chatId, content.mediaData || content.mediaUrl || '');
        break;
      case 'card':
        await this.sender.sendCard(chatId, content.metadata || {});
        break;
    }
  }

  async sendText(chatId: string, text: string): Promise<void> {
    await this.sender?.sendText(chatId, text);
  }

  async sendImage(chatId: string, image: Buffer | string, caption?: string): Promise<void> {
    await this.sender?.sendImage(chatId, image, caption);
  }

  async sendFile(chatId: string, file: Buffer | string, fileName: string): Promise<void> {
    await this.sender?.sendFile(chatId, file, fileName);
  }

  async sendAudio(chatId: string, audio: Buffer | string, duration?: number): Promise<void> {
    await this.sender?.sendAudio(chatId, audio);
  }
}
```

### 4.5 飞书消息发送器

```typescript
// src/platform/feishu/sender.ts

import * as lark from '@larksuiteoapi/node-sdk';
import { FeishuFileHandler } from './file-handler.js';
import { buildTextContent } from './content-builder.js';

export class FeishuSender {
  private client: lark.Client;
  private fileHandler: FeishuFileHandler;

  constructor(client: lark.Client) {
    this.client = client;
    this.fileHandler = new FeishuFileHandler(client);
  }

  async sendText(chatId: string, text: string): Promise<void> {
    await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      },
    });
  }

  async sendImage(chatId: string, image: Buffer | string, caption?: string): Promise<void> {
    let imageKey: string;

    if (Buffer.isBuffer(image)) {
      imageKey = await this.fileHandler.uploadImage(image);
    } else {
      // URL 方式
      imageKey = await this.fileHandler.uploadImageFromUrl(image);
    }

    await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'image',
        content: JSON.stringify({ image_key: imageKey }),
      },
    });

    // 如果有 caption，发送额外文本
    if (caption) {
      await this.sendText(chatId, caption);
    }
  }

  async sendFile(chatId: string, file: Buffer | string, fileName: string): Promise<void> {
    let fileKey: string;

    if (Buffer.isBuffer(file)) {
      fileKey = await this.fileHandler.uploadFile(file, fileName);
    } else {
      fileKey = await this.fileHandler.uploadFileFromUrl(file, fileName);
    }

    await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'file',
        content: JSON.stringify({ file_key: fileKey }),
      },
    });
  }

  async sendAudio(chatId: string, audio: Buffer | string, duration?: number): Promise<void> {
    // 飞书音频消息 (opus 格式)
    let mediaKey: string;

    if (Buffer.isBuffer(audio)) {
      mediaKey = await this.fileHandler.uploadMedia(audio, 'opus');
    } else {
      mediaKey = await this.fileHandler.uploadMediaFromUrl(audio, 'opus');
    }

    await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'audio',
        content: JSON.stringify({
          file_key: mediaKey,
          duration: duration || 0,
        }),
      },
    });
  }

  async sendCard(chatId: string, card: any): Promise<void> {
    await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      },
    });
  }
}
```

### 4.6 飞书文件处理器

```typescript
// src/platform/feishu/file-handler.ts

import * as lark from '@larksuiteoapi/node-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import fetch from 'node-fetch';

export class FeishuFileHandler {
  private client: lark.Client;

  constructor(client: lark.Client) {
    this.client = client;
  }

  /**
   * 上传图片
   */
  async uploadImage(imageBuffer: Buffer, fileName?: string): Promise<string> {
    const tmpPath = this.saveToTemp(imageBuffer, fileName || 'image.png');

    const response = await this.client.im.image.resources.put({
      data: {
        image_type: 'message',
        image: fs.createReadStream(tmpPath),
      },
    });

    // 清理临时文件
    fs.unlinkSync(tmpPath);

    return response.data?.image_key || '';
  }

  /**
   * 从 URL 上传图片
   */
  async uploadImageFromUrl(url: string): Promise<string> {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadImage(buffer, path.basename(url));
  }

  /**
   * 上传文件
   */
  async uploadFile(fileBuffer: Buffer, fileName: string): Promise<string> {
    const tmpPath = this.saveToTemp(fileBuffer, fileName);

    const response = await this.client.drive.files.upload({
      data: {
        file_name: fileName,
        file_size: fileBuffer.length,
        block_size: fileBuffer.length,
        block_sha1: await this.calculateSha1(fileBuffer),
      },
      file: fs.createReadStream(tmpPath),
    });

    fs.unlinkSync(tmpPath);

    return response.data?.file_token || '';
  }

  /**
   * 从 URL 上传文件
   */
  async uploadFileFromUrl(url: string, fileName: string): Promise<string> {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadFile(buffer, fileName);
  }

  /**
   * 上传媒体文件 (音频)
   */
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

  /**
   * 从 URL 上传媒体
   */
  async uploadMediaFromUrl(url: string, format: string): Promise<string> {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadMedia(buffer, format);
  }

  /**
   * 下载文件
   */
  async downloadFile(fileKey: string): Promise<Buffer> {
    const response = await this.client.im.file.resources.get({
      path: {
        file_key: fileKey,
      },
    });

    // 收集所有数据块
    const chunks: Buffer[] = [];
    for await (const chunk of response) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      }
    }

    return Buffer.concat(chunks);
  }

  // 辅助方法
  private saveToTemp(buffer: Buffer, fileName: string): string {
    const tmpDir = path.join(os.tmpdir(), 'karma-feishu');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const tmpPath = path.join(tmpDir, fileName);
    fs.writeFileSync(tmpPath, buffer);
    return tmpPath;
  }

  private async calculateSha1(buffer: Buffer): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha1').update(buffer).digest('hex');
  }
}
```

---

## 五、平台集成

### 5.1 Platform Manager

```typescript
// src/platform/manager.ts

import type { PlatformAdapter, PlatformConfig } from './types.js';
import { CLIAdapter } from './cli/adapter.js';
import { FeishuAdapter } from './feishu/adapter.js';
import type { KarmaConfig } from '@/config/loader.js';

export class PlatformManager {
  private adapters: Map<string, PlatformAdapter> = new Map();

  async initialize(config: KarmaConfig): Promise<void> {
    // CLI (始终启用)
    const cliAdapter = new CLIAdapter();
    this.adapters.set('cli', cliAdapter);
    await cliAdapter.start();

    // Feishu
    if (config.platforms?.feishu?.enabled) {
      const feishuAdapter = new FeishuAdapter({
        appId: config.platforms.feishu.appId,
        appSecret: config.platforms.feishu.appSecret,
        enabled: true,
      });
      this.adapters.set('feishu', feishuAdapter);
      await feishuAdapter.start();
    }

    // Discord (未来)
    // if (config.platforms?.discord?.enabled) { ... }

    // Telegram (未来)
    // if (config.platforms?.telegram?.enabled) { ... }
  }

  getAdapter(platform: string): PlatformAdapter | undefined {
    return this.adapters.get(platform);
  }

  getAllAdapters(): PlatformAdapter[] {
    return Array.from(this.adapters.values());
  }

  async stopAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.stop();
    }
    this.adapters.clear();
  }
}
```

### 5.2 配置扩展

```yaml
# ~/.karma/config.yaml

# ... 现有配置 ...

# 平台配置
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

## 六、消息格式转换

### 6.1 Markdown → 平台格式

```typescript
// src/platform/message-formatter.ts

export interface MessageFormatter {
  formatText(text: string): string;
  formatMarkdown(md: string): any;
  formatCode(code: string, lang?: string): any;
}

// 飞书格式化器
export class FeishuMessageFormatter implements MessageFormatter {
  formatText(text: string): string {
    return text;
  }

  formatMarkdown(md: string): any {
    // 飞书不支持 Markdown，转为纯文本或卡片
    return { text: this.stripMarkdown(md) };
  }

  formatCode(code: string, lang?: string): any {
    // 飞书代码块
    return {
      text: `\`\`\`${lang || ''}\n${code}\n\`\`\``,
    };
  }

  private stripMarkdown(md: string): string {
    return md
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1');
  }
}

// Discord 格式化器
export class DiscordMessageFormatter implements MessageFormatter {
  formatText(text: string): string {
    return text;
  }

  formatMarkdown(md: string): any {
    // Discord 支持 Markdown
    return { text: md };
  }

  formatCode(code: string, lang?: string): any {
    return { text: `\`\`\`${lang || ''}\n${code}\n\`\`\`` };
  }
}
```

---

## 七、测试策略

### 7.1 单元测试

| 模块 | 测试重点 |
|------|----------|
| PlatformAdapter | 接口实现 |
| FeishuSender | 消息发送 |
| FeishuFileHandler | 文件上传下载 |
| MessageFormatter | 格式转换 |

### 7.2 集成测试

| 场景 | 测试内容 |
|------|----------|
| CLI 启动 | REPL 循环 |
| Feishu 连接 | WebSocket 连接 |
| 消息收发 | 双向消息 |
| 文件传输 | 上传下载 |

### 7.3 E2E 测试

- Agent-vs-Agent (已有)
- Feishu Bot 测试 (新建)

---

## 八、实施计划

### Phase 5.1: 基础架构 (2h)

- [ ] 创建 `src/platform/types.ts`
- [ ] 创建 `src/platform/adapter.ts`
- [ ] 重构 CLI 为 CLIAdapter
- [ ] 更新 index.ts 使用 PlatformManager

### Phase 5.2: 飞书适配器 (3h)

- [ ] 创建 `src/platform/feishu/adapter.ts`
- [ ] 创建 `src/platform/feishu/sender.ts`
- [ ] 创建 `src/platform/feishu/file-handler.ts`
- [ ] 实现 sendText, sendImage, sendFile, sendAudio

### Phase 5.3: 消息处理 (2h)

- [ ] 创建 `src/platform/feishu/receiver.ts`
- [ ] 实现消息接收和事件转换
- [ ] 实现命令解析

### Phase 5.4: 测试 (2h)

- [ ] FeishuAdapter 单元测试
- [ ] FeishuSender 测试
- [ ] FileHandler 测试
- [ ] 集成测试

### Phase 5.5: 文档 (1h)

- [ ] 更新 README
- [ ] 添加飞书配置指南
- [ ] 添加 Discord/Telegram 扩展指南

---

## 九、工作量估算

| 阶段 | 工作量 |
|------|--------|
| Phase 5.1 | 2h |
| Phase 5.2 | 3h |
| Phase 5.3 | 2h |
| Phase 5.4 | 2h |
| Phase 5.5 | 1h |
| **总计** | **10h** |

---

## 十、依赖

```json
{
  "dependencies": {
    "@larksuiteoapi/node-sdk": "^1.0.0",
    "node-fetch": "^3.0.0"
  }
}
```

---

## 十一、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 飞书 API 限制 | 实现速率限制 |
| 文件大小限制 | 分片上传 |
| WebSocket 断连 | 自动重连 |
| 格式兼容性 | 降级处理 |

---

**准备好开始实施了吗？**
