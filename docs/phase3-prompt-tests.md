# Phase 3: System Prompt 模块化测试方案

> Karma 项目第三阶段 - System Prompt 组合式构建

---

## 一、目标

实现 System Prompt 的模块化构建：

1. **组合式构建** - 从独立模块组装完整 Prompt
2. **时间锚点** - 注入精确的日期时间
3. **人设配置** - 支持从 SOUL.md 加载
4. **Skills 索引** - 动态注入可用技能
5. **客户档案** - 条件性注入客户信息
6. **平台规则** - 根据平台调整输出规则

---

## 二、设计回顾 (来自架构文档)

```typescript
// src/prompt/builder.ts

export interface SystemPromptContext {
  now: Date;
  clientProfile?: string;    // 已格式化的客户档案
  skills: Skill[];
  platform: 'cli' | 'feishu' | 'wechat';
  personaConfig?: {
    path?: string;           // SOUL.md 路径
    content?: string;        // 直接提供内容
  };
}

export function buildSystemPrompt(context: SystemPromptContext): string {
  const parts: string[] = [];

  // 1. 时间锚点 (必须)
  parts.push(buildTimeAnchor(context.now));

  // 2. 人设 (可从 SOUL.md 加载)
  parts.push(buildPersona(context.personaConfig));

  // 3. 八字框架 (核心方法)
  parts.push(buildBaziFramework());

  // 4. 冷读引擎
  parts.push(buildColdReadingEngine());

  // 5. Skills 索引 (动态)
  parts.push(formatSkillsForPrompt(context.skills));

  // 6. 客户档案 (如果有)
  if (context.clientProfile) {
    parts.push(context.clientProfile);
  }

  // 7. 平台规则
  parts.push(buildPlatformRules(context.platform));

  // 8. 工具使用指南
  parts.push(buildToolGuidelines());

  // 9. 输出格式规则
  parts.push(buildOutputRules());

  return parts.join('\n\n');
}
```

---

## 三、文件结构

```
karma/
├── src/
│   └── prompt/
│       ├── index.ts           # 导出
│       ├── builder.ts         # 主构建器
│       ├── types.ts           # 类型定义
│       └── parts/             # 各部分模块
│           ├── time-anchor.ts
│           ├── persona.ts
│           ├── bazi.ts
│           ├── cold-reading.ts
│           ├── platform-rules.ts
│           ├── tool-guidelines.ts
│           └── output-rules.ts
├── tests/
│   └── prompt/
│       ├── builder.test.ts
│       └── parts/
│           ├── time-anchor.test.ts
│           ├── persona.test.ts
│           └── platform-rules.test.ts
└── docs/
    └── phase3-prompt-tests.md
```

---

## 四、类型定义

```typescript
// src/prompt/types.ts

export type Platform = 'cli' | 'feishu' | 'wechat';

export interface PersonaConfig {
  path?: string;      // SOUL.md 文件路径
  content?: string;   // 直接提供内容
}

export interface SystemPromptContext {
  now: Date;
  clientProfile?: string;
  skills: Skill[];
  platform: Platform;
  personaConfig?: PersonaConfig;
}

export interface BuildPromptOptions {
  includeBazi?: boolean;           // 默认 true
  includeColdReading?: boolean;    // 默认 true
  includeToolGuidelines?: boolean; // 默认 true
}
```

---

## 五、核心接口

```typescript
// src/prompt/builder.ts

/**
 * 构建完整的 System Prompt
 */
export function buildSystemPrompt(
  context: SystemPromptContext,
  options?: BuildPromptOptions
): string;

// src/prompt/parts/time-anchor.ts
export function buildTimeAnchor(now: Date): string;

// src/prompt/parts/persona.ts
export function buildPersona(config?: PersonaConfig): Promise<string>;
export function loadPersonaFromFile(path: string): Promise<string>;

// src/prompt/parts/bazi.ts
export function buildBaziFramework(): string;

// src/prompt/parts/cold-reading.ts
export function buildColdReadingEngine(): string;

// src/prompt/parts/platform-rules.ts
export function buildPlatformRules(platform: Platform): string;

// src/prompt/parts/tool-guidelines.ts
export function buildToolGuidelines(): string;

// src/prompt/parts/output-rules.ts
export function buildOutputRules(): string;
```

