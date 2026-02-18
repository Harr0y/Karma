# Phase 7: 数据闭环与系统集成

> 基于 2025-02 审计报告，解决「代码已实现但未调用」的核心问题

---

## 审计结论

| 模块 | 代码实现 | 实际调用 | 问题 |
|------|----------|----------|------|
| Storage | 100% | 10% | 只写入 sessions 表 |
| Skills | 100% | 100% | ✅ 正常 |
| Persona | 100% | 0% | PersonaService 未实例化 |
| Tools | SDK 内置 | - | 需要命理专用工具 |
| Platform | 80% | 0% | 飞书未测试 |

**核心问题**: 不是「代码没写」，而是「写了没调用」

---

## Phase 7 目标

1. **数据闭环**: 让所有对话数据真正写入数据库
2. **Persona 生效**: 让 PersonaService 真正注入 prompt
3. **工具扩展**: 添加八字排盘等命理专用工具
4. **飞书验证**: 确保飞书适配器正常工作

---

## Part 1: Storage 数据闭环

### 1.1 当前问题

```typescript
// 当前 index.ts 的流程：
const storage = new StorageService(config.storage.path);
const sessionManager = new SessionManager(storage);
// ... runner.runText(...) ...
// 结束！没有任何数据写入！
```

`StorageService` 有 21 个方法全部实现，但实际调用：
- ✅ `createSession` - SessionManager 调用
- ✅ `updateSdkSessionId` - Runner 调用
- ❌ `addMessage` - 没人调用
- ❌ `createClient` - 没人调用
- ❌ `addConfirmedFact` - 没人调用
- ❌ `addPrediction` - 没人调用
- ❌ `generateClientProfilePrompt` - 没人调用

### 1.2 修改目标

```
对话完成后：
├── 用户消息 → messages 表
├── 助手消息 → messages 表
├── 识别的客户信息 → clients 表
├── 确认的事实 → confirmed_facts 表
└── 做出的预测 → predictions 表
```

### 1.3 测试设计

#### 测试文件: `tests/agent/message-persistence.test.ts`

```typescript
describe('Message Persistence', () => {
  it('should save user message after turn', async () => {
    // Given: 一个新会话
    // When: 用户发送消息
    // Then: messages 表有一条 role='user' 的记录
  });

  it('should save assistant message after turn', async () => {
    // Given: 一个新会话
    // When: Agent 响应完成
    // Then: messages 表有一条 role='assistant' 的记录
  });

  it('should accumulate multi-turn messages', async () => {
    // Given: 一个已有消息的会话
    // When: 进行第二轮对话
    // Then: messages 表有 4 条记录 (2 user + 2 assistant)
  });
});
```

#### 测试文件: `tests/agent/client-creation.test.ts`

```typescript
describe('Client Creation', () => {
  it('should create client when birth info extracted', async () => {
    // Given: 新用户第一次对话
    // When: 用户提供生辰信息 "1990年5月15日早上6点，北京"
    // Then: clients 表有一条新记录
    // And: session.clientId 已设置
  });

  it('should link returning client by birth info', async () => {
    // Given: 已有客户档案
    // When: 同一生辰信息的用户再次出现
    // Then: 复用已有 client 记录
    // And: sessionCount 递增
  });

  it('should update client profile with new info', async () => {
    // Given: 已有客户档案（缺少姓名）
    // When: 用户补充 "我叫张三"
    // Then: client.name 更新为 "张三"
  });
});
```

#### 测试文件: `tests/agent/fact-extraction.test.ts`

```typescript
describe('Fact Extraction', () => {
  it('should save confirmed fact', async () => {
    // Given: 已识别的客户
    // When: Agent 输出 <confirmed_fact category="career">目前在互联网公司工作</confirmed_fact>
    // Then: confirmed_facts 表有一条新记录
    // And: confirmed = true
  });

  it('should save prediction', async () => {
    // Given: 已识别的客户
    // When: Agent 输出 <prediction year="2025">下半年有晋升机会</prediction>
    // Then: predictions 表有一条新记录
    // And: status = 'pending'
  });
});
```

