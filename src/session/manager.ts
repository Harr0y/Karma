// Session Manager - 管理多平台会话

import type { StorageService } from '@/storage/service.js';
import type { ActiveSession, GetOrCreateSessionContext, SessionIdentity } from './types.js';
import { getSessionKey, isStatelessPlatform, isPersistentPlatform, type Platform } from './types.js';

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
   *
   * 根据平台类型选择不同的会话恢复策略：
   * - 无状态平台（HTTP）：通过 sessionId 从数据库恢复
   * - 长连接平台（Feishu/Discord/Telegram）：优先内存缓存
   */
  async getOrCreateSession(context: GetOrCreateSessionContext): Promise<ActiveSession> {
    const { platform, externalChatId, sessionId } = context;

    // 根据平台类型选择策略
    if (isStatelessPlatform(platform) && sessionId) {
      // 无状态平台：通过 sessionId 恢复
      return this.getStatelessSession(context);
    } else if (isPersistentPlatform(platform)) {
      // 长连接平台：优先内存缓存
      return this.getPersistentSession(context);
    }

    // 默认：创建新会话
    return this.createNewSession(context);
  }

  /**
   * 长连接平台会话处理
   * 优先内存缓存，再查数据库
   */
  private async getPersistentSession(context: GetOrCreateSessionContext): Promise<ActiveSession> {
    const { platform, externalChatId } = context;
    const cacheKey = this.getCacheKey(platform, externalChatId);

    // 检查并发锁
    const pendingRequest = this.sessionLocks.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest;
    }

    const requestPromise = this._doGetPersistentSession(context, cacheKey);
    this.sessionLocks.set(cacheKey, requestPromise);

    try {
      return await requestPromise;
    } finally {
      this.sessionLocks.delete(cacheKey);
    }
  }

  private async _doGetPersistentSession(
    context: GetOrCreateSessionContext,
    cacheKey: string
  ): Promise<ActiveSession> {
    const { platform, externalChatId, clientId } = context;

    // 1. 尝试从内存缓存获取
    const cached = this.activeSessions.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. 尝试从数据库恢复
    if (externalChatId) {
      const dbSession = await this.storage.getSessionByExternalChatId(platform, externalChatId);
      if (dbSession && dbSession.status === 'active') {
        const session = this.dbToActiveSession(dbSession);
        this.activeSessions.set(cacheKey, session);
        return session;
      }
    }

    // 3. 创建新会话
    return this.createNewSession(context);
  }

  /**
   * 无状态平台会话处理
   * 通过 sessionId 从数据库恢复
   */
  private async getStatelessSession(context: GetOrCreateSessionContext): Promise<ActiveSession> {
    const { platform, sessionId } = context;

    if (!sessionId) {
      throw new Error('sessionId is required for stateless platforms');
    }

    // 1. 先检查内存缓存（可能在同一进程中）
    for (const session of this.activeSessions.values()) {
      if (session.id === sessionId) {
        return session;
      }
    }

    // 2. 从数据库恢复
    const dbSession = await this.storage.getSession(sessionId);
    if (!dbSession) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = this.dbToActiveSession(dbSession);

    // 缓存（用于后续请求）
    const cacheKey = this.getCacheKey(platform, session.externalChatId || session.id);
    this.activeSessions.set(cacheKey, session);

    return session;
  }

  /**
   * 创建新会话
   */
  private async createNewSession(context: GetOrCreateSessionContext): Promise<ActiveSession> {
    const { platform, externalChatId, clientId } = context;

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

    // 缓存（使用 platform 作为默认 chatId）
    const cacheKey = this.getCacheKey(platform, externalChatId);
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
   * 更新会话关联的客户 ID
   * 修复 P1 问题：clientId 持久化
   */
  async updateSessionClient(sessionId: string, clientId: string): Promise<void> {
    // 更新数据库
    await this.storage.updateSessionClient(sessionId, clientId);

    // 更新缓存
    for (const session of this.activeSessions.values()) {
      if (session.id === sessionId) {
        session.clientId = clientId;
        break;
      }
    }
  }

  /**
   * 关联客户到会话（别名方法）
   * @deprecated 请使用 updateSessionClient
   */
  async linkClient(sessionId: string, clientId: string): Promise<void> {
    return this.updateSessionClient(sessionId, clientId);
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

  /**
   * 数据库记录转 ActiveSession
   */
  private dbToActiveSession(dbSession: any): ActiveSession {
    return {
      id: dbSession.id,
      clientId: dbSession.clientId ?? undefined,
      sdkSessionId: dbSession.sdkSessionId ?? undefined,
      platform: dbSession.platform as Platform,
      externalChatId: dbSession.externalChatId ?? undefined,
      startedAt: new Date(dbSession.startedAt),
    };
  }
}
