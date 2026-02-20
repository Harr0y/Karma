# Karma 平台适配层重构计划

**日期:** 2026-02-20
**目标:** 将 Karma 重构为平台无关的 Agent 核心层，支持 HTTP/Discord/Telegram/飞书等多平台接入

---

## 一、现状分析

### 1.1 当前架构问题

```
┌─────────────────────────────────────────────────────────────┐
│                      当前架构                                │
├─────────────────────────────────────────────────────────────┤
│  HTTP Server (api/server.ts)  ← 独立实现，绕过适配层         │
│         ↓                                                    │
│  AgentRunner.run()                                          │
│         ↓                                                    │
│  SessionManager + Storage                                   │
├─────────────────────────────────────────────────────────────┤
│  FeishuAdapter  ← 唯一实现 PlatformAdapter 接口的适配器      │
│         ↓                                                    │
│  MessageRouter → AgentRunner                                │
└─────────────────────────────────────────────────────────────┘
```

**核心问题:**

| 问题 | 位置 | 影响 |
|------|------|------|
| HTTP Server 绕过 PlatformAdapter | `api/server.ts` | 代码重复，逻辑分散 |
| Platform 类型定义不一致 | 多处 | `cli/feishu/discord/telegram` vs `cli/feishu/wechat` |
| clientId 不持久化 | `agent/runner.ts:337` | 客户信息丢失（P1 问题） |
| 无 HTTP 适配器 | - | 无法统一管理 |

### 1.2 目标架构

```
┌──────────────────────────────────────────────────────────────┐
│                      入口层 (Entry Points)                    │
│  CLI main()  │  HTTP Server  │  Discord Bot  │  Telegram Bot │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                 平台适配层 (Platform Adapters)                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  PlatformManager (统一消息入口)                          │ │
│  │  - 接收所有平台的 IncomingMessage                        │ │
│  │  - 管理会话生命周期                                      │ │
│  │  - 调用 AgentRunner                                     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  adapters/                                                   │
│  ├── HttpAdapter     (stateless, SSE)                        │
│  ├── FeishuAdapter   (WebSocket)                             │
│  ├── DiscordAdapter  (WebSocket)    ← 新增                   │
│  └── TelegramAdapter (Long Polling) ← 新增                   │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    Agent 核心层 (Karma Core)                  │
│  AgentRunner                                                 │
│  - 平台无关的命理师对话处理                                   │
│  - 接收统一消息，返回统一响应                                 │
└──────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    支撑层 (Infrastructure)                    │
│  SessionManager  │  StorageService  │  PersonaService        │
│  (支持 stateless/persistent 两种模式)                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 二、修改清单

### Phase 1: 类型统一与基础设施 (1-2h)

#### 1.1 统一 Platform 类型定义

**文件:** `src/types/platform.ts` (新建)

```typescript
/**
 * 统一的平台类型定义
 */
export type Platform = 'cli' | 'http' | 'feishu' | 'discord' | 'telegram';

/**
 * 平台连接模式
 */
export type ConnectionMode = 'stateless' | 'persistent';

/**
 * 平台特性配置
 */
export interface PlatformConfig {
  type: Platform;
  connectionMode: ConnectionMode;
  features: {
    streaming: boolean;      // 是否支持流式输出
    richContent: boolean;    // 是否支持富文本/卡片
    media: boolean;          // 是否支持媒体消息
    longMessage: boolean;    // 是否支持长消息
  };
}

/**
 * 平台配置表
 */
export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  cli: {
    type: 'cli',
    connectionMode: 'persistent',
    features: { streaming: true, richContent: true, media: false, longMessage: true }
  },
  http: {
    type: 'http',
    connectionMode: 'stateless',
    features: { streaming: true, richContent: false, media: false, longMessage: true }
  },
  feishu: {
    type: 'feishu',
    connectionMode: 'persistent',
    features: { streaming: false, richContent: true, media: true, longMessage: false }
  },
  discord: {
    type: 'discord',
    connectionMode: 'persistent',
    features: { streaming: false, richContent: true, media: true, longMessage: false }
  },
  telegram: {
    type: 'telegram',
    connectionMode: 'persistent',
    features: { streaming: false, richContent: false, media: true, longMessage: false }
  }
};
```

#### 1.2 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/platform/types.ts` | 从 `src/types/platform.ts` 导入 Platform 类型 |
| `src/session/types.ts` | 从 `src/types/platform.ts` 导入 Platform 类型 |
| `src/prompt/types.ts` | 从 `src/types/platform.ts` 导入 Platform 类型 |
| `src/agent/types.ts` | 从 `src/types/platform.ts` 导入 Platform 类型 |

---

### Phase 2: Storage 层增强 (30min)

#### 2.1 添加 `updateSessionClient` 方法

