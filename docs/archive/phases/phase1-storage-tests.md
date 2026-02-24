# Phase 1: Storage Layer 测试方案

> Karma 项目第一阶段 - 存储层的测试驱动开发

---

## 一、目标

实现 Karma 的持久化存储层：

1. **客户档案管理** - 创建、查询、更新客户信息
2. **会话管理** - 创建会话、追踪 SDK session_id、恢复历史会话
3. **事实追踪** - 记录用户确认/否认的断言
4. **预测记录** - 追踪做出的预测及其验证状态

---

## 二、技术选型

### 2.1 数据库

- **SQLite** - 轻量、零配置、单文件
- **better-sqlite3** - 同步 API，性能好
- **drizzle-orm** - 类型安全，轻量级 ORM

### 2.2 测试框架

- **Vitest** - 快速、Vite 生态、兼容 Jest API
- **内存数据库** - `:memory:` 模式，测试隔离

---

## 三、项目结构

```
karma/
├── src/
│   ├── storage/
│   │   ├── index.ts           # 导出
│   │   ├── schema.ts          # Drizzle schema
│   │   ├── service.ts         # StorageService
│   │   └── types.ts           # TypeScript 类型
│   └── index.ts
├── tests/
│   ├── storage/
│   │   ├── service.test.ts    # StorageService 测试
│   │   └── fixtures.ts        # 测试数据
│   └── setup.ts               # 测试环境配置
├── docs/
│   └── phase1-storage-tests.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── drizzle.config.ts
```

---

## 四、依赖安装

```bash
# 数据库
npm install better-sqlite3 drizzle-orm

# 类型
npm install -D @types/better-sqlite3

# 测试
npm install -D vitest @vitest/coverage-v8

# TypeScript
npm install -D typescript tsx

# Drizzle 工具 (可选，用于迁移)
npm install -D drizzle-kit
```

---

## 五、Schema 设计

```typescript
// src/storage/schema.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 客户档案
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name'),
  gender: text('gender'),
  birthDate: text('birth_date'),
  birthDateLunar: text('birth_date_lunar'),
  birthPlace: text('birth_place'),
  currentCity: text('current_city'),

  // 八字信息
  baziSummary: text('bazi_summary'),
  zodiacWestern: text('zodiac_western'),
  zodiacChinese: text('zodiac_chinese'),
  personaArchetype: text('persona_archetype'),
  coreElements: text('core_elements', { mode: 'json' }),

  // 元数据
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  sessionCount: integer('session_count').default(1),
  metadata: text('metadata', { mode: 'json' }),
});

// 会话记录
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  sdkSessionId: text('sdk_session_id'),

  platform: text('platform'),
  externalChatId: text('external_chat_id'),

  status: text('status').default('active'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),

  summary: text('summary'),
  metadata: text('metadata', { mode: 'json' }),
});

// 确认/否认的事实
export const confirmedFacts = sqliteTable('confirmed_facts', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  sessionId: text('session_id').references(() => sessions.id),

  fact: text('fact').notNull(),
  category: text('category'),
  confirmed: integer('confirmed', { mode: 'boolean' }),

  originalPrediction: text('original_prediction'),
  clientResponse: text('client_response'),
  reframe: text('reframe'),

  createdAt: text('created_at').notNull(),
});

// 预测记录
export const predictions = sqliteTable('predictions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').references(() => clients.id),
  sessionId: text('session_id').references(() => sessions.id),

  prediction: text('prediction').notNull(),
  targetYear: integer('target_year'),
  category: text('category'),
  status: text('status').default('pending'),

  createdAt: text('created_at').notNull(),
  verifiedAt: text('verified_at'),
  verificationNotes: text('verification_notes'),
});

// 消息记录
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),

  role: text('role').notNull(),
  content: text('content').notNull(),
  rawContent: text('raw_content'),

  toolCalls: text('tool_calls', { mode: 'json' }),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
});
```

---

## 六、StorageService 接口

