# Phase 8: 自动化测试模拟器设计

> Karma + disclaude 协作的自动化测试方案

---

## 1. 背景与目标

### 1.1 问题

- Karma 是一个命理师 AI，需要验证其对话质量
- 手动测试效率低，难以覆盖多种用户场景
- 需要客观的第三方评估

### 1.2 目标

1. **自动化对话测试** - 用 AI 模拟真实用户与 Karma 对话
2. **多场景覆盖** - 支持不同性格、背景、需求的用户人设
3. **客观评估** - 第三方视角评估对话质量
4. **为扩展打基础** - 暴露 API，为未来 Telegram/App 接入做准备

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      disclaude                          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  skills/karma-simulator/SKILL.md                │   │
│  │  - 用户模拟器行为准则                            │   │
│  │  - 对话流程控制                                  │   │
│  │  - 评估标准定义                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  skills/personas/                               │   │
│  │  ├── curious-young/SKILL.md    # 好奇青年       │   │
│  │  ├── anxious-mom/SKILL.md      # 焦虑妈妈       │   │
│  │  └── skeptical-pro/SKILL.md    # 怀疑论者       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  CLI: disclaude simulate-karma --persona xxx           │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP API
                          ▼
┌─────────────────────────────────────────────────────────┐
│                       Karma                             │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  src/api/server.ts                              │   │
│  │  - POST /api/session   创建会话                 │   │
│  │  - POST /api/chat      发送消息 (SSE 流式)      │   │
│  │  - GET  /api/history   获取历史                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  CLI: karma server --port 3080                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Karma API 设计

### 3.1 接口定义

#### POST /api/session

创建新会话

**Request:**
```json
{
  "userId": "test-user-001",
  "metadata": {
    "platform": "simulator",
    "persona": "curious-young"
  }
}
```

**Response:**
```json
{
  "sessionId": "sess_abc123",
  "createdAt": "2024-02-18T15:00:00Z"
}
```

#### POST /api/chat

发送消息，获取 Karma 回复（SSE 流式）

**Request:**
```json
{
  "sessionId": "sess_abc123",
  "message": "师傅你好，我想问问我的事业运"
}
```

**Response (SSE):**
```
data: {"type": "text", "content": "你好"}

data: {"type": "text", "content": "！请问"}

data: {"type": "text", "content": "你的生辰是？"}

data: {"type": "done"}
```

#### GET /api/history/:sessionId

获取会话历史

**Response:**
```json
{
  "sessionId": "sess_abc123",
  "messages": [
    {"role": "user", "content": "...", "timestamp": "..."},
    {"role": "assistant", "content": "...", "timestamp": "..."}
  ],
  "extractedInfo": {
    "name": "张三",
    "birthDate": "1998-05-15",
    "concerns": ["事业", "感情"]
  }
}
```

### 3.2 文件结构

```
karma/
├── src/
│   ├── api/
│   │   ├── index.ts          # 导出
│   │   ├── server.ts         # Fastify 服务器
│   │   ├── routes/
│   │   │   ├── session.ts    # 会话路由
│   │   │   └── chat.ts       # 聊天路由
│   │   └── types.ts          # API 类型定义
│   └── index.ts              # 增加 server 命令
```

---

## 4. disclaude Skill 设计

### 4.1 karma-simulator Skill

**文件:** `skills/karma-simulator/SKILL.md`

```yaml
---
name: karma-simulator
description: Karma 命理师测试模拟器 - 模拟用户与 Karma 对话并评估质量
allowed-tools: [Bash, Read, Write, Glob]
---
```

**核心职责:**
1. 加载用户人设
2. 调用 Karma API 进行对话
3. 评估对话质量
4. 生成测试报告

### 4.2 用户人设 Skill

每个人设一个目录，包含完整的用户画像。

**示例:** `skills/personas/curious-young/SKILL.md`

```yaml
---
name: curious-young
type: persona
age: 25
gender: male
---
```

**人设要素:**
- 基本信息（年龄、性别、职业）
- 生辰信息（用于测试信息提取）
- 性格特点
- 本次咨询目的
- 对话风格

---

## 5. 测试用例设计

### 5.1 场景覆盖