---

## 六、测试用例设计

### 6.1 时间锚点测试

```typescript
// tests/prompt/parts/time-anchor.test.ts

import { describe, it, expect } from 'vitest';
import { buildTimeAnchor } from '@/prompt/parts/time-anchor';

describe('buildTimeAnchor', () => {
  it('should include current date in zh-CN format', () => {
    const now = new Date('2024-02-15T12:00:00');
    const result = buildTimeAnchor(now);

    expect(result).toContain('2024');
    expect(result).toContain('2月15日');
  });

  it('should include day of week', () => {
    const now = new Date('2024-02-15T12:00:00'); // Thursday
    const result = buildTimeAnchor(now);

    expect(result).toContain('星期');
  });

  it('should include current year explicitly', () => {
    const now = new Date('2025-12-25T00:00:00');
    const result = buildTimeAnchor(now);

    expect(result).toContain('2025年');
  });

  it('should format time correctly', () => {
    const now = new Date('2024-02-15T14:30:00');
    const result = buildTimeAnchor(now);

    expect(result).toContain('14:30');
  });
});
```

### 6.2 人设测试

```typescript
// tests/prompt/parts/persona.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { buildPersona, loadPersonaFromFile } from '@/prompt/parts/persona';

describe('buildPersona', () => {
  it('should return default persona when no config provided', async () => {
    const result = await buildPersona();

    expect(result).toContain('命理师');
    expect(result).toContain('三十年');
  });

  it('should use provided content', async () => {
    const result = await buildPersona({
      content: '你是一位测试人设。',
    });

    expect(result).toBe('你是一位测试人设。');
  });

  it('should load from file when path provided', async () => {
    const testDir = join(process.cwd(), 'tests', 'fixtures', 'persona-test');
    const soulFile = join(testDir, 'SOUL.md');

    await mkdir(testDir, { recursive: true });
    await writeFile(soulFile, `你是一位测试大师，精通测试之道。`);

    const result = await buildPersona({ path: soulFile });

    expect(result).toContain('测试大师');

    await rm(testDir, { recursive: true });
  });

  it('should fallback to default if file not found', async () => {
    const result = await buildPersona({
      path: '/nonexistent/SOUL.md',
    });

    expect(result).toContain('命理师');
  });
});

describe('loadPersonaFromFile', () => {
  it('should throw for non-existent file', async () => {
    await expect(loadPersonaFromFile('/nonexistent.md')).rejects.toThrow();
  });
});
```

### 6.3 平台规则测试

```typescript
// tests/prompt/parts/platform-rules.test.ts

import { describe, it, expect } from 'vitest';
import { buildPlatformRules } from '@/prompt/parts/platform-rules';

describe('buildPlatformRules', () => {
  it('should include CLI-specific rules', () => {
    const result = buildPlatformRules('cli');

    expect(result).toContain('CLI');
  });

  it('should include Feishu-specific rules', () => {
    const result = buildPlatformRules('feishu');

    expect(result).toContain('Feishu');
    expect(result).toContain('markdown');
  });

  it('should mention message length limits for Feishu', () => {
    const result = buildPlatformRules('feishu');

    // Feishu 可能有消息长度限制
    expect(result).toMatch(/长度|limit/i);
  });

  it('should be empty for unknown platform', () => {
    const result = buildPlatformRules('unknown' as any);

    expect(result).toBe('');
  });
});
```

### 6.4 Builder 集成测试

