// Session Manager Types

export type Platform = 'cli' | 'feishu' | 'discord' | 'telegram';

export interface ActiveSession {
  id: string;
  clientId?: string;
  sdkSessionId?: string;
  platform: Platform;
  externalChatId?: string;
  startedAt: Date;
}

/**
 * 会话身份标识（用于复合键）
 */
export interface SessionIdentity {
  platform: Platform;
  chatId: string;
  userId?: string;
}

/**
 * 会话复合键: "platform:chatId"
 */
export function getSessionKey(identity: SessionIdentity): string {
  return `${identity.platform}:${identity.chatId}`;
}

export interface GetOrCreateSessionContext {
  platform: Platform;
  externalChatId?: string;
  clientId?: string;
}

export interface SessionManagerOptions {
  storage: StorageService;
}

// Import StorageService type
import type { StorageService } from '@/storage/service.js';
