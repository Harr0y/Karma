// Message Router - 消息路由器

import type { IncomingMessage, MessageHandler } from './types.js';
import { getLogger } from '@/logger/index.js';
import type { Logger } from '@/logger/types.js';

export interface MessageRouterConfig {
  maxMessageAge?: number;        // 消息最大年龄（毫秒）
  deduplicationTTL?: number;     // 去重缓存时间
}

/**
 * 消息路由器
 * - 消息去重
 * - 时效性检查
 * - Bot 消息过滤
 * - 路由到对应处理器
 */
export class MessageRouter {
  private processedMessages = new Map<string, number>();
  private handlers: MessageHandler[] = [];
  private config: Required<MessageRouterConfig>;
  private logger: Logger;

  constructor(config: MessageRouterConfig = {}) {
    this.config = {
      maxMessageAge: config.maxMessageAge ?? 24 * 60 * 60 * 1000, // 24 小时
      deduplicationTTL: config.deduplicationTTL ?? 60 * 60 * 1000, // 1 小时
    };
    this.logger = getLogger().child({ module: 'platform' });
  }

  /**
   * 处理消息入口
   */
  async route(message: IncomingMessage): Promise<void> {
    // 1. 去重检查
    if (this.isDuplicate(message.id)) {
      this.logger.debug('跳过重复消息', {
        operation: 'route_skip',
        metadata: { messageId: message.id, reason: 'duplicate' },
      });
      return;
    }

    // 2. 时效性检查
    if (this.isExpired(message)) {
      this.logger.debug('跳过过期消息', {
        operation: 'route_skip',
        metadata: { messageId: message.id, reason: 'expired' },
      });
      return;
    }

    // 3. Bot 自消息过滤
    if (message.senderType === 'bot') {
      this.logger.debug('跳过 Bot 消息', {
        operation: 'route_skip',
        metadata: { messageId: message.id, reason: 'bot' },
      });
      return;
    }

    // 4. 标记已处理
    this.markProcessed(message.id);

    // 5. 分发给处理器
    for (const handler of this.handlers) {
      try {
        await handler(message);
      } catch (err) {
        this.logger.error('处理器错误', err instanceof Error ? err : undefined, {
          operation: 'handler_error',
          metadata: { messageId: message.id },
        });
      }
    }
  }

  /**
   * 注册消息处理器
   */
  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  /**
   * 移除消息处理器
   */
  offMessage(handler: MessageHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  /**
   * 清除所有处理器
   */
  clearHandlers(): void {
    this.handlers = [];
  }

  private isDuplicate(messageId: string): boolean {
    const processed = this.processedMessages.get(messageId);
    if (!processed) return false;

    const age = Date.now() - processed;
    return age < this.config.deduplicationTTL;
  }

  private isExpired(message: IncomingMessage): boolean {
    const age = Date.now() - message.timestamp;
    return age > this.config.maxMessageAge;
  }

  private markProcessed(messageId: string): void {
    this.processedMessages.set(messageId, Date.now());
    this.cleanupOldEntries();
  }

  private cleanupOldEntries(): void {
    const now = Date.now();
    for (const [id, timestamp] of this.processedMessages) {
      if (now - timestamp > this.config.deduplicationTTL) {
        this.processedMessages.delete(id);
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): { processedCount: number; handlerCount: number } {
    return {
      processedCount: this.processedMessages.size,
      handlerCount: this.handlers.length,
    };
  }
}