### 1.4 实现要点

#### 1.4.1 消息持久化

文件: `src/agent/runner.ts`

```typescript
async *run(options: RunOptions): AsyncGenerator<ProcessedMessage> {
  const { userInput, session } = options;

  // 1. 记录用户消息
  await this.config.storage.addMessage(
    session.id,
    'user',
    userInput
  );

  // 2. 收集助手响应
  let assistantContent = '';

  try {
    for await (const msg of q) {
      // ... 现有处理逻辑 ...

      if (msg.type === 'text') {
        assistantContent += msg.content;
        yield { type: 'text', content: filtered, raw: msg };
      }
    }

    // 3. 记录助手消息（完成后）
    if (assistantContent) {
      await this.config.storage.addMessage(
        session.id,
        'assistant',
        assistantContent
      );
    }
  } catch (err) {
    // 即使出错也要记录已收集的内容
    if (assistantContent) {
      await this.config.storage.addMessage(
        session.id,
        'assistant',
        assistantContent
      );
    }
    throw err;
  }
}
```

#### 1.4.2 客户档案创建

文件: `src/agent/info-extractor.ts` (新文件)

```typescript
import type { StorageService } from '@/storage/service.js';

export interface ExtractedInfo {
  name?: string;
  gender?: 'male' | 'female';
  birthDate?: string;
  birthPlace?: string;
  currentCity?: string;
}

// 从 Agent 输出中提取结构化信息
export function extractClientInfo(text: string): ExtractedInfo | null {
  // 解析 <client_info> 标签
  const match = text.match(/<client_info>([\s\S]*?)<\/client_info>/);
  if (!match) return null;

  const info: ExtractedInfo = {};
  const content = match[1];

  // 提取各字段
  const nameMatch = content.match(/姓名[：:]\s*(.+)/);
  if (nameMatch) info.name = nameMatch[1].trim();

  const genderMatch = content.match(/性别[：:]\s*(男|女)/);
  if (genderMatch) info.gender = genderMatch[1] === '男' ? 'male' : 'female';

  const birthMatch = content.match(/生辰[：:]\s*(.+)/);
  if (birthMatch) info.birthDate = birthMatch[1].trim();

  const placeMatch = content.match(/出生地[：:]\s*(.+)/);
  if (placeMatch) info.birthPlace = placeMatch[1].trim();

  return Object.keys(info).length > 0 ? info : null;
}

export function extractFact(text: string): { fact: string; category?: string } | null {
  const match = text.match(/<confirmed_fact(?:\s+category="([^"]*)")?>([^<]*)<\/confirmed_fact>/);
  if (!match) return null;

  return {
    category: match[1] || undefined,
    fact: match[2].trim(),
  };
}

export function extractPrediction(text: string): { prediction: string; year?: number } | null {
  const match = text.match(/<prediction(?:\s+year="(\d+)")?>([^<]*)<\/prediction>/);
  if (!match) return null;

  return {
    year: match[1] ? parseInt(match[1]) : undefined,
    prediction: match[2].trim(),
  };
}
```

#### 1.4.3 在 prompt 中加入输出规范

文件: `src/prompt/parts/output-rules.ts`

在现有内容基础上添加：

```typescript
// 在输出规则中添加结构化输出标签
export const STRUCTURED_OUTPUT_RULES = `
## 结构化输出

当从对话中获取到客户信息时，使用以下标签：

<client_info>
姓名：[如果知道]
性别：[男/女]
生辰：[公历日期时间]
出生地：[城市]
</client_info>

当客户确认你的断言时：
<confirmed_fact category="[career|relationship|health|wealth|other]">确认的事实</confirmed_fact>

当你做出预测时：
<prediction year="[年份]">预测内容</prediction>
`;
```

---

## Part 2: Persona 系统接入

### 2.1 当前问题

```typescript
// builder.ts 期望收到 personaConfig
parts.push(await buildPersona(context.personaConfig));

// 但 runner.ts 传的 context 里没有！
const systemPrompt = await buildSystemPrompt({
  now: new Date(),
  skills,
  platform: 'cli',
  // 缺少 personaConfig!
});
```