```typescript
// src/storage/types.ts

export interface Client {
  id: string;
  name?: string;
  gender?: 'male' | 'female';
  birthDate?: string;
  birthDateLunar?: string;
  birthPlace?: string;
  currentCity?: string;
  baziSummary?: string;
  zodiacWestern?: string;
  zodiacChinese?: string;
  personaArchetype?: string;
  coreElements?: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  sessionCount: number;
  metadata?: Record<string, unknown>;
}

export interface Session {
  id: string;
  clientId?: string;
  sdkSessionId?: string;
  platform: string;
  externalChatId?: string;
  status: 'active' | 'completed' | 'abandoned';
  startedAt: string;
  endedAt?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface ConfirmedFact {
  id: string;
  clientId: string;
  sessionId: string;
  fact: string;
  category?: string;
  confirmed: boolean;
  originalPrediction?: string;
  clientResponse?: string;
  reframe?: string;
  createdAt: string;
}

export interface Prediction {
  id: string;
  clientId: string;
  sessionId: string;
  prediction: string;
  targetYear?: number;
  category?: string;
  status: 'pending' | 'confirmed' | 'denied' | 'expired';
  createdAt: string;
  verifiedAt?: string;
  verificationNotes?: string;
}
```

```typescript
// src/storage/service.ts

export class StorageService {
  constructor(dbPath: string);

  // ===== 客户管理 =====

  /** 创建新客户 */
  createClient(data: Partial<Client>): Promise<string>;

  /** 获取客户 */
  getClient(id: string): Promise<Client | null>;

  /** 根据出生信息查找客户 */
  findClientByBirthInfo(birthDate: string, birthPlace: string): Promise<Client | null>;

  /** 更新客户信息 */
  updateClient(id: string, data: Partial<Client>): Promise<void>;

  /** 搜索客户 */
  searchClients(query: string): Promise<Client[]>;

  // ===== 会话管理 =====

  /** 创建新会话 */
  createSession(data: {
    clientId?: string;
    platform: string;
    externalChatId?: string;
  }): Promise<string>;

  /** 获取会话 */
  getSession(id: string): Promise<Session | null>;

  /** 根据 external_chat_id 获取会话 */
  getSessionByExternalChatId(platform: string, externalChatId: string): Promise<Session | null>;

  /** 根据 sdk_session_id 获取会话 */
  getSessionBySdkId(sdkSessionId: string): Promise<Session | null>;

  /** 更新 SDK session_id */
  updateSdkSessionId(sessionId: string, sdkSessionId: string): Promise<void>;

  /** 结束会话 */
  endSession(sessionId: string, summary?: string): Promise<void>;

  // ===== 事实管理 =====

  /** 添加确认/否认的事实 */
  addConfirmedFact(data: Omit<ConfirmedFact, 'id' | 'createdAt'>): Promise<string>;

  /** 获取客户的所有事实 */
  getClientFacts(clientId: string): Promise<ConfirmedFact[]>;

  /** 获取会话的所有事实 */
  getSessionFacts(sessionId: string): Promise<ConfirmedFact[]>;

  // ===== 预测管理 =====

  /** 添加预测 */
  addPrediction(data: Omit<Prediction, 'id' | 'createdAt' | 'status'>): Promise<string>;

  /** 获取客户的所有预测 */
  getClientPredictions(clientId: string): Promise<Prediction[]>;

  /** 更新预测状态 */
  updatePredictionStatus(
    predictionId: string,
    status: Prediction['status'],
    notes?: string
  ): Promise<void>;

  // ===== 消息管理 =====

  /** 添加消息 */
  addMessage(sessionId: string, role: string, content: string, rawContent?: string): Promise<void>;

  /** 获取会话消息 */
  getSessionMessages(sessionId: string, limit?: number): Promise<Message[]>;

  // ===== 工具方法 =====

  /** 生成客户档案 Prompt */
  generateClientProfilePrompt(clientId: string): Promise<string>;

  /** 关闭数据库连接 */
  close(): void;
}
```

---

## 七、测试用例设计

### 7.1 客户管理测试