| 场景 | 人设 | 测试重点 |
|------|------|----------|
| 首次咨询 | 好奇青年 | 信息收集流程 |
| 情感咨询 | 焦虑妈妈 | 亲和力、安抚能力 |
| 质疑挑战 | 怀疑论者 | 应对质疑、专业度 |
| 老客回访 | 回头客 | 个性化、记忆能力 |
| 完整解读 | 详细型 | 八字解读完整性 |

### 5.2 评估指标

```typescript
interface EvaluationMetrics {
  // 信息提取 (0-10)
  infoExtraction: {
    score: number;
    extractedFields: string[];  // 成功提取的字段
    missingFields: string[];    // 遗漏的字段
  };

  // 亲和力 (0-10)
  warmth: {
    score: number;
    evidence: string[];         // 体现亲和力的对话片段
  };

  // 专业度 (0-10)
  professionalism: {
    score: number;
    evidence: string[];
  };

  // 用户满意度 (模拟) (0-10)
  userSatisfaction: {
    score: number;
    reason: string;
  };

  // 对话自然度 (0-10)
  naturalness: {
    score: number;
    issues: string[];           // 不自然的对话片段
  };
}
```

### 5.3 测试报告格式

```markdown
# Karma 模拟测试报告

**日期:** 2024-02-18
**人设:** curious-young (好奇青年)
**轮次:** 12
**耗时:** 3m 45s

## 总分: 7.8/10

## 各维度评分

| 维度 | 分数 | 说明 |
|------|------|------|
| 信息提取 | 9/10 | 成功提取姓名、生辰、出生地 |
| 亲和力 | 8/10 | 语气亲切，有共情 |
| 专业度 | 7/10 | 八字解读准确，但有点笼统 |
| 用户满意度 | 8/10 | 模拟用户表示愿意再来 |
| 对话自然度 | 7/10 | 有两处表述略显机械 |

## 发现的问题

1. [P1] 提到「事业运势」时未给出具体时间点
2. [P2] 第二次确认生辰信息显得重复
3. [P3] 结束时未主动询问是否还有其他问题

## 对话记录

[完整对话...]

## 建议

1. 在事业预测中增加具体月份
2. 优化信息确认的流程
3. 结束前主动引导后续咨询
```

---

## 6. 实现计划

### 6.1 阶段划分

| Phase | 任务 | 产出 | 工作量 |
|-------|------|------|--------|
| **8.1** | Karma HTTP API | api/server.ts | 2h |
| **8.2** | CLI 命令 | karma server | 0.5h |
| **8.3** | disclaude skill | karma-simulator SKILL.md | 1h |
| **8.4** | 用户人设 | 3-5 个人设 skill | 1h |
| **8.5** | CLI 命令 | disclaude simulate-karma | 2h |
| **8.6** | 测试与调优 | 测试报告 | 1h |

**总计: 约 1 天**

### 6.2 依赖关系

```
8.1 (Karma API)
  │
  ├──► 8.2 (karma server 命令)
  │
  └──► 8.3 (disclaude skill)
         │
         ├──► 8.4 (用户人设)
         │
         └──► 8.5 (disclaude simulate-karma 命令)
                │
                └──► 8.6 (测试与调优)
```

---

## 7. 测试策略

### 7.1 单元测试

- API 路由测试
- SSE 流式响应测试
- 会话管理测试

### 7.2 集成测试

- disclaude → Karma API 端到端测试
- 多轮对话流程测试
- 错误处理测试

### 7.3 验收测试

用 3-5 个人设各跑一次完整模拟，生成报告，评估：
- 平均分是否达到 7/10
- 无 P0 级别问题
- 信息提取完整度 > 80%

---

## 8. 未来扩展

此 API 可直接用于：

1. **Telegram Bot** - 复用同一 API
2. **小程序/App** - 前端直接调用
3. **Web 界面** - 实时对话页面
4. **批量测试** - CI/CD 中自动运行

---

## 附录

### A. 人设详细设计

见 `docs/personas/` 目录（待创建）

### B. API 完整规范

见 `docs/api-spec.md`（待创建）

### C. 评估标准详解

见 `docs/evaluation-criteria.md`（待创建）