### 2.2 测试设计

#### 测试文件: `tests/persona/integration.test.ts`

```typescript
describe('Persona Integration', () => {
  it('should use PersonaService in buildSystemPrompt', async () => {
    // Given: PersonaService 实例
    // When: 调用 buildSystemPrompt({ personaConfig: { personaService } })
    // Then: 返回的 prompt 包含人设内容
  });

  it('should load SOUL.md when exists', async () => {
    // Given: SOUL.md 文件存在
    // When: PersonaService.getPersona()
    // Then: 返回 SOUL.md 内容
  });

  it('should use default persona when SOUL.md not exists', async () => {
    // Given: SOUL.md 文件不存在
    // When: PersonaService.getPersona()
    // Then: 返回默认人设
  });

  it('should generate tuning for returning client', async () => {
    // Given: 老客户 (sessionCount >= 3)
    // When: PersonaService.getPersona(clientId)
    // Then: 返回基础人设 + 微调片段
    // And: 微调片段包含 "这是第 N 次来咨询的老客户"
  });

  it('should include client profile in prompt', async () => {
    // Given: 已有客户档案
    // When: buildSystemPrompt({ clientProfile })
    // Then: prompt 包含客户档案部分
  });
});
```

### 2.3 实现要点

#### 2.3.1 实例化 PersonaService

文件: `src/index.ts`

```typescript
import { PersonaService } from './persona/index.js';
import path from 'path';

async function main() {
  // ... 现有初始化 ...

  // 新增：初始化 PersonaService
  const personaService = new PersonaService({
    soulPath: path.join(process.cwd(), 'SOUL.md'),
    storage,
  });

  // 创建 Runner 时传入
  const runner = new AgentRunner({
    storage,
    sessionManager,
    skills,
    personaService,  // 新增
    model: config.ai.model,
    baseUrl: config.ai.baseUrl,
    authToken: config.ai.authToken,
  });
}
```

#### 2.3.2 更新 AgentRunnerConfig

文件: `src/agent/runner.ts`

```typescript
import type { PersonaService } from '@/persona/service.js';

export interface AgentRunnerConfig {
  storage: StorageService;
  sessionManager: SessionManager;
  skills: Skill[];
  personaService: PersonaService;  // 新增
  model: string;
  baseUrl?: string;
  authToken?: string;
}

async *run(options: RunOptions): AsyncGenerator<ProcessedMessage> {
  const { userInput, session } = options;
  const { storage, personaService, skills, model, baseUrl, authToken } = this.config;

  // 获取 clientId（如果有）
  const clientId = session.clientId;

  // 构建完整 prompt
  const systemPrompt = await buildSystemPrompt({
    now: new Date(),
    skills,
    platform: 'cli',
    personaConfig: {
      personaService,
      clientId,  // 支持个性化微调
    },
    clientProfile: clientId
      ? await storage.generateClientProfilePrompt(clientId)
      : undefined,
  });

  // ... 其余代码 ...
}
```

#### 2.3.3 更新 Session 类型

文件: `src/session/types.ts`

```typescript
export interface ActiveSession {
  id: string;
  sdkSessionId?: string;
  clientId?: string;  // 新增：关联客户
  platform: string;
  externalChatId?: string;
}
```

#### 2.3.4 更新 SessionManager

文件: `src/session/manager.ts`

```typescript
export interface CreateSessionOptions {
  platform: string;
  externalChatId?: string;
  clientId?: string;  // 新增
}

async getOrCreateSession(options: CreateSessionOptions): Promise<ActiveSession> {
  // ... 现有逻辑 ...

  // 创建时保存 clientId
  if (options.clientId) {
    session.clientId = options.clientId;
  }

  return session;
}
```

---

## Part 3: 命理专用工具

### 3.1 当前情况

SDK 已提供通用工具（Read, Edit, Write, WebSearch 等），但缺少命理专用工具。

### 3.2 测试设计

#### 测试文件: `tests/tools/bazi-calculator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { calculateBazi, formatBaziResult } from '@/tools/bazi-calculator.js';

