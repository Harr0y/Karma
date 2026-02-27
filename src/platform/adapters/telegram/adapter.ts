// Telegram Adapter - Telegram 平台适配器

import type {
  PlatformAdapter,
  IncomingMessage,
  MessageHandler,
  MediaContent,
} from '../../types.js';
import type { TelegramConfig, TelegramUpdate, TelegramApiResponse } from './types.js';
import { escapeHtml, splitMessage, callTelegramApi } from './message-utils.js';
import { getLogger } from '@/logger/index.js';
import type { Logger } from '@/logger/types.js';

/**
 * Telegram 平台适配器
 * 实现 PlatformAdapter 接口，支持 Polling 模式
 */
export class TelegramAdapter implements PlatformAdapter {
  readonly platform = 'telegram' as const;

  private config: TelegramConfig;
  private messageHandlers: MessageHandler[] = [];
  private running = false;
  private logger: Logger;

  // update_id 去重缓存
  private processedUpdates = new Map<number, number>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  // Polling 相关
  private pollingTimer?: ReturnType<typeof setInterval>;
  private lastUpdateId = 0;
  private isPolling = false;

  // 连接失败追踪（用于自动禁用和减少日志噪音）
  private consecutiveFailures = 0;
  private static readonly MAX_FAILURES_BEFORE_DISABLE = 5;
  private static readonly MAX_FAILURES_BEFORE_REDUCED_LOGGING = 3;
  private static readonly AUTO_RETRY_INTERVAL = 300000; // 5 分钟自动重试
  private telegramDisabled = false;
  private autoRetryTimer?: ReturnType<typeof setInterval>;

  constructor(config: TelegramConfig) {
    this.config = {
      enabled: true,
      maxMessageLength: 4096,
      apiRetryAttempts: 3,
      apiRetryDelay: 1000,
      deduplicationTTL: 3600000, // 1 hour default
      pollingInterval: 1000, // 1 second default
      pollingTimeout: 30, // 30 seconds long polling
      ...config,
    };
    this.logger = getLogger().child({ module: 'platform' });
  }

  /**
   * 启动适配器
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('适配器未启用', {
        operation: 'start',
        metadata: { platform: 'telegram' },
      });
      return;
    }

    this.logger.info('启动 Telegram 适配器 (Polling 模式)', { operation: 'start' });
    this.running = true;

    // 启动去重清理定时器
    this.startDeduplicationCleanup();

    // 启动 Polling
    this.startPolling();

    this.logger.info('Telegram 适配器已启动', { operation: 'started' });
  }

  /**
   * 停止适配器
   */
  async stop(): Promise<void> {
    this.running = false;

    // 清理 Polling 定时器
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    // 清理去重定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // 清理自动重试定时器
    this.stopAutoRetry();

    this.processedUpdates.clear();
    this.logger.info('Telegram 适配器已停止', { operation: 'stop' });
  }

  /**
   * 检查是否运行中
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 检查是否被禁用
   */
  isDisabled(): boolean {
    return this.telegramDisabled;
  }

  /**
   * 手动启用（从禁用状态恢复）
   */
  enable(): void {
    if (this.telegramDisabled) {
      this.telegramDisabled = false;
      this.consecutiveFailures = 0;
      this.logger.info('Telegram 适配器已手动恢复', {
        operation: 'telegram_manual_enable',
      });
    }
  }

  /**
   * 注册消息处理器
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * 启动 Polling 轮询
   */
  private startPolling(): void {
    // 立即执行一次
    this.poll();

    // 设置定时轮询
    this.pollingTimer = setInterval(() => {
      this.poll();
    }, this.config.pollingInterval);
  }

