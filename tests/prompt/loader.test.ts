// Prompt Loader Tests - TDD: 测试先行
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, mkdirSync } from 'fs/promises';
import { join, dirname } from 'path';
import { FilePromptLoader } from '@/prompt/loader';

describe('FilePromptLoader', () => {
  let testDir: string;
  let loader: FilePromptLoader;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = join(process.cwd(), 'tests', 'fixtures', 'loader-test');
    await mkdir(testDir, { recursive: true });

    loader = new FilePromptLoader(testDir);
  });

  afterEach(async () => {
    // 清理测试目录
    await rm(testDir, { recursive: true, force: true });
  });

  describe('loadPrompt', () => {
    it('should load existing prompt file', async () => {
      // 准备测试文件
      await writeFile(
        join(testDir, 'persona.md'),
        '# 测试人设\n\n你是一位测试命理师。'
      );

      const content = await loader.loadPrompt('persona');

      expect(content).toContain('测试人设');
      expect(content).toContain('测试命理师');
    });

    it('should return fallback when file does not exist', async () => {
      const fallbackContent = '# 默认人设';
      const content = await loader.loadPrompt('nonexistent', fallbackContent);

      expect(content).toBe(fallbackContent);
    });

    it('should throw error when file does not exist and no fallback provided', async () => {
      await expect(loader.loadPrompt('nonexistent')).rejects.toThrow();
    });

    it('should load prompt with complex markdown content', async () => {
      const complexContent = `# 标题

## 子标题

- 列表项1
- 列表项2

| 列1 | 列2 |
|-----|-----|
| A   | B   |

\`\`\`typescript
const x = 1;
\`\`\`
`;
      await writeFile(join(testDir, 'complex.md'), complexContent);

      const content = await loader.loadPrompt('complex');

      expect(content).toContain('# 标题');
      expect(content).toContain('| 列1 | 列2 |');
      expect(content).toContain('const x = 1;');
    });

    it('should trim whitespace from loaded content', async () => {
      await writeFile(join(testDir, 'whitespace.md'), '  \n  内容  \n  ');

      const content = await loader.loadPrompt('whitespace');

      expect(content).toBe('内容');
    });
  });

  describe('loadPlatformRules', () => {
    beforeEach(async () => {
      // 创建平台规则子目录
      const platformsDir = join(testDir, 'platforms');
      await mkdir(platformsDir, { recursive: true });
    });

    it('should load CLI platform rules', async () => {
      await writeFile(
        join(testDir, 'platforms', 'cli.md'),
        '# CLI 平台规则\n\n直接在终端输出。'
      );

      const content = await loader.loadPlatformRules('cli');

      expect(content).toContain('CLI');
      expect(content).toContain('终端');
    });

    it('should load Feishu platform rules', async () => {
      await writeFile(
        join(testDir, 'platforms', 'feishu.md'),
        '# Feishu 平台规则\n\n输出会转换为卡片。'
      );

      const content = await loader.loadPlatformRules('feishu');

      expect(content).toContain('Feishu');
    });

    it('should load WeChat platform rules', async () => {
      await writeFile(
        join(testDir, 'platforms', 'wechat.md'),
        '# WeChat 平台规则\n\n消息长度有限制。'
      );

      const content = await loader.loadPlatformRules('wechat');

      expect(content).toContain('WeChat');
    });

    it('should return empty string for unknown platform', async () => {
      const content = await loader.loadPlatformRules('unknown');

      expect(content).toBe('');
    });
  });

  describe('listAvailablePrompts', () => {
    it('should list all available prompt files', async () => {
      await writeFile(join(testDir, 'persona.md'), '内容1');
      await writeFile(join(testDir, 'bazi.md'), '内容2');
      await writeFile(join(testDir, 'output-rules.md'), '内容3');

      const prompts = await loader.listAvailablePrompts();

      expect(prompts).toContain('persona');
      expect(prompts).toContain('bazi');
      expect(prompts).toContain('output-rules');
      expect(prompts.length).toBe(3);
    });

    it('should return empty array when no prompts exist', async () => {
      const prompts = await loader.listAvailablePrompts();

      expect(prompts).toEqual([]);
    });

    it('should not list files in subdirectories', async () => {
      await writeFile(join(testDir, 'top-level.md'), '内容');
      await mkdir(join(testDir, 'platforms'), { recursive: true });
      await writeFile(join(testDir, 'platforms', 'cli.md'), '平台规则');

      const prompts = await loader.listAvailablePrompts();

      expect(prompts).toContain('top-level');
      expect(prompts).not.toContain('cli');
      expect(prompts).not.toContain('platforms');
    });
  });

  describe('hasPrompt', () => {
    it('should return true for existing prompt', async () => {
      await writeFile(join(testDir, 'exists.md'), '内容');

      const exists = await loader.hasPrompt('exists');

      expect(exists).toBe(true);
    });

    it('should return false for non-existing prompt', async () => {
      const exists = await loader.hasPrompt('nonexistent');

      expect(exists).toBe(false);
    });
  });

  describe('reload (cache bypass)', () => {
    it('should reload file content after modification', async () => {
      const filePath = join(testDir, 'dynamic.md');
      await writeFile(filePath, '版本1');

      const content1 = await loader.loadPrompt('dynamic');
      expect(content1).toBe('版本1');

      // 修改文件
      await writeFile(filePath, '版本2');

      // 强制重新加载（不使用缓存）
      const content2 = await loader.loadPrompt('dynamic', undefined, true);
      expect(content2).toBe('版本2');
    });
  });
});

describe('FilePromptLoader with custom config path', () => {
  it('should work with absolute path', async () => {
    const testDir = join(process.cwd(), 'tests', 'fixtures', 'loader-absolute');
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, 'test.md'), '绝对路径测试');

    const loader = new FilePromptLoader(testDir);
    const content = await loader.loadPrompt('test');

    expect(content).toBe('绝对路径测试');

    await rm(testDir, { recursive: true, force: true });
  });
});
