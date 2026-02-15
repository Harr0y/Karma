# Karma V3 下一步迭代计划

> 基于 MVP 完成，准备进入 Phase 5 (Feishu)

---

## 当前状态

| 模块 | 状态 | 测试 |
|------|------|------|
| Storage | ✅ 完成 | 31 |
| Skills | ✅ 完成 | 39 |
| Prompt | ✅ 完成 | 32 |
| Session | ✅ 完成 | 20 |
| Agent | ✅ 完成 | 33 |
| CLI | ✅ 完成 | - |
| **总计** | **178 测试通过** | |

---

## Phase 5: Feishu 平台适配

### 目标

将 Karma 接入飞书机器人，实现真实场景使用。

### 5.1 Feishu SDK 集成 (2h)

**任务**:
- [ ] 安装 @whisper-bot/feishu-sdk 或类似包
- [ ] 创建 `src/feishu/client.ts` - 飞书 API 封装
- [ ] 创建 `src/feishu/sender.ts` - 消息发送器
- [ ] 配置 appId, appSecret 环境变量

**产出**:
```typescript
// src/feishu/sender.ts
export class FeishuSender {
  send(chatId: string, content: string, format?: 'text' | 'markdown'): Promise<void>
  sendFile(chatId: string, filePath: string): Promise<void>
}
```

### 5.2 Feishu Adapter (2h)

**任务**:
- [ ] 创建 `src/adapters/feishu.ts` - 平台适配器
- [ ] 处理飞书事件 (message, file)
- [ ] 调用 AgentRunner
- [ ] 流式输出转飞书消息

**产出**:
```typescript
// src/adapters/feishu.ts
export class FeishuAdapter {
  handleMessage(event: FeishuEvent): Promise<void>
}
```

### 5.3 Output Adapter 重构 (2h)

**任务**:
- [ ] 创建 `src/output/adapter.ts` - 接口定义
- [ ] 创建 `src/output/cli.ts` - CLI 实现
- [ ] 创建 `src/output/feishu.ts` - 飞书实现
- [ ] Markdown → Feishu 卡片转换 (可选)

**产出**:
```typescript
// src/output/adapter.ts
export interface OutputAdapter {
  send(msg: OutputMessage): Promise<void>
  sendBatch(msgs: OutputMessage[]): Promise<void>
}
```

### 5.4 MCP 工具 (1h)

**任务**:
- [ ] 创建 `src/mcp/feishu-tools.ts`
- [ ] 实现 send_user_feedback
- [ ] 实现 send_file_to_feishu
- [ ] 集成到 AgentRunner

**产出**:
```typescript
// src/mcp/feishu-tools.ts
export function createFeishuMcpServer(chatId: string): McpServer
```

### 5.5 测试 (2h)

**任务**:
- [ ] FeishuSender 单元测试
- [ ] FeishuAdapter 单元测试
- [ ] OutputAdapter 测试
- [ ] 集成测试

**产出**: 20+ 新测试

---

## Phase 5 工作量

| 任务 | 工作量 |
|------|--------|
| Feishu SDK | 2h |
| Feishu Adapter | 2h |
| Output Adapter | 2h |
| MCP 工具 | 1h |
| 测试 | 2h |
| **总计** | **9h** |

---

## Phase 6: 配置系统完善 (可选)

### 6.1 日志系统 (1h)

**任务**:
- [ ] 创建 `src/logger/index.ts`
- [ ] 文件日志 + 控制台日志
- [ ] 日志级别控制
- [ ] 调试日志开关

### 6.2 配置热加载 (0.5h)

**任务**:
- [ ] 监听配置文件变化
- [ ] 重新加载配置

### 6.3 SOUL.md 支持 (1h)

**任务**:
- [ ] 创建 `src/persona/loader.ts`
- [ ] 解析 SOUL.md
- [ ] 集成到 Prompt Builder

**Phase 6 总计**: 2.5h

---

## 优先级排序

```
Phase 5.1 Feishu SDK    ████░░░░░░  2h
Phase 5.2 Adapter       ████░░░░░░  2h
Phase 5.3 Output        ████░░░░░░  2h
Phase 5.4 MCP           ██░░░░░░░░  1h
Phase 5.5 测试          ████░░░░░░  2h
─────────────────────────────────────
Phase 5 总计            9h

Phase 6.1 日志          ██░░░░░░░░  1h
Phase 6.2 热加载        █░░░░░░░░░  0.5h
Phase 6.3 SOUL.md       ██░░░░░░░░  1h
─────────────────────────────────────
Phase 6 总计            2.5h
```

---

## 建议执行顺序

```
Week 1:
  Day 1-2: Phase 5.1 + 5.2 (Feishu SDK + Adapter)
  Day 3: Phase 5.3 (Output Adapter)
  Day 4: Phase 5.4 (MCP 工具)
  Day 5: Phase 5.5 (测试)

Week 2 (可选):
  Day 1: Phase 6.1 (日志)
  Day 2: Phase 6.2 + 6.3 (热加载 + SOUL.md)
```

---

## 依赖

| 依赖 | 用途 |
|------|------|
| @whisper-bot/feishu-sdk | 飞书 API (或自建) |
| markdown-to-feishu | Markdown 转卡片 (可选) |

---

## 风险

| 风险 | 缓解 |
|------|------|
| 飞书 SDK 不稳定 | 自建 API 封装 |
| 卡片格式复杂 | 先用纯文本 |
| 流式输出延迟 | 批量发送 |

---

## 验收标准

- [ ] 飞书机器人能接收消息
- [ ] Agent 能正常响应
- [ ] 流式输出正常
- [ ] 会话能恢复
- [ ] 20+ 测试通过

---

**要开始 Phase 5 吗？**
