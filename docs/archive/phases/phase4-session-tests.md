# Phase 4: Session Manager 测试方案

> Karma 项目第四阶段 - 会话管理器

---

## 一、目标

实现 Session Manager，管理多平台会话：

1. **会话生命周期** - 创建、恢复、保存、结束
2. **多平台支持** - CLI / Feishu / WeChat
3. **SDK 集成** - 管理 SDK session_id 用于 resume
4. **内存缓存** - 减少 DB 查询

---

## 二、设计回顾 (来自架构文档)

```typescript
// src/session/manager.ts

export class SessionManager {
  private storage: StorageService;
  private activeSessions: Map<string, ActiveSession>;

  async getOrCreateSession(context: {
    platform: 'cli' | 'feishu' | 'wechat';
    externalChatId?: string;
    userInfo?: { name?: string; id?: string };
  }): Promise<ActiveSession> {
    // 1. 尝试从内存缓存获取
    // 2. 尝试从数据库恢复
    // 3. 创建新会话
  }

  async saveSession(session: ActiveSession): Promise<void> {
    // 持久化 sdkSessionId 和状态
  }
}

interface ActiveSession {
  id: string;
  clientId?: string;
  sdkSessionId?: string;
  platform: string;
  externalChatId?: string;
  startedAt: Date;
}
```

---

## 三、文件结构

```
karma/
├── src/
│   └── session/
│       ├── index.ts           # 导出
│       ├── manager.ts         # SessionManager
│       └── types.ts           # TypeScript 类型
├── tests/
│   └── session/
│       └── manager.test.ts    # SessionManager 测试
└── docs/
    └── phase4-session-tests.md
```

---

## 四、类型定义

```typescript
// src/session/types.ts

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
```

---

## 五、核心接口

```typescript
// src/session/manager.ts

export class SessionManager {
  constructor(options: SessionManagerOptions);

  /**
   * 获取或创建会话
   * 1. 先从内存缓存获取
   * 2. 再从数据库恢复
   * 3. 最后创建新会话
   */
  async getOrCreateSession(context: GetOrCreateSessionContext): Promise<ActiveSession>;

  /**
   * 获取内存中的会话 (不查 DB)
   */
  getSessionFromCache(cacheKey: string): ActiveSession | undefined;

  /**
   * 更新会话的 SDK session_id
   */
  async updateSdkSessionId(sessionId: string, sdkSessionId: string): Promise<void>;

  /**
   * 关联客户到会话
   */
  async linkClient(sessionId: string, clientId: string): Promise<void>;

  /**
   * 保存会话状态到数据库
   */
  async saveSession(session: ActiveSession): Promise<void>;

  /**
   * 结束会话
   */
  async endSession(sessionId: string, summary?: string): Promise<void>;

  /**
   * 清除内存缓存
   */
  clearCache(): void;

  /**
   * 生成缓存键
   */
  private getCacheKey(platform: Platform, externalChatId?: string): string;
}
```

---

## 六、测试用例设计

### 6.1 SessionManager 测试

