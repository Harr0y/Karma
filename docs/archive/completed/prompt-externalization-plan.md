# Prompt 外置化改造方案

## 目标

将 `src/prompt/parts/` 中的硬编码 prompt 内容外置为 `.md` 文件，实现：
- 修改 prompt 无需编译
- 支持热更新（可选）
- 运维友好

## 改造范围

| 文件 | 当前状态 | 改造后 |
|------|----------|--------|
| `persona.ts` | 硬编码 DEFAULT_PERSONA | `config/prompts/persona.md` |
| `bazi.ts` | 硬编码 return 字符串 | `config/prompts/bazi.md` |
| `cold-reading.ts` | 硬编码 return 字符串 | `config/prompts/cold-reading.md` |
| `output-rules.ts` | 硬编码 return 字符串 | `config/prompts/output-rules.md` |
| `platform-rules.ts` | switch 硬编码 | `config/prompts/platforms/{cli,feishu,wechat}.md` |
| `tool-guidelines.ts` | 动态内容 | **不改造** |

## 文件结构

```
project/Karma/
├── config/
│   └── prompts/
│       ├── persona.md
│       ├── bazi.md
│       ├── cold-reading.md
│       ├── output-rules.md
│       └── platforms/
│           ├── cli.md
│           ├── feishu.md
│           └── wechat.md
├── src/prompt/
│   ├── builder.ts
│   ├── loader.ts          # 新增：统一加载器
│   └── parts/
│       ├── persona.ts     # 改造：使用 loader
│       ├── bazi.ts        # 改造：使用 loader
│       ├── cold-reading.ts
│       ├── output-rules.ts
│       ├── platform-rules.ts
│       └── tool-guidelines.ts  # 不变
└── tests/prompt/
    └── loader.test.ts     # 新增：加载器测试
```

## 实现步骤

### Step 1: 编写测试（TDD）

创建 `tests/prompt/loader.test.ts`，测试：
1. 能正确加载存在的 prompt 文件
2. 文件不存在时返回 fallback
3. 平台规则能按名称加载
4. 缓存机制（可选）

### Step 2: 实现 PromptLoader

创建 `src/prompt/loader.ts`：
- `loadPrompt(name: string): Promise<string>`
- `loadPlatformRules(platform: string): Promise<string>`
- 内置 fallback 机制

### Step 3: 创建外置 md 文件

从现有代码提取内容到 `config/prompts/` 目录。

### Step 4: 改造 parts/*.ts

将硬编码改为调用 loader。

### Step 5: 验证

运行测试，确保功能正常。

## 接口设计

```typescript
// src/prompt/loader.ts

export interface PromptLoader {
  /**
   * 加载指定名称的 prompt
   * @param name prompt 名称（不含扩展名）
   * @returns prompt 内容
   */
  loadPrompt(name: string): Promise<string>;

  /**
   * 加载平台规则
   * @param platform 平台名称 (cli | feishu | wechat)
   * @returns 平台规则内容
   */
  loadPlatformRules(platform: string): Promise<string>;
}

// 使用示例
const loader = new FilePromptLoader('./config/prompts');
const persona = await loader.loadPrompt('persona');
const feishuRules = await loader.loadPlatformRules('feishu');
```

## 错误处理

- 文件不存在 → 使用内置 fallback（从原代码保留）
- 文件读取失败 → 记录警告，使用 fallback
- 编码错误 → 抛出异常

## 兼容性

- 保持现有 `builder.ts` 接口不变
- 所有 `build*()` 函数签名不变
- 对外行为完全透明
