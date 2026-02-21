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

  it('should include WeChat-specific rules', async () => {
    const result = await buildPlatformRules('wechat');

    expect(result).toContain('WeChat');
    expect(result).toContain('消息长度');
  });

  it('should return empty string for unknown platform', async () => {
    const result = await buildPlatformRules('unknown' as any);

    expect(result).toBe('');
  });

  it('should mention message limits for Feishu', async () => {
    const result = await buildPlatformRules('feishu');

    // Feishu 提醒消息长度
    expect(result).toMatch(/长|短|分段|分条/i);
  });

  it('should mention mobile/desktop for Feishu', async () => {
    const result = await buildPlatformRules('feishu');

    expect(result).toMatch(/手机|桌面|mobile|desktop/i);
  });
});
