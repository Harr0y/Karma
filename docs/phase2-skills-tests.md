# Phase 2: Skills 系统测试方案

> Karma 项目第二阶段 - Skills 加载器和管理系统

---

## 一、目标

实现 Karma 的 Skills 系统：

1. **Skills 加载** - 从文件系统扫描和加载 SKILL.md 文件
2. **Frontmatter 解析** - 提取 name, description, disable-model-invocation
3. **索引生成** - 生成注入到 System Prompt 的 Skills 索引
4. **目录扫描** - 支持全局目录 (~/.karmav2/skills) 和项目目录 (.karma/skills)

---

## 二、技术选型

### 2.1 核心依赖

- **gray-matter** - YAML frontmatter 解析
- **glob** - 文件模式匹配
- **fs/promises** - 异步文件操作

### 2.2 测试框架

- **Vitest** - 已配置
- **fixturify** - 测试文件系统 fixture (可选，或手动创建临时目录)

---

## 三、文件结构

```
karma/
├── src/
│   └── skills/
│       ├── index.ts           # 导出
│       ├── loader.ts          # Skills 加载器
│       ├── parser.ts          # Frontmatter 解析
│       ├── formatter.ts       # Prompt 格式化
│       └── types.ts           # TypeScript 类型
├── tests/
│   └── skills/
│       ├── loader.test.ts     # 加载器测试
│       ├── parser.test.ts     # 解析器测试
│       ├── formatter.test.ts  # 格式化测试
│       └── fixtures/          # 测试 fixture
│           ├── valid-skill/
│           │   └── SKILL.md
│           ├── invalid-skill/
│           │   └── SKILL.md
│           └── multiple-skills/
│               ├── skill-a/
│               │   └── SKILL.md
│               └── skill-b/
│                   └── SKILL.md
└── docs/
    └── phase2-skills-tests.md
```

---

## 四、依赖安装

```bash
npm install gray-matter glob
npm install -D @types/glob
```

---

## 五、类型定义

```typescript
// src/skills/types.ts

export interface SkillFrontmatter {
  name: string;
  description: string;
  'disable-model-invocation'?: boolean;
}

export interface Skill {
  name: string;
  description: string;
  filePath: string;
  content: string;              // 完整内容 (包括 frontmatter)
  body: string;                 // 仅 body (不含 frontmatter)
  disableModelInvocation: boolean;
  source: 'global' | 'project' | 'path';
}

export interface LoadSkillsOptions {
  globalDir?: string;    // 默认: ~/.karmav2/skills
  projectDir?: string;   // 默认: {cwd}/.karma/skills
  cwd?: string;          // 用于解析相对路径
}

export interface LoadSkillsResult {
  skills: Skill[];
  errors: SkillLoadError[];
}

export interface SkillLoadError {
  filePath: string;
  error: string;
}
```

---

## 六、核心接口

```typescript
// src/skills/loader.ts

/**
 * 从目录加载所有 Skills
 */
export function loadSkills(options?: LoadSkillsOptions): LoadSkillsResult;

/**
 * 从单个文件加载 Skill
 */
export function loadSkillFromFile(
  filePath: string,
  source: Skill['source']
): Skill | null;

/**
 * 扫描目录中的 SKILL.md 文件
 */
export function discoverSkillFiles(dir: string): string[];

// src/skills/parser.ts

/**
 * 解析 SKILL.md 文件
 */
export function parseSkillFile(
  content: string,
  filePath: string
): { skill: Skill | null; error?: string };

/**
 * 验证 frontmatter
 */
export function validateFrontmatter(
  frontmatter: unknown
): { valid: true; data: SkillFrontmatter } | { valid: false; error: string };

// src/skills/formatter.ts

/**
 * 生成 Skills 索引 Prompt
 */
export function formatSkillsForPrompt(skills: Skill[]): string;

/**
 * 过滤掉 disableModelInvocation=true 的 skills
 */
export function getVisibleSkills(skills: Skill[]): Skill[];
```

---

## 七、测试用例设计

### 7.1 Parser 测试

```typescript
// tests/skills/parser.test.ts

import { describe, it, expect } from 'vitest';
import { parseSkillFile, validateFrontmatter } from '@/skills/parser';

describe('Skills Parser', () => {
  describe('parseSkillFile', () => {
    it('should parse valid skill file', () => {
      const content = `---
name: cold-reading
description: 心理冷读技术
---

# 心理冷读技能