  /**
   * 执行一次 Polling 请求
   */
  private async poll(): Promise<void> {
    // 防止重叠请求
    if (this.isPolling || !this.running) {
      return;
    }

    this.isPolling = true;

    try {
      const updates = await this.getUpdates();

      for (const update of updates) {
        // 更新 lastUpdateId
        if (update.update_id > this.lastUpdateId) {
          this.lastUpdateId = update.update_id;
        }

        // 去重检查
        if (this.isDuplicateUpdate(update.update_id)) {
          this.logger.debug('跳过重复 update', {
            operation: 'polling_skip',
            metadata: { updateId: update.update_id, reason: 'duplicate' },
          });
          continue;
        }

        // 标记已处理
        this.markProcessed(update.update_id);

        // 解析消息
        const message = this.parseUpdate(update);
        if (!message) {
          continue;
        }

        // 分发给处理器
        for (const handler of this.messageHandlers) {
          try {
            await handler(message);
          } catch (err) {
            this.logger.error('消息处理错误', err instanceof Error ? err : undefined, {
              operation: 'handler_error',
              metadata: { messageId: message.id },
            });
          }
        }
      }
    } catch (err) {
      this.logger.error('Polling 错误', err instanceof Error ? err : undefined, {
        operation: 'polling_error',
      });
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * 调用 getUpdates API 获取新消息
   */
  private async getUpdates(): Promise<TelegramUpdate[]> {
    // 如果已被自动禁用，检查是否应该自动重试
    if (this.telegramDisabled) {
      // 启动自动重试定时器（如果还没启动）
      if (!this.autoRetryTimer) {
        this.startAutoRetry();
      }
      return [];
    }

    try {
      const result = await callTelegramApi<TelegramUpdate[]>(
        this.config.botToken,
        'getUpdates',
        {
          offset: this.lastUpdateId + 1, // 只获取比 lastUpdateId 大的更新
          timeout: this.config.pollingTimeout,
          allowed_updates: ['message', 'edited_message', 'channel_post', 'edited_channel_post'],
        },
        {
          retryAttempts: 2,
          retryDelay: this.config.apiRetryDelay,
        }
      );

      // 成功时重置失败计数
      this.consecutiveFailures = 0;
      return result;
    } catch (err) {
      this.consecutiveFailures++;

      // 检查是否应该自动禁用
      if (this.consecutiveFailures >= TelegramAdapter.MAX_FAILURES_BEFORE_DISABLE) {
        this.telegramDisabled = true;
        this.logger.warn('Telegram 连接连续失败过多，已自动禁用。5分钟后将自动重试。', {
          operation: 'telegram_auto_disabled',
          metadata: {
            consecutiveFailures: this.consecutiveFailures,
            hint: '确保 HTTPS_PROXY 环境变量正确配置，或调用 enable() 手动恢复',
          },
        });
        return [];
      }

      // 减少日志噪音：前几次正常记录，之后只每隔一段时间记录一次
      const shouldLog = this.consecutiveFailures <= TelegramAdapter.MAX_FAILURES_BEFORE_REDUCED_LOGGING
        || this.consecutiveFailures % 10 === 0;

      if (shouldLog) {
        this.logger.error('getUpdates API 调用失败', err instanceof Error ? err : undefined, {
          operation: 'get_updates_error',
          metadata: {
            consecutiveFailures: this.consecutiveFailures,
            errorType: err?.constructor?.name,
          },
        });
      }
      return [];
    }
  }

  /**
   * 启动自动重试定时器
   */
  private startAutoRetry(): void {
    this.autoRetryTimer = setInterval(async () => {
      if (!this.telegramDisabled) {
        this.stopAutoRetry();
        return;
      }

      this.logger.info('尝试恢复 Telegram 连接...', {
        operation: 'telegram_auto_retry',
      });

      try {
        // 尝试调用 API
        await callTelegramApi(
          this.config.botToken,
          'getMe',
          {},
          { retryAttempts: 1, retryDelay: 1000 }
        );

        // 成功，恢复正常状态
        this.telegramDisabled = false;
        this.consecutiveFailures = 0;
        this.stopAutoRetry();
        this.logger.info('Telegram 连接已自动恢复', {
          operation: 'telegram_auto_recovered',
        });
      } catch (err) {
        this.logger.debug('Telegram 自动重试失败，将继续等待', {
          operation: 'telegram_auto_retry_failed',
        });
      }
    }, TelegramAdapter.AUTO_RETRY_INTERVAL);
  }

  /**
   * 停止自动重试定时器
   */
  private stopAutoRetry(): void {
    if (this.autoRetryTimer) {
      clearInterval(this.autoRetryTimer);
      this.autoRetryTimer = undefined;
    }
  }

  /**
   * 发送文本消息
   */
  async sendMessage(
    chatId: string,
    content: string,
    options?: { replyTo?: string }
  ): Promise<string> {
    // HTML 转义
    const escapedContent = escapeHtml(content);

    // 分割长消息
    const messages = splitMessage(escapedContent, this.config.maxMessageLength);

    let lastMessageId = '';

    for (const text of messages) {
      const params: Record<string, unknown> = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      };

      if (options?.replyTo) {
        params.reply_to_message_id = options.replyTo;
      }

      const result = await callTelegramApi<{ message_id: number }>(
        this.config.botToken,
        'sendMessage',
        params,
        {
          retryAttempts: this.config.apiRetryAttempts,
          retryDelay: this.config.apiRetryDelay,
        }
      );

      lastMessageId = String(result.message_id);
    }

    return lastMessageId;
  }

  /**
   * 发送打字指示器
   */
  async sendTypingIndicator(chatId: string): Promise<void> {
    await callTelegramApi(
      this.config.botToken,
      'sendChatAction',
      {
        chat_id: chatId,
        action: 'typing',
      },
      {
        retryAttempts: 1,
        retryDelay: this.config.apiRetryDelay,
      }
    );
  }

  /**
   * 解析 Telegram Update 为统一消息格式
   */
  private parseUpdate(update: TelegramUpdate): IncomingMessage | null {
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;

    if (!message) {
      return null;
    }

    // 过滤 Bot 消息
    if (message.from?.is_bot) {
      this.logger.debug('跳过 Bot 消息', {
        operation: 'parse_skip',
        metadata: { messageId: message.message_id, reason: 'bot' },
      });
      return null;
    }

    // 提取文本内容
    const text = message.text || message.caption || '';

    // 提取媒体内容
    let media: IncomingMessage['media'];
    if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      media = {
        type: 'image',
        fileId: largestPhoto.file_id,
      };
    } else if (message.document) {
      media = {
        type: 'file',
        fileId: message.document.file_id,
        fileName: message.document.file_name,
        mimeType: message.document.mime_type,
      };
    } else if (message.audio) {
      media = {
        type: 'audio',
        fileId: message.audio.file_id,
        fileName: message.audio.file_name,
        mimeType: message.audio.mime_type,
      };
    } else if (message.video) {
      media = {
        type: 'video',
        fileId: message.video.file_id,
        fileName: message.video.file_name,
        mimeType: message.video.mime_type,
      };
    }

    return {
      id: String(update.update_id),
      platform: 'telegram',
      chatId: String(message.chat.id),
      userId: message.from ? String(message.from.id) : undefined,
      senderType: message.from?.is_bot ? 'bot' : 'user',
      text,
      media,
      timestamp: message.date * 1000,
      replyTo: message.reply_to_message ? String(message.reply_to_message.message_id) : undefined,
    };
  }

  /**
   * 检查是否是重复的 update_id
   */
  private isDuplicateUpdate(updateId: number): boolean {
    const processed = this.processedUpdates.get(updateId);
    if (!processed) return false;

    const age = Date.now() - processed;
    return age < (this.config.deduplicationTTL || 3600000);
  }

  /**
   * 标记 update_id 已处理
   */
  private markProcessed(updateId: number): void {
    this.processedUpdates.set(updateId, Date.now());
  }

  /**
   * 启动去重缓存清理定时器
   */
  private startDeduplicationCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldUpdates();
    }, 60000); // 每分钟清理一次
  }

  /**
   * 清理过期的 update_id 记录
   */
  private cleanupOldUpdates(): void {
    const now = Date.now();
    const ttl = this.config.deduplicationTTL || 3600000;

    for (const [updateId, timestamp] of this.processedUpdates) {
      if (now - timestamp > ttl) {
        this.processedUpdates.delete(updateId);
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): { processedCount: number; handlerCount: number } {
    return {
      processedCount: this.processedUpdates.size,
      handlerCount: this.messageHandlers.length,
    };
  }
}
