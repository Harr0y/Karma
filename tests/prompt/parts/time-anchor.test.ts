// Time Anchor Tests
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

  it('should contain system prompt marker', () => {
    const now = new Date();
    const result = buildTimeAnchor(now);

    expect(result).toContain('【系统时间锚点】');
  });

  it('should mention calculating age based on this', () => {
    const now = new Date();
    const result = buildTimeAnchor(now);

    expect(result).toContain('年龄');
    expect(result).toContain('流年');
  });
});
