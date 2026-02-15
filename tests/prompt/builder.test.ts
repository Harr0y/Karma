// System Prompt Builder Tests
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
    expect(prompt).toContain('【系统时间锚点】');  // 时间锚点
    expect(prompt).toContain('命理师');           // 人设
    expect(prompt).toContain('八字框架');         // 八字框架
    expect(prompt).toContain('冷读');             // 冷读引擎
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

    expect(prompt).not.toContain('# 八字框架');
    expect(prompt).not.toContain('# 核心方法论');
  });

  it('should use Feishu-specific rules', async () => {
    const prompt = await buildSystemPrompt({
      now: new Date(),
      skills: [],
      platform: 'feishu',
    });

    expect(prompt).toContain('Feishu');
  });

  it('should not include empty skills prompt', async () => {
    const prompt = await buildSystemPrompt({
      now: new Date(),
      skills: [],
      platform: 'cli',
    });

    // 当没有 skills 时，不应该有 <available_skills>
    expect(prompt).not.toContain('<available_skills>');
  });

  it('should include tool guidelines by default', async () => {
    const prompt = await buildSystemPrompt({
      now: new Date(),
      skills: [],
      platform: 'cli',
    });

    expect(prompt).toContain('工具');
  });

  it('should exclude tool guidelines when disabled', async () => {
    const prompt = await buildSystemPrompt(
      {
        now: new Date(),
        skills: [],
        platform: 'cli',
      },
      {
        includeToolGuidelines: false,
      }
    );

    expect(prompt).not.toContain('文件操作');
  });

  it('should include output rules by default', async () => {
    const prompt = await buildSystemPrompt({
      now: new Date(),
      skills: [],
      platform: 'cli',
    });

    expect(prompt).toContain('# 输出格式规则');
  });

  it('should exclude output rules when disabled', async () => {
    const prompt = await buildSystemPrompt(
      {
        now: new Date(),
        skills: [],
        platform: 'cli',
      },
      {
        includeOutputRules: false,
      }
    );

    expect(prompt).not.toContain('# 输出格式规则');
  });
});