## 12 阶段断言速查表
...`;

      const result = parseSkillFile(content, '/path/to/SKILL.md');

      expect(result.skill).not.toBeNull();
      expect(result.skill?.name).toBe('cold-reading');
      expect(result.skill?.description).toBe('心理冷读技术');
      expect(result.skill?.body).toContain('# 心理冷读技能');
      expect(result.skill?.disableModelInvocation).toBe(false);
    });

    it('should parse skill with disable-model-invocation', () => {
      const content = `---
name: secret-skill
description: Secret skill
disable-model-invocation: true
---
Content`;

      const result = parseSkillFile(content, '/path/to/SKILL.md');

      expect(result.skill?.disableModelInvocation).toBe(true);
    });

    it('should return error for missing name', () => {
      const content = `---
description: Missing name
---
Content`;

      const result = parseSkillFile(content, '/path/to/SKILL.md');

      expect(result.skill).toBeNull();
      expect(result.error).toContain('name');
    });

    it('should return error for missing description', () => {
      const content = `---
name: test-skill
---
Content`;

      const result = parseSkillFile(content, '/path/to/SKILL.md');

      expect(result.skill).toBeNull();
      expect(result.error).toContain('description');
    });

    it('should return error for empty file', () => {
      const result = parseSkillFile('', '/path/to/SKILL.md');

      expect(result.skill).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('should return error for file without frontmatter', () => {
      const content = `# Just a heading\n\nNo frontmatter here.`;

      const result = parseSkillFile(content, '/path/to/SKILL.md');

      expect(result.skill).toBeNull();
      expect(result.error).toContain('frontmatter');
    });
  });

  describe('validateFrontmatter', () => {
    it('should validate complete frontmatter', () => {
      const frontmatter = {
        name: 'test-skill',
        description: 'Test description',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.name).toBe('test-skill');
      }
    });

    it('should reject missing name', () => {
      const frontmatter = {
        description: 'No name',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
    });

    it('should reject empty name', () => {
      const frontmatter = {
        name: '',
        description: 'Empty name',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
    });

    it('should reject invalid name format', () => {
      const frontmatter = {
        name: 'Invalid Name!',  // 包含空格和特殊字符
        description: 'Invalid name',
      };

      const result = validateFrontmatter(frontmatter);

      expect(result.valid).toBe(false);
    });
  });
});
```

### 7.2 Loader 测试

```typescript
// tests/skills/loader.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { loadSkills, discoverSkillFiles } from '@/skills/loader';

describe('Skills Loader', () => {
  const testDir = join(process.cwd(), 'tests', 'fixtures', 'skills-test');

  beforeEach(async () => {
    // 创建测试目录结构
    await mkdir(join(testDir, 'skill-a'), { recursive: true });
    await mkdir(join(testDir, 'skill-b'), { recursive: true });

    // 创建有效的 skill 文件
    await writeFile(
      join(testDir, 'skill-a', 'SKILL.md'),
      `---
name: skill-a
description: Skill A description
---
Content A`
    );

    await writeFile(
      join(testDir, 'skill-b', 'SKILL.md'),
      `---
name: skill-b
description: Skill B description
disable-model-invocation: true
---
Content B`
    );

    // 创建根目录的 skill
    await writeFile(
      join(testDir, 'root-skill.md'),
      `---
name: root-skill
description: Root skill description
---
Root content`
    );
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('discoverSkillFiles', () => {
    it('should discover SKILL.md in subdirectories', async () => {
      const files = discoverSkillFiles(testDir);

      expect(files.length).toBe(3);  // skill-a, skill-b, root-skill
      expect(files.some(f => f.endsWith('skill-a/SKILL.md'))).toBe(true);
      expect(files.some(f => f.endsWith('skill-b/SKILL.md'))).toBe(true);
    });

    it('should return empty array for non-existent directory', () => {
      const files = discoverSkillFiles('/non/existent/path');
      expect(files).toEqual([]);
    });
  });

  describe('loadSkills', () => {
    it('should load all skills from directory', async () => {
      const result = loadSkills({ projectDir: testDir });

      expect(result.skills.length).toBe(3);
      expect(result.errors.length).toBe(0);
    });

    it('should set correct source', async () => {
      const result = loadSkills({
        globalDir: testDir,
        projectDir: undefined,
      });

      const skill = result.skills.find(s => s.name === 'skill-a');
      expect(skill?.source).toBe('global');
    });

    it('should report errors for invalid files', async () => {
      // 创建无效的 skill 文件
      await mkdir(join(testDir, 'invalid'), { recursive: true });
      await writeFile(
        join(testDir, 'invalid', 'SKILL.md'),
        'No frontmatter here'
      );

      const result = loadSkills({ projectDir: testDir });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].filePath).toContain('invalid');
    });

    it('should deduplicate skills by name', async () => {
      // 创建同名 skill
      await mkdir(join(testDir, 'skill-c'), { recursive: true });
      await writeFile(
        join(testDir, 'skill-c', 'SKILL.md'),
        `---
name: skill-a  // 与 skill-a 同名
description: Duplicate name
---
Content C`
      );

      const result = loadSkills({ projectDir: testDir });

      // 应该只有一个 skill-a
      const skillAs = result.skills.filter(s => s.name === 'skill-a');
      expect(skillAs.length).toBe(1);
    });
  });
});
```

### 7.3 Formatter 测试

```typescript
// tests/skills/formatter.test.ts

