// CLI Output Adapter - CLI 输出适配器

import type { OutputAdapter, OutputContent, OutputMessageType } from '../types.js';
import type { Platform } from '../../platform/types.js';

/**
 * CLI 输出适配器 - 带颜色
 */
export class CLIOutputAdapter implements OutputAdapter {
  readonly platform: Platform = 'cli';
  readonly chatId: string;

  constructor(chatId: string) {
    this.chatId = chatId;
  }

  async write(content: OutputContent): Promise<void> {
    const colored = this.colorize(content);
    process.stdout.write(colored);
  }

  async flush(): Promise<void> {
    // CLI 不需要缓冲
  }

  private colorize(content: OutputContent): string {
    const colors: Record<OutputMessageType, string> = {
      text: '\x1b[0m',       // 默认
      thinking: '\x1b[90m',  // 灰色
      tool_use: '\x1b[33m',  // 黄色
      tool_result: '\x1b[32m', // 绿色
      error: '\x1b[31m',     // 红色
      complete: '\x1b[36m',  // 青色
    };

    const reset = '\x1b[0m';
    const color = colors[content.type];
    return `${color}${content.text}${reset}`;
  }
}