```typescript
// tests/storage/service.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageService } from '@/storage/service';

describe('StorageService - Clients', () => {
  let storage: StorageService;

  beforeEach(() => {
    storage = new StorageService(':memory:');
  });

  afterEach(() => {
    storage.close();
  });

  describe('createClient', () => {
    it('should create a client with generated ID', async () => {
      const id = await storage.createClient({
        name: '张三',
        gender: 'male',
        birthDate: '1990-05-15',
      });

      expect(id).toMatch(/^client_[a-z0-9]+$/);

      const client = await storage.getClient(id);
      expect(client?.name).toBe('张三');
      expect(client?.gender).toBe('male');
      expect(client?.birthDate).toBe('1990-05-15');
    });

    it('should set firstSeenAt and lastSeenAt to now', async () => {
      const before = new Date().toISOString();
      const id = await storage.createClient({ name: '李四' });
      const after = new Date().toISOString();

      const client = await storage.getClient(id);
      expect(client?.firstSeenAt).toBeTruthy();
      expect(client?.lastSeenAt).toBeTruthy();
      expect(client?.firstSeenAt >= before).toBe(true);
      expect(client?.lastSeenAt <= after).toBe(true);
    });

    it('should default sessionCount to 1', async () => {
      const id = await storage.createClient({ name: '王五' });
      const client = await storage.getClient(id);
      expect(client?.sessionCount).toBe(1);
    });
  });

  describe('getClient', () => {
    it('should return null for non-existent client', async () => {
      const client = await storage.getClient('non_existent');
      expect(client).toBeNull();
    });
  });

  describe('findClientByBirthInfo', () => {
    it('should find client by birth date and place', async () => {
      await storage.createClient({
        name: '测试用户',
        birthDate: '1990-05-15',
        birthPlace: '上海',
      });

      const found = await storage.findClientByBirthInfo('1990-05-15', '上海');
      expect(found?.name).toBe('测试用户');
    });

    it('should return null if not found', async () => {
      const found = await storage.findClientByBirthInfo('2000-01-01', '北京');
      expect(found).toBeNull();
    });
  });

  describe('updateClient', () => {
    it('should update client fields', async () => {
      const id = await storage.createClient({ name: '原名字' });

      await storage.updateClient(id, {
        name: '新名字',
        currentCity: '深圳',
      });

      const client = await storage.getClient(id);
      expect(client?.name).toBe('新名字');
      expect(client?.currentCity).toBe('深圳');
    });

    it('should update lastSeenAt', async () => {
      const id = await storage.createClient({ name: '测试' });
      const before = await storage.getClient(id);

      // 等待 1ms 确保时间不同
      await new Promise(r => setTimeout(r, 1));

      await storage.updateClient(id, { name: '更新后' });
      const after = await storage.getClient(id);

      expect(after?.lastSeenAt > before?.lastSeenAt!).toBe(true);
    });
  });
});
```

### 7.2 会话管理测试

```typescript
describe('StorageService - Sessions', () => {
  let storage: StorageService;
  let clientId: string;

  beforeEach(async () => {
    storage = new StorageService(':memory:');
    clientId = await storage.createClient({ name: '测试客户' });
  });

  afterEach(() => {
    storage.close();
  });

  describe('createSession', () => {
    it('should create a session with generated ID', async () => {
      const sessionId = await storage.createSession({
        clientId,
        platform: 'cli',
      });

      expect(sessionId).toMatch(/^session_[a-z0-9]+$/);

      const session = await storage.getSession(sessionId);
      expect(session?.clientId).toBe(clientId);
      expect(session?.platform).toBe('cli');
      expect(session?.status).toBe('active');
    });

    it('should store external_chat_id for Feishu', async () => {
      const sessionId = await storage.createSession({
        platform: 'feishu',
        externalChatId: 'oc_abc123',
      });

      const session = await storage.getSession(sessionId);
      expect(session?.externalChatId).toBe('oc_abc123');
    });

    it('should allow session without client_id', async () => {
      const sessionId = await storage.createSession({
        platform: 'cli',
      });

      const session = await storage.getSession(sessionId);
      expect(session?.clientId).toBeUndefined();
    });
  });

  describe('getSessionByExternalChatId', () => {
    it('should find session by external_chat_id', async () => {
      await storage.createSession({
        platform: 'feishu',
        externalChatId: 'oc_xyz789',
      });

      const found = await storage.getSessionByExternalChatId('feishu', 'oc_xyz789');
      expect(found).toBeTruthy();
      expect(found?.platform).toBe('feishu');
    });

    it('should return null if not found', async () => {
      const found = await storage.getSessionByExternalChatId('feishu', 'nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('updateSdkSessionId', () => {
    it('should store sdk_session_id', async () => {
      const sessionId = await storage.createSession({ platform: 'cli' });

      await storage.updateSdkSessionId(sessionId, 'sdk_abc123');

      const session = await storage.getSession(sessionId);
      expect(session?.sdkSessionId).toBe('sdk_abc123');
    });

    it('should allow finding by sdk_session_id', async () => {
      const sessionId = await storage.createSession({ platform: 'cli' });
      await storage.updateSdkSessionId(sessionId, 'sdk_xyz789');

      const found = await storage.getSessionBySdkId('sdk_xyz789');
      expect(found?.id).toBe(sessionId);
    });
  });

  describe('endSession', () => {
    it('should mark session as completed', async () => {
      const sessionId = await storage.createSession({ platform: 'cli' });

      await storage.endSession(sessionId, '完成了算命');

      const session = await storage.getSession(sessionId);
      expect(session?.status).toBe('completed');
      expect(session?.summary).toBe('完成了算命');
      expect(session?.endedAt).toBeTruthy();
    });
  });
});
```