import { describe, it, expect } from 'vitest';
import { formatSkillsForPrompt, getVisibleSkills } from '@/skills/formatter';
import type { Skill } from '@/skills/types';

describe('Skills Formatter', () => {
  const mockSkills: Skill[] = [
    {
      name: 'cold-reading',
      description: '心理冷读技术',
      filePath: '/skills/cold-reading/SKILL.md',
      content: '---\nname: cold-reading\n---\nContent',
      body: 'Content',
      disableModelInvocation: false,
      source: 'global',
    },
    {
      name: 'secret-skill',
      description: 'Secret skill',
      filePath: '/skills/secret-skill/SKILL.md',
      content: '---\nname: secret-skill\n---\nContent',
      body: 'Content',
      disableModelInvocation: true,
      source: 'global',
    },
  ];

  describe('getVisibleSkills', () => {
    it('should filter out skills with disableModelInvocation=true', () => {
      const visible = getVisibleSkills(mockSkills);

      expect(visible.length).toBe(1);
      expect(visible[0].name).toBe('cold-reading');
    });

    it('should return empty array if all skills are disabled', () => {
      const allDisabled = mockSkills.map(s => ({
        ...s,
        disableModelInvocation: true,
      }));

      const visible = getVisibleSkills(allDisabled);

      expect(visible).toEqual([]);
    });
  });

  describe('formatSkillsForPrompt', () => {
    it('should generate XML format prompt', () => {
      const visible = getVisibleSkills(mockSkills);
      const prompt = formatSkillsForPrompt(visible);

      expect(prompt).toContain('<available_skills>');
      expect(prompt).toContain('</available_skills>');
      expect(prompt).toContain('<skill>');
      expect(prompt).toContain('</skill>');
    });

    it('should include skill name and description', () => {
      const prompt = formatSkillsForPrompt([mockSkills[0]]);

      expect(prompt).toContain('cold-reading');
      expect(prompt).toContain('心理冷读技术');
    });

    it('should include skill location', () => {
      const prompt = formatSkillsForPrompt([mockSkills[0]]);

      expect(prompt).toContain('/skills/cold-reading/SKILL.md');
    });

    it('should return empty string for empty skills', () => {
      const prompt = formatSkillsForPrompt([]);

      expect(prompt).toBe('');
    });

    it('should include instruction to use Read tool', () => {
      const prompt = formatSkillsForPrompt([mockSkills[0]]);

      expect(prompt).toContain('Read');
      expect(prompt).toContain('load');
    });
  });
});
```

---

## 八、配置文件更新

### 8.1 package.json 添加依赖

```json
{
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "drizzle-orm": "^0.39.3",
    "gray-matter": "^4.0.3",
    "glob": "^11.0.0"
  }
}
```

---

## 九、实施步骤

### Step 1: 安装依赖

```bash
npm install gray-matter glob
npm install -D @types/glob
```

### Step 2: 创建文件结构

```bash
mkdir -p src/skills tests/skills tests/fixtures
touch src/skills/{index,loader,parser,formatter,types}.ts
touch tests/skills/{loader,parser,formatter}.test.ts
```

### Step 3: 实现 types.ts

定义 Skill, LoadSkillsOptions, LoadSkillsResult 等类型

### Step 4: 实现 parser.ts

实现 parseSkillFile, validateFrontmatter

### Step 5: 实现 loader.ts

实现 loadSkills, discoverSkillFiles, loadSkillFromFile

### Step 6: 实现 formatter.ts

实现 formatSkillsForPrompt, getVisibleSkills

### Step 7: 运行测试

```bash
npm test
```

---

## 十、验收标准

Phase 2 完成的标准：

- [ ] 所有测试通过 (`npm test`)
- [ ] 可以从目录加载 SKILL.md 文件
- [ ] 正确解析 frontmatter
- [ ] 生成正确的 XML 格式索引
- [ ] 正确过滤 disableModelInvocation=true 的 skills
- [ ] 代码通过 TypeScript 类型检查