describe('Bazi Calculator', () => {
  it('should calculate bazi for known date', async () => {
    // Given: 公历 1990-05-15 06:00，男，北京
    const result = await calculateBazi({
      birthDate: '1990-05-15T06:00:00',
      birthPlace: '北京',
      gender: 'male',
    });

    // Then: 应该得到正确的四柱
    expect(result.yearPillar).toEqual({ stem: '庚', branch: '午' });
    expect(result.monthPillar).toBeDefined();
    expect(result.dayPillar).toBeDefined();
    expect(result.hourPillar).toBeDefined();
  });

  it('should calculate dayun (大运)', async () => {
    // Given: 一个有效的出生信息
    const result = await calculateBazi({
      birthDate: '1990-05-15T06:00:00',
      birthPlace: '北京',
      gender: 'male',
    });

    // Then: 应该有大运列表
    expect(result.dayun).toBeInstanceOf(Array);
    expect(result.dayun.length).toBeGreaterThan(0);
    expect(result.dayun[0]).toHaveProperty('age');
    expect(result.dayun[0]).toHaveProperty('stem');
    expect(result.dayun[0]).toHaveProperty('branch');
  });

  it('should handle lunar date conversion', async () => {
    // Given: 农历日期
    const result = await calculateBazi({
      lunarDate: '1990-04-21',
      birthPlace: '北京',
      gender: 'male',
    });

    // Then: 应该能正确转换
    expect(result.yearPillar).toBeDefined();
  });

  it('should format result for prompt', () => {
    // Given: 一个计算结果
    const result = { /* ... */ };

    // When: 格式化
    const formatted = formatBaziResult(result);

    // Then: 应该是适合 prompt 的文本
    expect(formatted).toContain('年柱');
    expect(formatted).toContain('月柱');
    expect(formatted).toContain('日柱');
    expect(formatted).toContain('时柱');
  });
});
```

#### 测试文件: `tests/tools/calendar-converter.test.ts`

```typescript
describe('Calendar Converter', () => {
  it('should convert solar to lunar', () => {
    // Given: 公历 1990-05-15
    // When: solarToLunar('1990-05-15')
    // Then: 返回 农历 1990-04-21
  });

  it('should convert lunar to solar', () => {
    // Given: 农历 1990-04-21
    // When: lunarToSolar('1990-04-21')
    // Then: 返回 公历 1990-05-15
  });

  it('should get solar terms', () => {
    // Given: 年份 1990
    // When: getSolarTerms(1990)
    // Then: 返回 24 节气日期
  });
});
```

### 3.3 实现要点

#### 3.3.1 八字计算工具

文件: `src/tools/bazi-calculator.ts`

```typescript
import { Solar, Lunar } from 'lunar-javascript';

export interface BaziInput {
  birthDate?: string;  // ISO 格式公历日期
  lunarDate?: string;  // 农历日期 YYYY-MM-DD
  birthPlace: string;
  gender: 'male' | 'female';
}

export interface BaziResult {
  yearPillar: { stem: string; branch: string };
  monthPillar: { stem: string; branch: string };
  dayPillar: { stem: string; branch: string };
  hourPillar: { stem: string; branch: string };
  dayun: Array<{ age: number; stem: string; branch: string }>;
  liunian: Array<{ year: number; stem: string; branch: string }>;
  nayin: string;  // 纳音
}

