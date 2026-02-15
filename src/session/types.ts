// Session Manager Types

export type Platform = 'cli' | 'feishu' | 'wechat';

export interface ActiveSession {
  id: string;
  clientId?: string;
  sdkSessionId?: string;
  platform: Platform;
  externalChatId?: string;
  startedAt: Date;
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
