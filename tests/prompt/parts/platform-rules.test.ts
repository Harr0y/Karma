// Platform Rules Tests
import { describe, it, expect } from 'vitest';
import { buildPlatformRules } from '@/prompt/parts/platform-rules';

describe('buildPlatformRules', () => {
  it('should include CLI-specific rules', async () => {
    const result = await buildPlatformRules('cli');

    expect(result).toContain('CLI');
    expect(result).toContain('ANSI');
  });

  it('should include Feishu-specific rules', async () => {
    const result = await buildPlatformRules('feishu');

    expect(result).toContain('Feishu');
    expect(result).toContain('markdown');
  });

  it('should include HTTP-specific rules', async () => {
    const result = await buildPlatformRules('http');

    expect(result).toContain('HTTP');
    expect(result).toContain('SSE');
  });

  it('should include Discord-specific rules', async () => {
    const result = await buildPlatformRules('discord');

    expect(result).toContain('Discord');
    expect(result).toMatch(/2000|limit/i);
  });

  it('should include Telegram-specific rules', async () => {
    const result = await buildPlatformRules('telegram');

    expect(result).toContain('Telegram');
    expect(result).toMatch(/4096|limit/i);
  });

  it('should return empty string for unknown platform', async () => {
    const result = await buildPlatformRules('unknown' as any);

    expect(result).toBe('');
  });

  it('should return empty string for deprecated wechat platform', async () => {
    const result = await buildPlatformRules('wechat' as any);

    expect(result).toBe('');
  });

  it('should mention message limits for Feishu', async () => {
    const result = await buildPlatformRules('feishu');

    // Feishu 提醒消息长度
    expect(result).toMatch(/long|short|split|length/i);
  });

  it('should mention mobile/desktop for Feishu', async () => {
    const result = await buildPlatformRules('feishu');

    expect(result).toMatch(/mobile|desktop/i);
  });
});
