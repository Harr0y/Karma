// Feishu Output Adapter - 飞书输出适配器（带节流）

import type { OutputAdapter, OutputContent } from '../types.js';
import type { Platform, PlatformAdapter } from '../../platform/types.js';

export interface FeishuOutputAdapterConfig {
  throttleMs?: number;  // 节流间隔
}

/**
 * 飞书输出适配器 - 支持卡片、节流
 */
export class FeishuOutputAdapter implements OutputAdapter {
  readonly platform: Platform = 'feishu';
  readonly chatId: string;

  private platformAdapter: PlatformAdapter;
  private buffer: string[] = [];
  private lastSendTime = 0;
  private throttleMs: number;
  private pendingFlush: Promise<void> | null = null;

  constructor(
    chatId: string,
    platformAdapter: PlatformAdapter,
    config: FeishuOutputAdapterConfig = {}
  ) {
    this.chatId = chatId;
    this.platformAdapter = platformAdapter;
    this.throttleMs = config.throttleMs ?? 500;
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
      const toolText = this.formatToolUse(content);
      await this.platformAdapter.sendMessage(this.chatId, toolText);
      return;
    }

    // 错误立即发送
    if (content.type === 'error') {
      await this.flush();
      await this.platformAdapter.sendMessage(this.chatId, content.text);
      return;
    }

    // 完成时刷新
    if (content.type === 'complete') {
      await this.flush();
      return;
    }

    // thinking 不发送
    if (content.type === 'thinking') {
      return;
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // 避免并发 flush
    if (this.pendingFlush) {
      await this.pendingFlush;
    }

    const text = this.buffer.join('');
    this.buffer = [];

    this.pendingFlush = this.platformAdapter.sendMessage(this.chatId, text);
    await this.pendingFlush;
    this.pendingFlush = null;

    this.lastSendTime = Date.now();
  }

  private async tryFlush(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSendTime >= this.throttleMs) {
      await this.flush();
    }
  }

  private formatToolUse(content: OutputContent): string {
    const toolName = content.metadata?.toolName || '工具';
    return `🔧 正在使用 ${toolName}...`;
  }

  /**
   * 强制刷新（忽略节流）
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * 获取缓冲区大小
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}
