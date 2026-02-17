// Logger Implementation - 基于 Pino 的日志实现

import pino, { type Logger as PinoLogger, type LoggerOptions as PinoOptions } from 'pino';
import type {
  Logger,
  LogContext,
  ProgramLogEntry,
  AuditLogEntry,
  LogModule,
  LogLevel,
} from './types.js';

export interface KarmaLoggerOptions {
  module?: LogModule;
  level?: LogLevel;
  pinoOptions?: PinoOptions;
  auditLogFile?: string;
}

// 映射我们的日志级别到 Pino
const LEVEL_MAP: Record<LogLevel, string> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

export class KarmaLogger implements Logger {
  private module?: LogModule;
  private level: LogLevel;
  private baseContext: LogContext;
  private pino: PinoLogger;
  private auditPino?: PinoLogger;

  constructor(options: KarmaLoggerOptions = {}) {
    this.module = options.module;
    this.level = options.level ?? 'debug';
    this.baseContext = {};

    // 创建 Pino logger
    this.pino = pino({
      level: LEVEL_MAP[this.level],
      formatters: {
        level: (label: string) => ({ level: label }),
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      base: undefined, // 不添加默认的 pid 和 hostname
      ...options.pinoOptions,
    });

    // 审计日志使用单独的 Pino 实例
    if (options.auditLogFile) {
      // 动态导入 pino/file
      import('pino/file').then(({ destination }) => {
        this.auditPino = pino(
          {
            level: 'info',
            formatters: {
              level: () => ({ level: 'audit' }),
            },
            timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
            base: undefined,
          },
          destination(options.auditLogFile!)
        );
      }).catch(() => {
        // 忽略错误
      });
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const mergedContext = this.mergeContext(context);
    const entry: ProgramLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      module: mergedContext.module ?? this.module ?? 'system',
      ...this.extractContext(mergedContext),
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.pino.error(entry, message);
  }

  audit(event: AuditLogEntry): void {
    const entry: AuditLogEntry = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    if (this.auditPino) {
      this.auditPino.info(entry, event.action);
    } else {
      // 如果没有单独的审计日志文件，也写入主日志
      this.pino.info({ audit: true, ...entry }, `[AUDIT] ${event.action}`);
    }
  }

  startTimer(operation: string): () => number {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      return duration;
    };
  }

  child(context: LogContext): Logger {
    const childLogger = new KarmaLogger({
      module: context.module ?? this.module,
      level: this.level,
    });
    childLogger.baseContext = { ...this.baseContext, ...context };

    // 创建子 Pino logger
    childLogger.pino = this.pino.child({
      module: context.module ?? this.module,
      ...context,
    });

    return childLogger;
  }

  // ===== Private =====

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const mergedContext = this.mergeContext(context);

    const entry: ProgramLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      module: mergedContext.module ?? this.module ?? 'system',
      ...this.extractContext(mergedContext),
    };

    // 使用 Pino 的对应方法
    switch (level) {
      case 'debug':
        this.pino.debug(entry, message);
        break;
      case 'info':
        this.pino.info(entry, message);
        break;
      case 'warn':
        this.pino.warn(entry, message);
        break;
      case 'error':
        this.pino.error(entry, message);
        break;
    }
  }

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.baseContext, ...context };
  }

  private extractContext(context: LogContext): Partial<ProgramLogEntry> {
    const result: Partial<ProgramLogEntry> = {};

    if (context.operation) result.operation = context.operation;
    if (context.sessionId) result.sessionId = context.sessionId;
    if (context.clientId) result.clientId = context.clientId;
    if (context.traceId) result.traceId = context.traceId;
    if (context.metadata) result.metadata = context.metadata;

    return result;
  }
}
