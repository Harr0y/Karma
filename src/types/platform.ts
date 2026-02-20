/**
 * 统一的平台类型定义
 *
 * 所有模块应从此文件导入 Platform 类型，避免定义不一致
 */

/**
 * 支持的平台类型
 */
export type Platform = 'cli' | 'http' | 'feishu' | 'discord' | 'telegram';

/**
 * 平台连接模式
 * - stateless: 无状态，每次请求独立（如 HTTP）
 * - persistent: 长连接，会话持续（如 WebSocket）
 */
export type ConnectionMode = 'stateless' | 'persistent';

/**
 * 平台特性配置
 */
export interface PlatformFeatures {
  /** 是否支持流式输出 */
  streaming: boolean;
  /** 是否支持富文本/卡片 */
  richContent: boolean;
  /** 是否支持媒体消息 */
  media: boolean;
  /** 是否支持长消息 */
  longMessage: boolean;
}

/**
 * 平台完整配置
 */
export interface PlatformConfig {
  type: Platform;
  connectionMode: ConnectionMode;
  features: PlatformFeatures;
}

/**
 * 平台配置表
 *
 * 用于根据平台类型获取其特性配置
 */
export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  cli: {
    type: 'cli',
    connectionMode: 'persistent',
    features: {
      streaming: true,
      richContent: true,
      media: false,
      longMessage: true,
    },
  },
  http: {
    type: 'http',
    connectionMode: 'stateless',
    features: {
      streaming: true,
      richContent: false,
      media: false,
      longMessage: true,
    },
  },
  feishu: {
    type: 'feishu',
    connectionMode: 'persistent',
    features: {
      streaming: false,
      richContent: true,
      media: true,
      longMessage: false,
    },
  },
  discord: {
    type: 'discord',
    connectionMode: 'persistent',
    features: {
      streaming: false,
      richContent: true,
      media: true,
      longMessage: false,
    },
  },
  telegram: {
    type: 'telegram',
    connectionMode: 'persistent',
    features: {
      streaming: false,
      richContent: false,
      media: true,
      longMessage: false,
    },
  },
};

/**
 * 获取平台配置
 */
export function getPlatformConfig(platform: Platform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}

/**
 * 判断是否为无状态平台
 */
export function isStatelessPlatform(platform: Platform): boolean {
  return PLATFORM_CONFIGS[platform].connectionMode === 'stateless';
}

/**
 * 判断是否为长连接平台
 */
export function isPersistentPlatform(platform: Platform): boolean {
  return PLATFORM_CONFIGS[platform].connectionMode === 'persistent';
}
