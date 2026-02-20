# Karma 问题排查报告

**日期:** 2026-02-19
**测试人设:** curious-young
**测试轮次:** 15 轮

---

## 问题总览

| 问题 | 严重程度 | 根本原因 | 修复难度 |
|------|----------|----------|----------|
| 信息记忆问题 | P1 | 客户档案未在每次请求时加载 | 中 |
| 空回复问题 | P1 | SDK 返回空响应或超时 | 高 |
| 性别判断错误 | P2 | 信息提取/覆盖逻辑问题 | 低 |
| 八字排盘不一致 | P2 | 多次排盘结果不同 | 中 |
| tool_use 暴露 | P2 | SSE 未过滤内部消息 | 低 |

---

## 问题 1: 信息记忆问题 (P1)

### 现象
用户多次提供生辰信息（1998年5月15日下午两点半，长沙，男，小明），但 Karma 在后续对话中反复询问相同信息，导致用户抱怨"说了好几遍了"。

### 根本原因分析

通过代码分析，发现以下问题：

#### 1.1 客户档案未在每次请求时加载

**位置:** `src/agent/runner.ts` 第 79-83 行

```typescript
// 获取客户档案（如果有）
const clientId = session.clientId;
const clientProfile = clientId
  ? await storage.generateClientProfilePrompt(clientId)
  : undefined;
```

**问题:** 只有当 `session.clientId` 存在时才会加载客户档案。但在新会话中，`clientId` 可能尚未设置。

#### 1.2 clientId 更新后未持久化到会话

**位置:** `src/agent/runner.ts` 第 333-337 行

```typescript
// 更新会话关联
session.clientId = clientId;
// 注意：这里需要在 session 表中也更新 clientId
// 暂时通过 storage 直接更新
await storage.updateSdkSessionId(session.id, session.sdkSessionId || '');
```

**问题:** 注释中明确说明了问题：**clientId 只更新了内存中的 session 对象，没有持久化到数据库！**

虽然调用了 `updateSdkSessionId`，但这个方法只更新 `sdkSessionId` 字段，不更新 `clientId`。

#### 1.3 缺少 updateSessionClient 方法

**位置:** `src/session/manager.ts` 第 139-143 行

```typescript
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
```

**问题:** `StorageService` 没有 `updateSessionClient` 方法，导致 `clientId` 无法持久化。

### 修复建议

1. **添加 `updateSessionClient` 方法到 `StorageService`:**

```typescript
// src/storage/service.ts
async updateSessionClient(sessionId: string, clientId: string): Promise<void> {
  await this.drizzleDb
    .update(sessions)
    .set({ clientId })
    .where(eq(sessions.id, sessionId));
}
```

2. **在 `AgentRunner.handleClientInfo` 中调用此方法:**

```typescript
// 更新会话关联
session.clientId = clientId;
await storage.updateSessionClient(session.id, clientId);  // 添加这行
```

3. **在 `SessionManager.linkClient` 中也调用此方法:**

```typescript
async linkClient(sessionId: string, clientId: string): Promise<void> {
  await this.storage.updateSessionClient(sessionId, clientId);
  // 更新缓存...
}
```

---

## 问题 2: 空回复问题 (P1)

### 现象
Round 3、6、10、11 出现 Karma 返回空响应（只有 `{"type":"done"}`），导致对话不流畅。

### 根本原因分析

#### 2.1 SDK 流式响应可能返回空内容

**位置:** `src/agent/runner.ts` 第 163-179 行

```typescript
if (msg.type === 'assistant' && 'message' in msg) {
  const content = msg.message?.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'text') {
        rawContent += block.text;
        const filtered = filter.process(block.text);
        if (filtered) {
          assistantContent += filtered;
          yield { type: 'text', content: filtered, raw: msg };
        }
      } else if (block.type === 'tool_use') {
        yield { type: 'tool_use', content: block.name || 'tool', raw: msg };
      }
    }
  }
}
```

**可能原因:**
1. SDK 返回的 `content` 为空数组或 undefined
2. `MonologueFilter` 过滤掉了所有内容（如只有 inner_monologue）
3. SDK 响应超时或网络问题

#### 2.2 API Server 没有处理空响应的情况

**位置:** `src/api/server.ts` 第 286-294 行

```typescript
// 正常对话
for await (const msg of this.runner.run({ userInput: request.message, session })) {
  if (msg.type === 'text') {
    sendSSE({ type: 'text', content: msg.content });
  } else if (msg.type === 'tool_use') {
    sendSSE({ type: 'tool_use', toolName: msg.content });
  }
}

sendSSE({ type: 'done' });
```

**问题:** 如果整个循环中没有产生任何 `text` 类型的消息，只会发送 `done`，用户收到空响应。

### 修复建议

1. **添加空响应检测和重试逻辑:**

```typescript
let hasContent = false;
for await (const msg of this.runner.run({ userInput: request.message, session })) {
  if (msg.type === 'text') {
    hasContent = true;
    sendSSE({ type: 'text', content: msg.content });
  } else if (msg.type === 'tool_use') {
    sendSSE({ type: 'tool_use', toolName: msg.content });
  }
}

if (!hasContent) {
  // 发送一个默认响应，避免用户收到空消息
  sendSSE({ type: 'text', content: '嗯，你说呢？' });
}

sendSSE({ type: 'done' });
```

2. **检查 MonologueFilter 的过滤逻辑:**

确保不会过滤掉正常内容。

3. **添加日志记录空响应情况:**