```typescript
// tests/prompt/builder.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { buildSystemPrompt } from '@/prompt/builder';
import type { Skill } from '@/skills/types';

describe('buildSystemPrompt', () => {
  const mockSkills: Skill[] = [
    {
      name: 'cold-reading',
      description: '心理冷读',
      filePath: '/skills/cold-reading/SKILL.md',
      content: '',
      body: '',
      disableModelInvocation: false,
      source: 'global',
    },
  ];

  it('should build prompt with all parts', async () => {
    const prompt = await buildSystemPrompt({
      now: new Date('2024-02-15'),
      skills: mockSkills,
      platform: 'cli',
    });

    // 验证各部分存在
    expect(prompt).toContain('2024年');           // 时间锚点
    expect(prompt).toContain('命理师');           // 人设
    expect(prompt).toContain('八字');             // 八字框架
    expect(prompt).toContain('<available_skills>'); // Skills
    expect(prompt).toContain('CLI');              // 平台规则
  });

  it('should include client profile when provided', async () => {
    const prompt = await buildSystemPrompt({
      now: new Date(),
      skills: [],
      platform: 'cli',
      clientProfile: '# 客户档案\n姓名: 张三',
    });

    expect(prompt).toContain('客户档案');
    expect(prompt).toContain('张三');
  });

  it('should not include client profile when not provided', async () => {
    const prompt = await buildSystemPrompt({
      now: new Date(),
      skills: [],
      platform: 'cli',
    });

    expect(prompt).not.toContain('客户档案');
  });

  it('should format skills correctly', async () => {
    const prompt = await buildSystemPrompt({
      now: new Date(),
      skills: mockSkills,
      platform: 'cli',
    });

    expect(prompt).toContain('<available_skills>');
    expect(prompt).toContain('cold-reading');
  });

  it('should use custom persona from file', async () => {
    const testDir = join(process.cwd(), 'tests', 'fixtures', 'prompt-test');
    const soulFile = join(testDir, 'SOUL.md');

    await mkdir(testDir, { recursive: true });
    await writeFile(soulFile, '你是一位测试人设。');

    const prompt = await buildSystemPrompt({
      now: new Date(),
      skills: [],
      platform: 'cli',
      personaConfig: { path: soulFile },
    });

    expect(prompt).toContain('测试人设');

    await rm(testDir, { recursive: true });
  });

  it('should separate parts with double newlines', async () => {
    const prompt = await buildSystemPrompt({
      now: new Date(),
      skills: [],
      platform: 'cli',
    });

    expect(prompt).toContain('\n\n');
  });

  it('should exclude optional parts when disabled', async () => {
    const prompt = await buildSystemPrompt(
      {
        now: new Date(),
        skills: [],
        platform: 'cli',
      },
      {
        includeBazi: false,
        includeColdReading: false,
      }
    );

    expect(prompt).not.toContain('八字框架');
    expect(prompt).not.toContain('冷读');
  });

  it('should use Feishu-specific rules', async () => {
    const prompt = await buildSystemPrompt({
      now: new Date(),
      skills: [],
      platform: 'feishu',
    });

    expect(prompt).toContain('Feishu');
  });
});
```

---

## 七、实施步骤

### Step 1: 创建文件结构

```bash
mkdir -p src/prompt/parts tests/prompt/parts
touch src/prompt/{index,builder,types}.ts
touch src/prompt/parts/{time-anchor,persona,bazi,cold-reading,platform-rules,tool-guidelines,output-rules}.ts
touch tests/prompt/{builder.test.ts}
touch tests/prompt/parts/{time-anchor,persona,platform-rules}.test.ts
```

### Step 2: 实现时间锚点

实现 `buildTimeAnchor(now: Date): string`

### Step 3: 实现人设模块

实现 `buildPersona(config?: PersonaConfig): Promise<string>`
实现 `loadPersonaFromFile(path: string): Promise<string>`

### Step 4: 实现静态模块

实现 `buildBaziFramework()`, `buildColdReadingEngine()`, `buildToolGuidelines()`, `buildOutputRules()`

### Step 5: 实现平台规则

实现 `buildPlatformRules(platform: Platform): string`

### Step 6: 实现主构建器

实现 `buildSystemPrompt(context, options?): string`

### Step 7: 运行测试

```bash
npm test
```

---

## 八、验收标准

Phase 3 完成的标准：

- [ ] 所有测试通过 (`npm test`)
- [ ] 可以组合构建完整 System Prompt
- [ ] 时间锚点格式正确 (zh-CN)
- [ ] 支持从文件加载人设
- [ ] Skills 索引正确注入
- [ ] 客户档案条件性注入
- [ ] 平台规则正确切换
- [ ] 代码通过 TypeScript 类型检查

---

## 九、与现有实现的迁移

完成后，可以从 Karma-V2 (原项目) 迁移：

1. 提取 `prompt.ts` 中的各部分到独立模块
2. 保持内容一致，只是结构化
3. 添加 SOUL.md 支持
4. 添加平台规则
