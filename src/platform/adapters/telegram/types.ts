// Telegram Types - Telegram Bot API 类型定义

/**
 * Telegram 适配器配置
 */
export interface TelegramConfig {
  /** Bot Token (from BotFather) */
  botToken: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 最大消息长度 (Telegram 限制 4096) */
  maxMessageLength?: number;
  /** API 重试次数 */
  apiRetryAttempts?: number;
  /** API 重试延迟 (毫秒) */
  apiRetryDelay?: number;
  /** 去重 TTL (毫秒) */
  deduplicationTTL?: number;
  /** Polling 轮询间隔 (毫秒, 默认 1000) */
  pollingInterval?: number;
  /** Polling 超时时间 (毫秒, 默认 30 秒, long polling) */
  pollingTimeout?: number;
}

/**
 * Telegram Update 对象
 * https://core.telegram.org/bots/api#update
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/**
 * Telegram Message 对象
 * https://core.telegram.org/bots/api#message
 */
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_date?: number;
  reply_to_message?: TelegramMessage;
  text?: string;
  caption?: string;
  entities?: TelegramEntity[];
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  audio?: TelegramAudio;
  video?: TelegramVideo;
  voice?: TelegramVoice;
  sticker?: TelegramSticker;
  contact?: TelegramContact;
  location?: TelegramLocation;
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
}

/**
 * Telegram User 对象
 * https://core.telegram.org/bots/api#user
 */
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Telegram Chat 对象
 * https://core.telegram.org/bots/api#chat
 */
export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Telegram Entity 对象
 * https://core.telegram.org/bots/api#messageentity
 */
export interface TelegramEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

/**
 * Telegram Photo Size 对象
 * https://core.telegram.org/bots/api#photosize
 */
export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

/**
 * Telegram Document 对象
 * https://core.telegram.org/bots/api#document
 */
export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumb?: TelegramPhotoSize;
}

/**
 * Telegram Audio 对象
 * https://core.telegram.org/bots/api#audio
 */
export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumb?: TelegramPhotoSize;
}

/**
 * Telegram Video 对象
 * https://core.telegram.org/bots/api#video
 */
export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumb?: TelegramPhotoSize;
}

/**
 * Telegram Voice 对象
 * https://core.telegram.org/bots/api#voice
 */
export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

/**
 * Telegram Sticker 对象
 * https://core.telegram.org/bots/api#sticker
 */
export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  is_animated?: boolean;
  is_video?: boolean;
  thumb?: TelegramPhotoSize;
  emoji?: string;
  set_name?: string;
  file_size?: number;
}

/**
 * Telegram Contact 对象
 * https://core.telegram.org/bots/api#contact
 */
export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
}

/**
 * Telegram Location 对象
 * https://core.telegram.org/bots/api#location
 */
export interface TelegramLocation {
  longitude: number;
  latitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

/**
 * Telegram Callback Query 对象
 * https://core.telegram.org/bots/api#callbackquery
 */
export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

/**
 * Telegram API Response
 * https://core.telegram.org/bots/api#making-requests
 */
export interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

/**
 * Send Message 参数
 */
export interface SendMessageParams {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  entities?: TelegramEntity[];
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  protect_content?: boolean;
  message_thread_id?: number;
}

/**
 * Send Chat Action 参数
 */
export interface SendChatActionParams {
  chat_id: number | string;
  action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'choose_sticker' | 'find_location' | 'record_video_note' | 'upload_video_note';
  message_thread_id?: number;
}

/**
 * Get File 参数
 */
export interface GetFileParams {
  file_id: string;
}

/**
 * Telegram File 对象
 * https://core.telegram.org/bots/api#file
 */
export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}
