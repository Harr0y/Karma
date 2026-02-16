// Session Manager - 管理多平台会话

import type { StorageService } from '@/storage/service.js';
import type { ActiveSession, GetOrCreateSessionContext, Platform, SessionIdentity } from './types.js';
import { getSessionKey } from './types.js';

// Re-export for convenience
export { getSessionKey } from './types.js';
export type { SessionIdentity } from './types.js';

export class SessionManager {
  private storage: StorageService;
  private activeSessions: Map<string, ActiveSession>;
  private sessionLocks: Map<string, Promise<ActiveSession>>;

  constructor(storage: StorageService) {
    this.storage = storage;
    this.activeSessions = new Map();
    this.sessionLocks = new Map();
  }

  /**
   * 生成缓存键（使用 SessionIdentity 复合键）
   */
  private getCacheKey(platform: Platform, externalChatId?: string): string {
    return getSessionKey({ platform, chatId: externalChatId || platform });
  }

  /**
   * 获取内存中的会话 (不查 DB)
   */
  getSessionFromCache(cacheKey: string): ActiveSession | undefined {
    return this.activeSessions.get(cacheKey);
  }

  /**
   * 获取或创建会话
   * 1. 先从内存缓存获取
   * 2. 再从数据库恢复
   * 3. 最后创建新会话
   */
  async getOrCreateSession(context: GetOrCreateSessionContext): Promise<ActiveSession> {
    const { platform, externalChatId, clientId } = context;
    const cacheKey = this.getCacheKey(platform, externalChatId);

    // 检查是否有正在进行的请求，避免并发创建
    const pendingRequest = this.sessionLocks.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    // 创建新的请求 Promise
    const requestPromise = this._doGetOrCreateSession(context, cacheKey);
    this.sessionLocks.set(cacheKey, requestPromise);

    try {
      const session = await requestPromise;
      return session;
    } finally {
      this.sessionLocks.delete(cacheKey);
    }
  }

  private async _doGetOrCreateSession(
    context: GetOrCreateSessionContext,
    cacheKey: string
  ): Promise<ActiveSession> {
    const { platform, externalChatId, clientId } = context;

    // 1. 尝试从内存缓存获取
    const cached = this.activeSessions.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. 尝试从数据库恢复 (仅 Feishu 等有 externalChatId 的平台)
    // 使用复合键查询：platform:chatId
    if (externalChatId) {
      const dbSession = await this.storage.getSessionByExternalChatId(platform, externalChatId);
      if (dbSession && dbSession.status === 'active') {
        const activeSession: ActiveSession = {
          id: dbSession.id,
          clientId: dbSession.clientId ?? undefined,
          sdkSessionId: dbSession.sdkSessionId ?? undefined,
          platform: dbSession.platform as Platform,
          externalChatId: dbSession.externalChatId ?? undefined,
          startedAt: new Date(dbSession.startedAt),
        };
        // 使用复合键缓存
        this.activeSessions.set(cacheKey, activeSession);
        return activeSession;
      }
    }

    // 3. 创建新会话
    const sessionId = await this.storage.createSession({
      platform,
      externalChatId,
      clientId,
    });

    const newSession: ActiveSession = {
      id: sessionId,
      clientId,
      platform,
      externalChatId,
      startedAt: new Date(),
    };

    // 使用复合键缓存
    this.activeSessions.set(cacheKey, newSession);
    return newSession;
  }

  /**
   * 更新会话的 SDK session_id
   */
  async updateSdkSessionId(sessionId: string, sdkSessionId: string): Promise<void> {
    // 更新数据库
    await this.storage.updateSdkSessionId(sessionId, sdkSessionId);

    // 更新缓存
    for (const [key, session] of this.activeSessions.entries()) {
      if (session.id === sessionId) {
        session.sdkSessionId = sdkSessionId;
        break;
      }
    }
  }

  /**
   * 关联客户到会话
   */
  async linkClient(sessionId: string, clientId: string): Promise<void> {
    // 更新缓存
    for (const [key, session] of this.activeSessions.entries()) {
      if (session.id === sessionId) {
        session.clientId = clientId;
        // 注意：当前 Storage 不支持更新会话的 clientId
        // 如果需要，可以添加 updateSessionClient 方法
        break;
      }
    }
  }

  /**
   * 保存会话状态到数据库
   */
  async saveSession(session: ActiveSession): Promise<void> {
    // 当前会话创建时已写入 DB
    // 此方法用于显式保存 SDK session_id 等更新
    if (session.sdkSessionId) {
      await this.storage.updateSdkSessionId(session.id, session.sdkSessionId);
    }
  }

  /**
   * 结束会话
   */
  async endSession(sessionId: string, summary?: string): Promise<void> {
    // 更新数据库
    await this.storage.endSession(sessionId, summary);

    // 从缓存移除
    for (const [key, session] of this.activeSessions.entries()) {
      if (session.id === sessionId) {
        this.activeSessions.delete(key);
        break;
      }
    }
  }

  /**
   * 清除内存缓存
   */
  clearCache(): void {
    this.activeSessions.clear();
  }
}