```typescript
if (!hasContent) {
  this.logger.warn('空响应', {
    operation: 'empty_response',
    sessionId: session.id,
    metadata: { userInput: request.message.substring(0, 50) }
  });
}
```

---

## 问题 3: 性别判断错误 (P2)

### 现象
Round 14 中 Karma 将用户性别错误标记为"女"，尽管用户多次确认是男性。

### 根本原因分析

#### 3.1 信息提取正则不完善

**位置:** `src/agent/info-extractor.ts` 第 49-53 行

```typescript
// 提取性别
const genderMatch = content.match(/性别[：:]\s*(男|女)/);
if (genderMatch) {
  info.gender = genderMatch[1] === '男' ? 'male' : 'female';
}
```

这个正则是正确的，问题可能在于：

1. **LLM 输出的 `<client_info>` 标签中性别字段被覆盖**

从测试日志可以看到，Round 14 的输出中：
```
<client_info>
姓名：[未知]
性别：女   <-- 错误！
生辰：1998年5月15日14:30
出生地：长沙
</client_info>
```

这说明 LLM 在生成 `<client_info>` 时自己判断错误，而不是提取逻辑问题。

#### 3.2 客户信息更新覆盖

**位置:** `src/agent/runner.ts` 第 339-346 行

```typescript
} else {
  // 已有客户，更新信息
  await storage.updateClient(session.clientId, {
    name: info!.name,
    gender: info!.gender,  // 如果 info.gender 是 undefined，会覆盖已有值吗？
    birthDate: info!.birthDate,
    birthPlace: info!.birthPlace,
    currentCity: info!.currentCity,
  });
}
```

**问题:** 如果 `info!.gender` 是 `undefined`，会覆盖已有的正确值。

### 修复建议

1. **只更新非 undefined 的字段:**

```typescript
const updateData: Partial<Client> = {};
if (info!.name) updateData.name = info!.name;
if (info!.gender) updateData.gender = info!.gender;
if (info!.birthDate) updateData.birthDate = info!.birthDate;
// ...

await storage.updateClient(session.clientId, updateData);
```

2. **在 prompt 中强调记住已确认的信息:**

在 system prompt 中添加：
```
## 信息记忆
- 一旦确认了客户信息（姓名、性别、生辰、出生地），必须记住
- 后续输出 <client_info> 时，使用已确认的信息，不要重新判断
```

---

## 问题 4: 八字排盘不一致 (P2)

### 现象
Round 9 显示八字为"辛金日主"，Round 12 显示为"壬水日主"。

### 根本原因分析

这可能是 LLM 的排盘工具被调用了多次，或者 LLM 自己产生了不一致的输出。

**可能原因:**
1. LLM 每次重新排盘，结果不一致
2. 排盘工具的参数或计算有问题
3. LLM 没有记住之前的排盘结果

### 修复建议

1. **将排盘结果保存到 `baziSummary` 字段:**

```typescript
// 在 extractAndSaveInfo 中，如果有八字信息，保存到 client.baziSummary
```

2. **在 prompt 中使用已保存的八字:**

`generateClientProfilePrompt` 已经会输出 `baziSummary`，但需要确保 LLM 使用它。

---

## 问题 5: tool_use 暴露 (P2)

### 现象
用户看到了 `tool_use` 类型的内部消息：

```
data: {"type":"tool_use","toolName":"Bash"}
data: {"type":"tool_use","toolName":"Glob"}
```

### 根本原因分析

**位置:** `src/api/server.ts` 第 289-291 行

```typescript
} else if (msg.type === 'tool_use') {
  sendSSE({ type: 'tool_use', toolName: msg.content });
}
```

**问题:** API 将 `tool_use` 消息直接发送给客户端，而这类消息是内部处理信息，不应暴露给用户。

### 修复建议

1. **不在 SSE 中发送 tool_use:**

```typescript
for await (const msg of this.runner.run({ userInput: request.message, session })) {
  if (msg.type === 'text') {
    sendSSE({ type: 'text', content: msg.content });
  }
  // 移除 tool_use 的发送，或者只在开发模式下发送
  // else if (msg.type === 'tool_use') {
  //   sendSSE({ type: 'tool_use', toolName: msg.content });
  // }
}
```

2. **或者只在开发模式发送:**

```typescript
if (process.env.NODE_ENV === 'development' && msg.type === 'tool_use') {
  sendSSE({ type: 'tool_use', toolName: msg.content });
}
```

---

## 优先级修复顺序

| 顺序 | 问题 | 影响 | 修复工作量 |
|------|------|------|------------|
| 1 | 信息记忆问题 | 严重影响用户体验 | 中 (2h) |
| 2 | 空回复问题 | 严重影响对话流畅性 | 中 (2h) |
| 3 | tool_use 暴露 | 暴露内部信息 | 低 (30min) |
| 4 | 性别判断错误 | 偶发，影响准确性 | 低 (1h) |
| 5 | 八字排盘不一致 | 偶发，影响专业性 | 中 (2h) |

---

## 总结

核心问题是 **客户信息未持久化** 导致的连锁反应：

1. `clientId` 只存在于内存，不持久化
2. 每次新请求时，`clientId` 可能为空
3. 导致客户档案不加载
4. LLM 看不到已收集的信息
5. 重复询问、信息混乱

**最关键的修复：** 实现 `updateSessionClient` 方法并在创建/更新客户时调用。

---

*报告生成时间: 2026-02-19 15:30*
