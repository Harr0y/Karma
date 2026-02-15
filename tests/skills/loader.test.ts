// Skills Loader Tests
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
      const files = await discoverSkillFiles(testDir);

      expect(files.length).toBe(3);  // skill-a, skill-b, root-skill
      expect(files.some(f => f.endsWith('skill-a/SKILL.md'))).toBe(true);
      expect(files.some(f => f.endsWith('skill-b/SKILL.md'))).toBe(true);
      expect(files.some(f => f.endsWith('root-skill.md'))).toBe(true);
    });

    it('should return empty array for non-existent directory', async () => {
      const files = await discoverSkillFiles('/non/existent/path');
      expect(files).toEqual([]);
    });
  });

  describe('loadSkills', () => {
    it('should load all skills from directory', async () => {
      const result = await loadSkills({ projectDir: testDir, globalDir: '' });

      expect(result.skills.length).toBe(3);
      expect(result.errors.length).toBe(0);
    });

    it('should set correct source for global skills', async () => {
      const result = await loadSkills({
        globalDir: testDir,
        projectDir: '',
      });

      const skill = result.skills.find(s => s.name === 'skill-a');
      expect(skill?.source).toBe('global');
    });

    it('should set correct source for project skills', async () => {
      const result = await loadSkills({
        globalDir: '',
        projectDir: testDir,
      });

      const skill = result.skills.find(s => s.name === 'skill-a');
      expect(skill?.source).toBe('project');
    });

    it('should report errors for invalid files', async () => {
      // 创建无效的 skill 文件
      await mkdir(join(testDir, 'invalid'), { recursive: true });
      await writeFile(
        join(testDir, 'invalid', 'SKILL.md'),
        'No frontmatter here'
      );

      const result = await loadSkills({ projectDir: testDir, globalDir: '' });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].filePath).toContain('invalid');
    });

    it('should deduplicate skills by name (project overrides global)', async () => {
      // 创建全局目录的同名 skill
      const globalDir = join(testDir, 'global');
      await mkdir(join(globalDir, 'skill-a'), { recursive: true });
      await writeFile(
        join(globalDir, 'skill-a', 'SKILL.md'),
        `---
name: skill-a
description: Global skill A
---
Global content`
      );

      const result = await loadSkills({
        globalDir,
        projectDir: testDir,
      });

      // 应该只有一个 skill-a
      const skillAs = result.skills.filter(s => s.name === 'skill-a');
      expect(skillAs.length).toBe(1);

      // 应该是 project 版本 (因为后加载)
      expect(skillAs[0].description).toBe('Skill A description');
      expect(skillAs[0].source).toBe('project');
    });

    it('should skip hidden directories', async () => {
      // 创建隐藏目录
      await mkdir(join(testDir, '.hidden'), { recursive: true });
      await writeFile(
        join(testDir, '.hidden', 'SKILL.md'),
        `---
name: hidden-skill
description: Should not be loaded
---
Hidden`
      );

      const result = await loadSkills({ projectDir: testDir, globalDir: '' });

      expect(result.skills.find(s => s.name === 'hidden-skill')).toBeUndefined();
    });

    it('should parse disable-model-invocation correctly', async () => {
      const result = await loadSkills({ projectDir: testDir, globalDir: '' });

      const skillB = result.skills.find(s => s.name === 'skill-b');
      expect(skillB?.disableModelInvocation).toBe(true);

      const skillA = result.skills.find(s => s.name === 'skill-a');
      expect(skillA?.disableModelInvocation).toBe(false);
    });
  });
});
