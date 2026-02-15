// Persona Tests
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

  it('should prefer content over path', async () => {
    const result = await buildPersona({
      content: '直接提供的内容',
      path: '/nonexistent/SOUL.md',
    });

    expect(result).toBe('直接提供的内容');
  });
});

describe('loadPersonaFromFile', () => {
  const testDir = join(process.cwd(), 'tests', 'fixtures', 'persona-test');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load persona from file', async () => {
    const soulFile = join(testDir, 'SOUL.md');
    await writeFile(soulFile, '你是一位测试大师，精通测试之道。');

    const result = await loadPersonaFromFile(soulFile);

    expect(result).toContain('测试大师');
  });

  it('should throw for non-existent file', async () => {
    await expect(loadPersonaFromFile('/nonexistent/path/SOUL.md')).rejects.toThrow();
  });

  it('should trim whitespace from file content', async () => {
    const soulFile = join(testDir, 'SOUL.md');
    await writeFile(soulFile, '  \n  测试内容  \n  ');

    const result = await loadPersonaFromFile(soulFile);

    expect(result).toBe('测试内容');
  });
});

describe('buildPersona with file loading', () => {
  const testDir = join(process.cwd(), 'tests', 'fixtures', 'persona-file-test');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should load from file when path provided', async () => {
    const soulFile = join(testDir, 'SOUL.md');
    await writeFile(soulFile, '你是一位自定义人设。');

    const result = await buildPersona({ path: soulFile });

    expect(result).toContain('自定义人设');
  });

  it('should fallback to default if file not found', async () => {
    const result = await buildPersona({
      path: '/nonexistent/SOUL.md',
    });

    expect(result).toContain('命理师');
  });
});
