// Telegram Adapter Module Export

export { TelegramAdapter } from './adapter.js';
export type { TelegramConfig, TelegramUpdate, TelegramMessage, TelegramUser, TelegramChat } from './types.js';
export { escapeHtml, splitMessage, callTelegramApi, getFileUrl } from './message-utils.js';
export type { ApiCallOptions } from './message-utils.js';
