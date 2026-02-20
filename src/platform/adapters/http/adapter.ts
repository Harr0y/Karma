/**
 * HTTP 无状态适配器
 *
 * 特点：
 * - 不维护长连接
 * - 通过 sessionId 恢复会话
 * - 支持 SSE 流式响应
 *
 * 使用场景：
 * - HTTP API 调用
 * - 测试环境
 * - 前端直接调用
 */

import type {
  PlatformAdapter,
  IncomingMessage,
  MessageHandler,
  SendMessageOptions,
} from '../../types.js';
import type { Platform } from '../../../types/platform.js';

/**
 * 生成唯一 ID
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}${random}`;
}

/**
 * HTTP 适配器响应回调
 */
export type ResponseCallback = (
  type: 'text' | 'tool_use' | 'done' | 'error',
  content: string,
  metadata?: Record<string, unknown>
) => void;

/**
 * HTTP 无状态适配器
 *
 * 与其他长连接适配器不同，HTTP 适配器不主动监听消息。
 * 消息由 KarmaServer 通过 handleRequest() 方法传入。
 */
export class HttpAdapter implements PlatformAdapter {
  readonly platform: Platform = 'http';

  private messageHandlers: MessageHandler[] = [];
  private responseCallbacks: Map<string, ResponseCallback> = new Map();

  /**
   * HTTP 适配器不需要启动
   */
  async start(): Promise<void> {
    // 无状态，无需启动
  }

  /**
   * HTTP 适配器不需要停止
   */
  async stop(): Promise<void> {
    // 无状态，无需停止
  }

  /**
   * 始终返回 true（HTTP 服务始终可用）
   */
  isRunning(): boolean {
    return true;
  }

  /**
   * 处理 HTTP 请求
   * 由 KarmaServer 调用
   *
   * @param sessionId - 会话 ID
   * @param userId - 用户 ID
   * @param message - 消息内容
   * @returns IncomingMessage - 统一消息结构
   */
  async handleRequest(
    sessionId: string,
    userId: string,
    message: string
  ): Promise<IncomingMessage> {
    const incomingMessage: IncomingMessage = {
      id: generateId('http_msg'),
      platform: 'http',
      chatId: sessionId,
      userId,
      senderType: 'user',
      text: message,
      timestamp: Date.now(),
    };

    // 触发注册的消息处理器
    for (const handler of this.messageHandlers) {
      try {
        await handler(incomingMessage);
      } catch (err) {
        console.error('HTTP adapter message handler error:', err);
      }
    }

    return incomingMessage;
  }

  /**
   * 发送消息
   *
   * HTTP 适配器通过 SSE 流式返回，此方法触发注册的响应回调。
   *
   * @param chatId - 会话 ID
   * @param content - 消息内容
   * @param options - 发送选项
   */
  async sendMessage(
    chatId: string,
    content: string,
    options?: SendMessageOptions
  ): Promise<string> {
    const callback = this.responseCallbacks.get(chatId);
    if (callback) {
      callback('text', content, options?.metadata);
    }
    return content;
  }

  /**
   * 发送工具使用通知（内部消息，通常不发送给用户）
   */
  async sendToolUse(chatId: string, toolName: string): Promise<void> {
    const callback = this.responseCallbacks.get(chatId);
    if (callback) {
      callback('tool_use', toolName);
    }
  }

  /**
   * 发送完成信号
   */
  async sendDone(chatId: string): Promise<void> {
    const callback = this.responseCallbacks.get(chatId);
    if (callback) {
      callback('done', '');
    }
  }

  /**
   * 发送错误
   */
  async sendError(chatId: string, error: string): Promise<void> {
    const callback = this.responseCallbacks.get(chatId);
    if (callback) {
      callback('error', error);
    }
  }

  /**
   * 注册消息处理器
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * 注册响应回调（用于 SSE）
   *
   * @param sessionId - 会话 ID
   * @param callback - 响应回调函数
   */
  onResponse(sessionId: string, callback: ResponseCallback): void {
    this.responseCallbacks.set(sessionId, callback);
  }

  /**
   * 清除响应回调
   */
  clearResponseCallback(sessionId: string): void {
    this.responseCallbacks.delete(sessionId);
  }

  /**
   * 检查是否有响应回调
   */
  hasResponseCallback(sessionId: string): boolean {
    return this.responseCallbacks.has(sessionId);
  }
}