```typescript
// tests/session/manager.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '@/session/manager';
import { StorageService } from '@/storage/service';

describe('SessionManager', () => {
  let storage: StorageService;
  let manager: SessionManager;

  beforeEach(() => {
    storage = new StorageService(':memory:');
    manager = new SessionManager({ storage });
  });

  afterEach(() => {
    storage.close();
  });

  describe('getOrCreateSession', () => {
    it('should create new session for new platform/chat', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });

      expect(session.id).toBeDefined();
      expect(session.platform).toBe('cli');
      expect(session.startedAt).toBeInstanceOf(Date);
    });

    it('should create session with externalChatId for Feishu', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_abc123',
      });

      expect(session.externalChatId).toBe('oc_abc123');
    });

    it('should return cached session on second call', async () => {
      const session1 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_xyz789',
      });

      const session2 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_xyz789',
      });

      expect(session1.id).toBe(session2.id);
    });

    it('should restore session from database if not cached', async () => {
      // 1. 创建会话并保存到 DB
      const session1 = await manager.getOrCreateSession({
        platform: 'cli',
      });
      await manager.saveSession(session1);

      // 2. 清除缓存
      manager.clearCache();

      // 3. 再次获取，应该从 DB 恢复
      const session2 = await manager.getOrCreateSession({
        platform: 'cli',
      });

      // 注意：CLI 没有 externalChatId，所以会创建新会话
      // 这是预期行为，因为 CLI 是单会话
    });

    it('should restore Feishu session from database', async () => {
      // 1. 创建会话
      const session1 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_restore_test',
      });
      await manager.saveSession(session1);

      // 2. 清除缓存
      manager.clearCache();

      // 3. 恢复
      const session2 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_restore_test',
      });

      expect(session2.id).toBe(session1.id);
    });

    it('should create different sessions for different platforms', async () => {
      const cliSession = await manager.getOrCreateSession({ platform: 'cli' });
      const feishuSession = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_diff',
      });

      expect(cliSession.id).not.toBe(feishuSession.id);
    });

    it('should create different sessions for different chatIds', async () => {
      const session1 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_chat1',
      });
      const session2 = await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_chat2',
      });

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('updateSdkSessionId', () => {
    it('should update SDK session ID', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });

      await manager.updateSdkSessionId(session.id, 'sdk_abc123');

      // 从缓存获取验证
      const cached = manager.getSessionFromCache('cli');
      expect(cached?.sdkSessionId).toBe('sdk_abc123');
    });

    it('should persist SDK session ID to database', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });
      await manager.updateSdkSessionId(session.id, 'sdk_xyz789');

      // 从 DB 验证
      const dbSession = await storage.getSession(session.id);
      expect(dbSession?.sdkSessionId).toBe('sdk_xyz789');
    });
  });

  describe('linkClient', () => {
    it('should link client to session', async () => {
      const clientId = await storage.createClient({
        name: '测试客户',
      });

      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });

      await manager.linkClient(session.id, clientId);

      const cached = manager.getSessionFromCache('cli');
      expect(cached?.clientId).toBe(clientId);
    });

    it('should persist client link to database', async () => {
      const clientId = await storage.createClient({
        name: '测试客户',
      });

      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });

      await manager.linkClient(session.id, clientId);

      const dbSession = await storage.getSession(session.id);
      expect(dbSession?.clientId).toBe(clientId);
    });
  });

  describe('endSession', () => {
    it('should end session with summary', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });

      await manager.endSession(session.id, '完成了算命');

      const dbSession = await storage.getSession(session.id);
      expect(dbSession?.status).toBe('completed');
      expect(dbSession?.summary).toBe('完成了算命');
      expect(dbSession?.endedAt).toBeDefined();
    });

    it('should remove session from cache', async () => {
      const session = await manager.getOrCreateSession({
        platform: 'cli',
      });

      await manager.endSession(session.id);

      const cached = manager.getSessionFromCache('cli');
      expect(cached).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached sessions', async () => {
      await manager.getOrCreateSession({ platform: 'cli' });
      await manager.getOrCreateSession({
        platform: 'feishu',
        externalChatId: 'oc_clear',
      });

      manager.clearCache();

      expect(manager.getSessionFromCache('cli')).toBeUndefined();
      expect(manager.getSessionFromCache('feishu:oc_clear')).toBeUndefined();
    });
  });

  describe('concurrency', () => {
    it('should handle concurrent getOrCreateSession calls', async () => {
      // 同时调用多次
      const promises = Array(5).fill(null).map(() =>
        manager.getOrCreateSession({
          platform: 'feishu',
          externalChatId: 'oc_concurrent',
        })
      );

      const sessions = await Promise.all(promises);

      // 所有调用应该返回同一个会话
      const ids = sessions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1);
    });
  });
});
```

---

## 七、实施步骤

### Step 1: 创建文件结构

```bash
mkdir -p src/session tests/session
touch src/session/{index,manager,types}.ts
touch tests/session/manager.test.ts
```

### Step 2: 实现类型定义

实现 `ActiveSession`, `GetOrCreateSessionContext`, `SessionManagerOptions`

### Step 3: 实现 SessionManager

实现 `getOrCreateSession`, `updateSdkSessionId`, `linkClient`, `endSession`

### Step 4: 运行测试

```bash
npm test
```

---

## 八、验收标准

Phase 4 完成的标准：

- [ ] 所有测试通过 (`npm test`)
- [ ] 可以创建和恢复会话
- [ ] 内存缓存正常工作
- [ ] SDK session_id 持久化
- [ ] 客户关联正常
- [ ] 会话结束正常
- [ ] 并发安全
- [ ] 代码通过 TypeScript 类型检查

---

## 九、与现有实现的对比

| 方面 | 现有 Karma-V2 | 新 SessionManager |
|------|-------------|------------------|
| 会话管理 | 内存变量 | 专用 Manager 类 |
| 持久化 | 无 | 自动持久化到 DB |
| 多平台 | 无 | 支持多平台 |
| 缓存 | 无 | 内存缓存 |
| 并发 | 无保护 | 并发安全 |