export async function calculateBazi(input: BaziInput): Promise<BaziResult> {
  // 使用 lunar-javascript 库计算
  let solar: Solar;

  if (input.birthDate) {
    solar = Solar.fromDate(new Date(input.birthDate));
  } else if (input.lunarDate) {
    const [year, month, day] = input.lunarDate.split('-').map(Number);
    const lunar = Lunar.fromYmd(year, month, day);
    solar = lunar.getSolar();
  } else {
    throw new Error('Must provide either birthDate or lunarDate');
  }

  const lunar = solar.getLunar();
  const bazi = lunar.getEightChar();

  // 获取四柱
  const yearPillar = { stem: bazi.getYearGan(), branch: bazi.getYearZhi() };
  const monthPillar = { stem: bazi.getMonthGan(), branch: bazi.getMonthZhi() };
  const dayPillar = { stem: bazi.getDayGan(), branch: bazi.getDayZhi() };
  const hourPillar = { stem: bazi.getTimeGan(), branch: bazi.getTimeZhi() };

  // 获取大运
  const genderNum = input.gender === 'male' ? 1 : 0;
  const yun = bazi.getYun(genderNum);
  const dayun = yun.getDaYun().map((d: any, i: number) => ({
    age: d.getStartAge() + i * 10,
    stem: d.getGanZhi().substring(0, 1),
    branch: d.getGanZhi().substring(1),
  }));

  // 获取流年
  const currentYear = new Date().getFullYear();
  const liunian = [];
  for (let i = 0; i < 10; i++) {
    const year = currentYear + i;
    const yearLunar = Lunar.fromDate(new Date(year, 0, 1));
    const yearGanZhi = yearLunar.getYearInGanZhi();
    liunian.push({
      year,
      stem: yearGanZhi.substring(0, 1),
      branch: yearGanZhi.substring(1),
    });
  }

  return {
    yearPillar,
    monthPillar,
    dayPillar,
    hourPillar,
    dayun,
    liunian,
    nayin: bazi.getYearNaYin(),
  };
}

export function formatBaziResult(result: BaziResult): string {
  const lines = [
    `年柱：${result.yearPillar.stem}${result.yearPillar.branch}`,
    `月柱：${result.monthPillar.stem}${result.monthPillar.branch}`,
    `日柱：${result.dayPillar.stem}${result.dayPillar.branch}`,
    `时柱：${result.hourPillar.stem}${result.hourPillar.branch}`,
    `纳音：${result.nayin}`,
    '',
    '大运：',
    ...result.dayun.map(d => `  ${d.age}岁起：${d.stem}${d.branch}`),
    '',
    '近年流年：',
    ...result.liunian.map(l => `  ${l.year}年：${l.stem}${l.branch}`),
  ];

  return lines.join('\n');
}
```

#### 3.3.2 注册为 SDK 工具

文件: `src/agent/tools.ts`

```typescript
import { calculateBazi } from '@/tools/bazi-calculator.js';

export const karmaTools = [
  {
    name: 'bazi_calculator',
    description: '根据生辰信息排八字命盘，返回四柱、大运、流年等信息',
    input_schema: {
      type: 'object',
      properties: {
        birthDate: {
          type: 'string',
          description: '公历生日，ISO 格式，如 1990-05-15T06:00:00',
        },
        lunarDate: {
          type: 'string',
          description: '农历生日，格式 YYYY-MM-DD',
        },
        birthPlace: {
          type: 'string',
          description: '出生地城市名',
        },
        gender: {
          type: 'string',
          enum: ['male', 'female'],
          description: '性别',
        },
      },
      required: ['birthPlace', 'gender'],
    },
  },
];