**文件:** `src/storage/service.ts`

```typescript
/**
 * 更新会话关联的客户 ID
 * 修复 P1 问题：clientId 不持久化
 */
async updateSessionClient(sessionId: string, clientId: string): Promise<void> {
  await this.drizzleDb
    .update(sessions)
    .set({ clientId })
    .where(eq(sessions.id, sessionId));
}
```

#### 2.2 修复 `updateClient` 空值覆盖问题

**文件:** `src/storage/service.ts`

```typescript
/**
 * 更新客户信息（只更新非空字段）
 */
async updateClient(id: string, data: Partial<Omit<Client, 'id' | 'firstSeenAt'>>): Promise<void> {
  // 过滤掉 undefined 字段，避免覆盖已有值
  const updateData: Record<string, any> = {
    lastSeenAt: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateData[key] = value;
    }
  }

  await this.drizzleDb
    .update(clients)
    .set(updateData)
    .where(eq(clients.id, id));
}
```

---

### Phase 3: HTTP 适配器实现 (2h)

#### 3.1 创建 HTTP 适配器

**文件:** `src/platform/adapters/http/adapter.ts` (新建)

```typescript
/**
 * HTTP 无状态适配器
 *
 * 特点：
 * - 不维护长连接
 * - 通过 sessionId 恢复会话
 * - 支持 SSE 流式响应
 */
import type {
  PlatformAdapter,
  IncomingMessage,
  MessageHandler,
  SendMessageOptions
} from '../../types.js';
import type { Platform } from '../../../types/platform.js';

export class HttpAdapter implements PlatformAdapter {
  readonly platform: Platform = 'http';

  private messageHandlers: MessageHandler[] = [];
  private responseCallbacks: Map<string, (response: string) => void> = new Map();

  // HTTP 适配器不需要启动
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  isRunning(): boolean { return true; }

  /**
   * 处理 HTTP 请求
   * 由 KarmaServer 调用
   */
  async handleRequest(
    sessionId: string,
    userId: string,
    message: string
  ): Promise<IncomingMessage> {
    const incomingMessage: IncomingMessage = {
      id: `http_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      platform: 'http',
      chatId: sessionId,
      userId,
      senderType: 'user',
      text: message,
      timestamp: Date.now(),
    };

    // 触发注册的消息处理器
    for (const handler of this.messageHandlers) {
      await handler(incomingMessage);
    }

    return incomingMessage;
  }

  /**
   * 发送消息
   * HTTP 适配器通过 SSE 流式返回，不直接调用
   */
  async sendMessage(
    chatId: string,
    content: string,
    options?: SendMessageOptions
  ): Promise<string> {
    // 触发响应回调（如果有）
    const callback = this.responseCallbacks.get(chatId);
    if (callback) {
      callback(content);
    }
    return content;
  }

  /**
   * 注册消息处理器
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * 注册响应回调（用于 SSE）
   */
  onResponse(sessionId: string, callback: (response: string) => void): void {
    this.responseCallbacks.set(sessionId, callback);
  }

  /**
   * 清除响应回调
   */
  clearResponseCallback(sessionId: string): void {
    this.responseCallbacks.delete(sessionId);
  }
}
```

**文件:** `src/platform/adapters/http/index.ts` (新建)

```typescript
export { HttpAdapter } from './adapter.js';
```

---

### Phase 4: SessionManager 增强 (1h)

#### 4.1 区分 stateless/persistent 会话策略

**文件:** `src/session/manager.ts`

```typescript
import { PLATFORM_CONFIGS, type Platform, type ConnectionMode } from '../types/platform.js';

export class SessionManager {
  // ... 现有代码 ...

  /**
   * 根据平台特性选择会话恢复策略
   */
  async getOrCreateSession(context: GetOrCreateSessionContext): Promise<ActiveSession> {
    const { platform, externalChatId, sessionId } = context;
    const platformConfig = PLATFORM_CONFIGS[platform];

    if (platformConfig.connectionMode === 'persistent' && externalChatId) {
      // 长连接平台：优先内存缓存
      return this.getPersistentSession(context);
    } else if (platformConfig.connectionMode === 'stateless' && sessionId) {
      // 无状态平台：通过 sessionId 从 DB 恢复
      return this.getStatelessSession(sessionId);
    } else {
      // 默认：创建新会话
      return this.createNewSession(context);
    }
  }

