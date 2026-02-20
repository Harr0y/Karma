// Platform Types - 平台适配器接口定义

// 从统一类型定义导入 Platform 类型
import type { Platform } from '../types/platform.js';
export type { Platform } from '../types/platform.js';

// Re-export platform utilities
export {
  getPlatformConfig,
  isStatelessPlatform,
  isPersistentPlatform,
} from '../types/platform.js';

/**
 * 统一的消息结构
 */
export interface IncomingMessage {
  id: string;                    // 消息唯一 ID
  platform: Platform;            // 来源平台
  chatId: string;                // 会话 ID（平台相关）
  userId?: string;               // 用户 ID
  senderType: 'user' | 'bot';    // 发送者类型

  // 内容
  text?: string;                 // 文本内容
  media?: MediaContent;          // 媒体内容

  // 元数据
  timestamp: number;             // 消息时间戳
  replyTo?: string;              // 回复的消息 ID
}

/**
 * 媒体内容
 */
export interface MediaContent {
  type: 'image' | 'audio' | 'video' | 'file';
  fileId: string;                // 平台文件 ID
  fileName?: string;
  mimeType?: string;
  size?: number;
  localPath?: string;            // 下载后的本地路径
}

/**
 * 发送消息选项
 */
export interface SendMessageOptions {
  type?: 'text' | 'card' | 'image' | 'audio' | 'file';
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 图片内容
 */
export interface ImageContent {
  data?: Buffer;
  url?: string;
  caption?: string;
}

/**
 * 音频内容
 */
export interface AudioContent {
  data?: Buffer;
  url?: string;
  duration?: number;
}

/**
 * 文件内容
 */
export interface FileContent {
  data?: Buffer;
  url?: string;
  fileName: string;
}

/**
 * 卡片内容 (平台特定)
 */
export interface CardContent {
  [key: string]: unknown;
}

/**
 * 消息处理器
 */
export type MessageHandler = (message: IncomingMessage) => Promise<void>;

/**
 * 平台适配器接口
 */
export interface PlatformAdapter {
  readonly platform: Platform;

  // 生命周期
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;

  // 消息发送
  sendMessage(chatId: string, content: string, options?: SendMessageOptions): Promise<string>;
  sendCard?(chatId: string, card: CardContent): Promise<string>;
  sendImage?(chatId: string, image: ImageContent): Promise<string>;
  sendAudio?(chatId: string, audio: AudioContent): Promise<string>;
  sendFile?(chatId: string, file: FileContent): Promise<string>;

  // 媒体处理
  downloadMedia?(media: MediaContent): Promise<string>;  // 返回本地路径

  // 事件
  onMessage(handler: MessageHandler): void;
}

/**
 * 平台适配器配置（运行时配置）
 * 注意：平台特性配置请使用 getPlatformConfig() 获取
 */
export interface AdapterConfig {
  enabled: boolean;
  [key: string]: unknown;
}