### 7.3 事实追踪测试

```typescript
describe('StorageService - ConfirmedFacts', () => {
  let storage: StorageService;
  let clientId: string;
  let sessionId: string;

  beforeEach(async () => {
    storage = new StorageService(':memory:');
    clientId = await storage.createClient({ name: '测试' });
    sessionId = await storage.createSession({ clientId, platform: 'cli' });
  });

  afterEach(() => {
    storage.close();
  });

  describe('addConfirmedFact', () => {
    it('should record confirmed fact', async () => {
      const factId = await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '2022年换工作了',
        category: 'career',
        confirmed: true,
      });

      expect(factId).toMatch(/^fact_[a-z0-9]+$/);
    });

    it('should record denied fact with reframe', async () => {
      const factId = await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '2018年结婚了',
        confirmed: false,
        originalPrediction: '2018年动姻缘',
        clientResponse: '没结，2021年才结',
        reframe: '婚象在2021年应验',
      });

      const facts = await storage.getClientFacts(clientId);
      expect(facts[0].confirmed).toBe(false);
      expect(facts[0].reframe).toBe('婚象在2021年应验');
    });
  });

  describe('getClientFacts', () => {
    it('should return all facts for client', async () => {
      await storage.addConfirmedFact({
        clientId, sessionId,
        fact: '事实1',
        confirmed: true,
      });
      await storage.addConfirmedFact({
        clientId, sessionId,
        fact: '事实2',
        confirmed: false,
      });

      const facts = await storage.getClientFacts(clientId);
      expect(facts).toHaveLength(2);
    });

    it('should only return facts for specified client', async () => {
      const otherClientId = await storage.createClient({ name: '另一个' });
      const otherSessionId = await storage.createSession({
        clientId: otherClientId,
        platform: 'cli',
      });

      await storage.addConfirmedFact({
        clientId, sessionId,
        fact: '客户1的事实',
        confirmed: true,
      });
      await storage.addConfirmedFact({
        clientId: otherClientId,
        sessionId: otherSessionId,
        fact: '客户2的事实',
        confirmed: true,
      });

      const facts = await storage.getClientFacts(clientId);
      expect(facts).toHaveLength(1);
      expect(facts[0].fact).toBe('客户1的事实');
    });
  });
});
```

---

## 八、配置文件

### 8.1 package.json

```json
{
  "name": "karma",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "drizzle-orm": "^0.38.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.0.0",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "tsx": "^4.19.0"
  }
}
```

### 8.2 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 8.3 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

---

## 九、实施步骤

### Step 1: 项目初始化

```bash
cd /Users/harry/Workspaces/karma

# 初始化 git (已完成)
# npm init (已完成)

# 安装依赖
npm install better-sqlite3 drizzle-orm
npm install -D @types/better-sqlite3
npm install -D typescript tsx vitest @vitest/coverage-v8
```

### Step 2: 创建基础文件

```bash
mkdir -p src/storage tests/storage docs
touch src/storage/{index,schema,service,types}.ts
touch tests/storage/{service.test,fixtures}.ts
touch tests/setup.ts
touch tsconfig.json vitest.config.ts
```

### Step 3: 实现 Schema

按第六节的 schema.ts 内容实现

### Step 4: 实现类型定义

按第六节的 types.ts 内容实现

### Step 5: 实现 StorageService

实现核心 CRUD 方法

### Step 6: 编写测试

按第七节的测试用例编写

### Step 7: 运行测试

```bash
npm test
```

---

## 十、验收标准

Phase 1 完成的标准：

- [ ] 所有测试通过 (`npm test`)
- [ ] 覆盖率 > 80%
- [ ] 可以创建/查询客户
- [ ] 可以创建/恢复会话
- [ ] 可以记录事实和预测
- [ ] 代码通过 TypeScript 类型检查
