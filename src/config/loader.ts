// Config Loader - 加载配置文件

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse } from 'yaml';
import { getLogger } from '@/logger/index.js';

export interface TelegramConfigType {
  botToken: string;
  enabled?: boolean;
  maxMessageLength?: number;
  apiRetryAttempts?: number;
  apiRetryDelay?: number;
  pollingInterval?: number;
  pollingTimeout?: number;
}

export interface KarmaConfig {
  server: {
    host: string;
    port: number;
  };
  ai: {
    authToken: string;
    baseUrl: string;
    model: string;
    timeout: number;
  };
  storage: {
    type: 'sqlite';
    path: string;
  };
  skills: {
    dirs: string[];
    autoLoad: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file: string;
  };
  telegram?: TelegramConfigType;
}

const DEFAULT_CONFIG: KarmaConfig = {
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  ai: {
    authToken: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5-20250929',
    timeout: 300000,
  },
  storage: {
    type: 'sqlite',
    path: join(homedir(), '.karma', 'karma.db'),
  },
  skills: {
    dirs: [
      join(homedir(), '.karma', 'skills'),
    ],
    autoLoad: true,
  },
  logging: {
    level: 'info',
    file: join(homedir(), '.karma', 'logs', 'karma.log'),
  },
};

/**
 * 替换环境变量占位符和 ~ 路径
 * 格式: ${ENV_VAR:default_value}
 * 同时展开 ~ 为用户主目录
 */
function replaceEnvVars(str: string): string {
  let result = str;

  // 先展开 ~ 为用户主目录
  if (result.startsWith('~/')) {
    result = join(homedir(), result.slice(2));
  }

  // 再替换环境变量
  result = result.replace(/\$\{([^}:]+)(?::([^}]*))?\}/g, (_, envVar, defaultValue) => {
    return process.env[envVar] || defaultValue || '';
  });

  return result;
}

/**
 * 递归替换对象中的环境变量
 */
function deepReplaceEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    return replaceEnvVars(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(deepReplaceEnvVars);
  }
  if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepReplaceEnvVars(value);
    }
    return result;
  }
  return obj;
}

/**
 * 加载配置文件
 */
export function loadConfig(): KarmaConfig {
  const logger = getLogger().child({ module: 'system' });
  const configPaths = [
    join(homedir(), '.karma', 'config.yaml'),
    join(process.cwd(), 'config.yaml'),
  ];

  let config = { ...DEFAULT_CONFIG };

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        const parsed = parse(content);
        config = deepMerge(config, deepReplaceEnvVars(parsed));
        logger.debug('加载配置文件', {
          operation: 'config_load',
          metadata: { path: configPath },
        });
        break;
      } catch (err) {
        logger.warn('配置文件加载失败', {
          operation: 'config_error',
          metadata: {
            path: configPath,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }
  }

  // 验证必要配置
  if (!config.ai.authToken) {
    logger.warn('未设置 API authToken', { operation: 'config_warning' });
  }

  return config;
}

/**
 * 深度合并对象
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// 单例
let _config: KarmaConfig | null = null;

export function getConfig(): KarmaConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

export function resetConfig(): void {
  _config = null;
}
