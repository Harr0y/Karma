// SDK Message Types - SDK 消息类型定义和类型守卫

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * 工具结果消息类型
 * SDK 通过 user 消息返回工具执行结果
 */
export interface ToolResultMessage {
  type: 'user';
  tool_use_result: unknown;
  parent_tool_use_id?: string;
}

/**
 * 工具进度消息类型
 * 表示工具正在执行中
 */
export interface ToolProgressMessage {
  type: 'tool_progress';
  tool_name?: string;
  tool_use_id?: string;
  elapsed_time_seconds?: number;
}

/**
 * 工具使用摘要消息类型
 * 工具执行完成后的摘要信息
 */
export interface ToolUseSummaryMessage {
  type: 'tool_use_summary';
  summary?: string;
  preceding_tool_use_ids?: string[];
}

/**
 * 检查是否为工具结果消息
 */
export function isToolResultMessage(msg: SDKMessage): msg is SDKMessage & ToolResultMessage {
  return msg.type === 'user' && 'tool_use_result' in msg && msg.tool_use_result !== undefined;
}

/**
 * 检查是否为工具进度消息
 */
export function isToolProgressMessage(msg: SDKMessage): msg is SDKMessage & ToolProgressMessage {
  return msg.type === 'tool_progress';
}

/**
 * 检查是否为工具使用摘要消息
 */
export function isToolUseSummaryMessage(msg: SDKMessage): msg is SDKMessage & ToolUseSummaryMessage {
  return msg.type === 'tool_use_summary';
}