  /**
   * 长连接平台会话处理
   */
  private async getPersistentSession(context: GetOrCreateSessionContext): Promise<ActiveSession> {
    const { platform, externalChatId } = context;
    const cacheKey = this.getCacheKey(platform, externalChatId);

    // 1. 检查内存缓存
    const cached = this.activeSessions.get(cacheKey);
    if (cached) return cached;

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
   */
  private async getStatelessSession(sessionId: string): Promise<ActiveSession> {
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
    const cacheKey = this.getCacheKey(session.platform, session.externalChatId || session.id);
    this.activeSessions.set(cacheKey, session);

    return session;
  }

  /**
   * 更新会话关联的客户 ID（新增）
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
```

#### 4.2 更新 GetOrCreateSessionContext 类型

**文件:** `src/session/types.ts`

```typescript
export interface GetOrCreateSessionContext {
  platform: Platform;
  externalChatId?: string;
  clientId?: string;
  sessionId?: string;  // 新增：无状态平台使用
}
```

---

### Phase 5: AgentRunner 修复 (30min)

#### 5.1 修复 clientId 持久化

**文件:** `src/agent/runner.ts`

```typescript
// 在 handleClientInfo 方法中，第 333-337 行
// 修改前：
session.clientId = clientId;
await storage.updateSdkSessionId(session.id, session.sdkSessionId || '');

// 修改后：
session.clientId = clientId;
await sessionManager.updateSessionClient(session.id, clientId);  // 新增这行
```

#### 5.2 修复客户信息更新覆盖问题

**文件:** `src/agent/runner.ts`

```typescript
// 在 handleClientInfo 方法中，第 339-346 行
// 修改前：
await storage.updateClient(session.clientId, {
  name: info!.name,
  gender: info!.gender,
  birthDate: info!.birthDate,
  birthPlace: info!.birthPlace,
  currentCity: info!.currentCity,
});

// 修改后：只更新非 undefined 字段
const updateData: Partial<Client> = {};
if (info!.name) updateData.name = info!.name;
if (info!.gender) updateData.gender = info!.gender;
if (info!.birthDate) updateData.birthDate = info!.birthDate;
if (info!.birthPlace) updateData.birthPlace = info!.birthPlace;
if (info!.currentCity) updateData.currentCity = info!.currentCity;

if (Object.keys(updateData).length > 0) {
  await storage.updateClient(session.clientId, updateData);
}
```

---

### Phase 6: API Server 重构 (2h)

#### 6.1 重构 KarmaServer 使用适配器

**文件:** `src/api/server.ts`

```typescript
import { HttpAdapter } from '../platform/adapters/http/index.js';
import { MessageRouter } from '../platform/router.js';

export class KarmaServer {
  private httpAdapter: HttpAdapter;
  private messageRouter: MessageRouter;
  // ... 其他现有属性 ...

  constructor(serverConfig?: ServerConfig) {
    // ... 现有初始化代码 ...

    // 初始化 HTTP 适配器和消息路由器
    this.httpAdapter = new HttpAdapter();
    this.messageRouter = new MessageRouter();

    // 注册消息处理器
    this.httpAdapter.onMessage((msg) => this.handleIncomingMessage(msg));
  }

  /**
   * 处理来自 HTTP 适配器的消息
   */
  private async handleIncomingMessage(message: IncomingMessage): Promise<void> {
    const session = await this.sessionManager.getOrCreateSession({
      platform: 'http',
      externalChatId: message.chatId,
      sessionId: message.chatId,  // HTTP 用 chatId 作为 sessionId
    });

    // 调用 AgentRunner
    for await (const response of this.runner.run({
      userInput: message.text || '',
      session,
    })) {
      // 通过适配器发送响应
      await this.httpAdapter.sendMessage(message.chatId, response.content);
    }
  }

  /**
   * POST /api/chat - 重构使用适配器
   */
  private async handleChat(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    if (!body) {
      this.sendError(res, 400, 'BAD_REQUEST', 'Request body required');
      return;
    }

    const request: ChatRequest = JSON.parse(body);
    if (!request.sessionId || !request.message) {
      this.sendError(res, 400, 'BAD_REQUEST', 'sessionId and message are required');
      return;
    }

    // 通过适配器处理请求
    const incomingMessage = await this.httpAdapter.handleRequest(
      request.sessionId,
      request.userId || request.sessionId,
      request.message
    );

    // 获取会话（使用无状态策略）
    let session: ActiveSession;
    try {
      session = await this.sessionManager.getOrCreateSession({
        platform: 'http',
        sessionId: request.sessionId,
        externalChatId: request.sessionId,
      });
    } catch (err) {
      this.sendError(res, 404, 'NOT_FOUND', 'Session not found');
      return;
    }

    // 设置 SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const sendSSE = (msg: SSEMessage) => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    };

    try {
      // 处理空消息触发问候
      if (!session.sdkSessionId && !request.message.trim()) {
        for await (const text of this.runner.runText({
          userInput: GREETING_PROMPT,
          session,
        })) {
          sendSSE({ type: 'text', content: text });
        }
        sendSSE({ type: 'done' });
        res.end();
        return;
      }

      // 正常对话
      let hasContent = false;
      for await (const msg of this.runner.run({ userInput: request.message, session })) {
        if (msg.type === 'text') {
          hasContent = true;
          sendSSE({ type: 'text', content: msg.content });
        }
        // 移除 tool_use 的发送（不暴露给用户）
      }

      // 空响应处理
      if (!hasContent) {
        sendSSE({ type: 'text', content: '嗯，请继续说...' });
        this.logger.warn('空响应', {
          operation: 'empty_response',
          sessionId: session.id,
        });
      }

      sendSSE({ type: 'done' });
      res.end();
    } catch (err: any) {
      this.logger.error('Chat 错误', err, { operation: 'chat_error', sessionId: session.id });
      sendSSE({ type: 'error', error: err.message });
      res.end();
    }
  }
}
```

---

### Phase 7: 移除 tool_use 暴露 (15min)

#### 7.1 修改 API Server

**文件:** `src/api/server.ts` (已在 Phase 6 中处理)

移除以下代码：
```typescript
// 删除这段
else if (msg.type === 'tool_use') {
  sendSSE({ type: 'tool_use', toolName: msg.content });
}
```

或者仅在开发模式发送：
```typescript
if (process.env.NODE_ENV === 'development' && msg.type === 'tool_use') {
  sendSSE({ type: 'tool_use', toolName: msg.content });
}
```

---

## 三、文件修改汇总

### 新建文件

| 文件路径 | 说明 |
|----------|------|
| `src/types/platform.ts` | 统一平台类型定义 |
| `src/platform/adapters/http/adapter.ts` | HTTP 适配器实现 |
| `src/platform/adapters/http/index.ts` | HTTP 适配器导出 |

### 修改文件

| 文件路径 | 修改内容 | 优先级 |
|----------|----------|--------|
| `src/storage/service.ts` | 添加 `updateSessionClient`，修复 `updateClient` | P0 |
| `src/session/manager.ts` | 添加 `updateSessionClient`，区分会话策略 | P0 |
| `src/session/types.ts` | 添加 `sessionId` 到 context，统一 Platform | P1 |
| `src/agent/runner.ts` | 修复 clientId 持久化，修复信息覆盖 | P0 |
| `src/api/server.ts` | 使用 HTTP 适配器，移除 tool_use 暴露 | P1 |
| `src/platform/types.ts` | 统一 Platform 类型 | P1 |
| `src/prompt/types.ts` | 统一 Platform 类型 | P2 |

---

## 四、测试计划

### 4.1 单元测试

- [ ] `StorageService.updateSessionClient` 正确更新数据库
- [ ] `StorageService.updateClient` 不覆盖 undefined 字段
- [ ] `SessionManager.getStatelessSession` 正确从 DB 恢复
- [ ] `HttpAdapter.handleRequest` 生成正确的 IncomingMessage

### 4.2 集成测试

- [ ] HTTP API 创建会话 → 发送消息 → 获取响应
- [ ] HTTP API 会话恢复（clientId 持久化）
- [ ] 空消息触发问候
- [ ] 空响应兜底

### 4.3 回归测试

- [ ] 飞书适配器正常工作
- [ ] CLI 模式正常工作

---

## 五、实施顺序

```
Week 1 (Day 1-2)
├── Phase 1: 类型统一 (1-2h)
├── Phase 2: Storage 层增强 (30min)
└── Phase 5: AgentRunner 修复 (30min)

Week 1 (Day 3-4)
├── Phase 4: SessionManager 增强 (1h)
├── Phase 3: HTTP 适配器 (2h)
└── Phase 6: API Server 重构 (2h)

Week 1 (Day 5)
├── Phase 7: 移除 tool_use (15min)
└── 测试与验证 (2h)
```

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 重构影响飞书适配器 | 中 | 高 | 保持 FeishuAdapter 不变，仅修改接口导入 |
| SessionManager 改动影响 CLI | 低 | 中 | CLI 使用 persistent 模式，逻辑不变 |
| HTTP 适配器与 SSE 不兼容 | 低 | 中 | 保留现有 SSE 逻辑，适配器仅处理消息 |

---

## 七、后续扩展

完成本次重构后，可以轻松添加：

1. **Discord 适配器**
   - 基于 `discord.js`
   - 实现 `PlatformAdapter` 接口
   - 注册到 `PlatformManager`

2. **Telegram 适配器**
   - 基于 `node-telegram-bot-api`
   - 实现 `PlatformAdapter` 接口
   - 处理 Long Polling

3. **认证增强**
   - 在 `GetOrCreateSessionContext` 中添加 `authToken`
   - 在 `SessionManager` 中验证用户归属

---

*文档版本: 1.0*
*最后更新: 2026-02-20*
