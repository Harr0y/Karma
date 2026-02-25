// Platform Module Export

export * from './types.js';
export { MessageRouter } from './router.js';
export { FeishuAdapter } from './adapters/feishu/index.js';
export type { FeishuConfig } from './adapters/feishu/index.js';
export { TelegramAdapter, escapeHtml, splitMessage, callTelegramApi } from './adapters/telegram/index.js';
export type { TelegramConfig, TelegramUpdate, TelegramMessage } from './adapters/telegram/index.js';
