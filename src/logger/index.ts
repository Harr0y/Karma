// Logger Module Entry

export * from './types.js';
export * from './logger.js';

import { KarmaLogger, type KarmaLoggerOptions } from './logger.js';
import type { Logger, LoggingConfig } from './types.js';
import { join } from 'path';
import { homedir } from 'os';

/**
 * 创建 Logger 实例
 */
export function createLogger(config?: Partial<LoggingConfig>): Logger {
  const programConfig = config?.program;
  const auditConfig = config?.audit;

  // 查找文件输出路径
  const programFile = programConfig?.outputs?.find(o => o.type === 'file');
  const auditFile = auditConfig?.outputs?.find(o => o.type === 'file');

  const options: KarmaLoggerOptions = {
    level: programConfig?.level ?? 'debug',
    auditLogFile: auditFile?.path,
    pinoOptions: {
      // 如果有文件路径，使用文件输出
      transport: programFile ? {
        target: 'pino/file',
        options: { destination: programFile.path },
      } : {
        // 否则使用 pino-pretty 美化输出
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    },
  };

  return new KarmaLogger(options);
}

// 全局默认 logger
let globalLogger: Logger | null = null;

/**
 * 获取全局 Logger
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = createLogger({
      program: {
        level: 'debug',
        outputs: [
          { type: 'console', colorize: true },
          { type: 'file', path: join(homedir(), '.karma', 'logs', 'program.log') },
        ],
      },
      audit: {
        outputs: [
          { type: 'file', path: join(homedir(), '.karma', 'logs', 'audit.log') },
        ],
      },
    });
  }
  return globalLogger;
}

/**
 * 设置全局 Logger
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger;
}
