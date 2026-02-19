// Logger Types - 日志系统类型定义 (基于 Pino)

import type { Platform } from '@/platform/types.js';

// ===== 日志级别 =====

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ===== 日志模块 =====

export type LogModule = 'system' | 'agent' | 'storage' | 'platform' | 'session' | 'persona' | 'api-server';

// ===== 日志上下文 =====

export interface LogContext {
  module?: LogModule;
  operation?: string;
  sessionId?: string;
  clientId?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
}

// ===== Logger 接口 =====

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  audit(event: AuditLogEntry): void;
  startTimer(operation: string): () => number;
  child(context: LogContext): Logger;
}

// ===== 审计日志 =====

export type AuditEventType =
  | 'user.message'
  | 'user.command'
  | 'agent.assertion'
  | 'agent.prediction'
  | 'session.create'
  | 'session.resume'
  | 'session.end';

export interface AuditLogEntry {
  timestamp: string;
  eventType: AuditEventType;
  platform: Platform;
  chatId: string;
  userId?: string;
  clientId?: string;
  sessionId?: string;
  action: string;
  details: Record<string, unknown>;
  result: 'success' | 'failure';
  errorMessage?: string;
}

// ===== 配置 (简化) =====

export interface LoggingConfig {
  program: {
    level: LogLevel;
    outputs: Array<{ type: 'console' | 'file'; colorize?: boolean; path?: string }>;
  };
  audit: {
    outputs: Array<{ type: 'console' | 'file'; path?: string }>;
  };
}
