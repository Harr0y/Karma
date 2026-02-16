// Output Types - 输出适配器类型定义

import type { Platform } from '../platform/types.js';

/**
 * 输出消息类型
 */
export type OutputMessageType =
  | 'text'          // 普通文本
  | 'thinking'      // 思考中
  | 'tool_use'      // 工具调用
  | 'tool_result'   // 工具结果
  | 'error'         // 错误
  | 'complete';     // 完成

/**
 * 输出内容
 */
export interface OutputContent {
  type: OutputMessageType;
  text: string;
  metadata?: {
    toolName?: string;
    duration?: number;
    cost?: number;
    [key: string]: unknown;
  };
}

/**
 * 输出适配器接口
 */
export interface OutputAdapter {
  readonly platform: Platform;
  readonly chatId: string;

  /**
   * 写入输出
   */
  write(content: OutputContent): Promise<void>;

  /**
   * 刷新缓冲区
   */
  flush?(): Promise<void>;
}

/**
 * 输出适配器配置
 */
export interface OutputAdapterConfig {
  throttleMs?: number;           // 节流间隔（毫秒）
  bufferSize?: number;           // 缓冲区大小
}

/**
 * 输出适配器工厂
 */
export interface OutputAdapterFactory {
  create(chatId: string, platform: Platform): OutputAdapter;
}