export async function executeKarmaTool(
  name: string,
  input: Record<string, any>
): Promise<any> {
  switch (name) {
    case 'bazi_calculator':
      return calculateBazi(input);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
```

#### 3.3.3 在 Runner 中处理工具调用

文件: `src/agent/runner.ts`

```typescript
import { karmaTools, executeKarmaTool } from './tools.js';

async *run(options: RunOptions): AsyncGenerator<ProcessedMessage> {
  // ... 现有代码 ...

  const queryOptions = {
    model,
    systemPrompt,
    resume: session.sdkSessionId,
    permissionMode: 'bypassPermissions' as const,
    allowDangerouslySkipPermissions: true,
    cwd: process.cwd(),
    env,
    tools: karmaTools,  // 添加自定义工具
  };

  // ... 在消息处理中 ...

  if (block.type === 'tool_use') {
    // 处理自定义工具
    if (karmaTools.find(t => t.name === block.name)) {
      const result = await executeKarmaTool(block.name, block.input);

      // 保存到客户档案
      if (block.name === 'bazi_calculator' && clientId) {
        await this.config.storage.updateClient(clientId, {
          baziSummary: formatBaziResult(result),
        });
      }

      yield { type: 'tool_use', content: `${block.name} executed`, raw: msg };
    }
  }
}
```

---

## Part 4: 飞书适配器验证

### 4.1 当前状态

✅ 飞书适配器已完整实现，使用 WebSocket 模式（`lark.WSClient`）。

### 4.2 现有实现

文件: `src/platform/adapters/feishu/adapter.ts`

```typescript
// WebSocket 模式
this.wsClient = new lark.WSClient({
  appId: this.config.appId,
  appSecret: this.config.appSecret,
  appType: lark.AppType.SelfBuild,
  domain: lark.Domain.Lark,
});

const eventDispatcher = new lark.EventDispatcher({}).register({
  'im.message.receive_v1': async (data: unknown) => {
    await this.handleRawMessage(data);
  },
});

await this.wsClient.start({ eventDispatcher });
```

### 4.3 测试

文件: `tests/platform/feishu-adapter.test.ts` (7 tests)

- constructor 创建适配器
- isRunning 状态检查
- start/stop 启停控制
- onMessage 注册处理器
- parseMessage 解析消息
- message flow 多处理器支持

### 4.4 说明

- 不需要单独的 `server.ts`（webhook 模式）
- 现有 FeishuAdapter 已实现 WebSocket 长连接
- 使用时只需 `adapter.start()` 即可接收消息

---

## 实施路线图

### Week 1: 数据闭环 + Persona

```
Day 1: Part 1.4.1 消息持久化
  ├── tests/agent/message-persistence.test.ts
  └── src/agent/runner.ts 修改

Day 2: Part 1.4.2 客户档案 + Part 1.4.3 事实提取
  ├── tests/agent/client-creation.test.ts
  ├── tests/agent/fact-extraction.test.ts
  ├── src/agent/info-extractor.ts (新)
  └── src/prompt/parts/output-rules.ts 修改

Day 3: Part 2 Persona 接入
  ├── tests/persona/integration.test.ts
  ├── src/index.ts 修改
  ├── src/agent/runner.ts 修改
  └── src/session/types.ts 修改
```

### Week 2: 工具 + 飞书

```
Day 4: Part 3 命理工具
  ├── tests/tools/bazi-calculator.test.ts
  ├── src/tools/bazi-calculator.ts (新)
  └── src/agent/tools.ts (新)

Day 5: Part 4 飞书验证
  ├── tests/platform/feishu-adapter.test.ts
  └── src/server.ts (新)
```

---

## 验收标准

### Part 1: 数据闭环 ✅

- [x] 对话后 messages 表有数据 - `runner.ts` 调用 `addMessage`
- [x] 识别生辰后 clients 表有数据 - `info-extractor.ts` + `handleClientInfo`
- [x] 老客户回来能关联 - `findClientByBirthInfo`
- [x] 事实和预测能提取存储 - `extractFact` + `extractPrediction`

### Part 2: Persona ✅

- [x] PersonaService 实例化 - `index.ts`
- [x] 传给 AgentRunner - `runner.ts`
- [x] 客户档案出现在 prompt 中 - `generateClientProfilePrompt`

### Part 3: 工具 ✅

- [x] 八字排盘工具 - `src/tools/bazi-calculator.ts`
- [x] 工具注册 - `src/tools/registry.ts`
- [x] 工具提示注入 - `src/prompt/parts/tool-guidelines.ts`

### Part 4: 飞书 ✅

- [x] WebSocket 适配器 - `src/platform/adapters/feishu/adapter.ts`
- [x] 单元测试 - `tests/platform/feishu-adapter.test.ts`

---

## 测试数量预估

| 部分 | 新增测试 |
|------|----------|
| Part 1 | 15 |
| Part 2 | 8 |
| Part 3 | 10 |
| Part 4 | 10 |
| **总计** | **43** |

---

## 依赖

| 依赖 | 用途 | 安装 |
|------|------|------|
| lunar-javascript | 农历/八字计算 | `pnpm add lunar-javascript` |

---

**准备好开始 Phase 7 了吗？**
