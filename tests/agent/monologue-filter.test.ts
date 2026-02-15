// MonologueFilter Tests
import { describe, it, expect, beforeEach } from 'vitest';
import { MonologueFilter } from '@/agent/monologue-filter';

describe('MonologueFilter', () => {
  let filter: MonologueFilter;

  beforeEach(() => {
    filter = new MonologueFilter();
  });

  describe('process', () => {
    it('should pass through normal text', () => {
      expect(filter.process('Hello')).toBe('Hello');
    });

    it('should filter inner_monologue tags', () => {
      const input = '<inner_monologue>thinking...</inner_monologue>Hello';
      expect(filter.process(input)).toBe('Hello');
    });

    it('should filter inner_monologue without trailing content', () => {
      const input = '<inner_monologue>thinking...</inner_monologue>';
      expect(filter.process(input)).toBe('');
    });

    it('should handle partial tags across chunks', () => {
      filter.process('<inner_monologue>thin');
      const result = filter.process('king...</inner_monologue>Hello');
      expect(result).toBe('Hello');
    });

    it('should handle multiple monologues', () => {
      const input = '<inner_monologue>a</inner_monologue>text<inner_monologue>b</inner_monologue>';
      expect(filter.process(input)).toBe('text');
    });

    it('should preserve text before monologue', () => {
      const input = 'before<inner_monologue>hidden</inner_monologue>after';
      expect(filter.process(input)).toBe('beforeafter');
    });

    it('should handle empty monologue', () => {
      const input = '<inner_monologue></inner_monologue>text';
      expect(filter.process(input)).toBe('text');
    });

    it('should handle multiline content in monologue', () => {
      const input = '<inner_monologue>\nline1\nline2\n</inner_monologue>after';
      expect(filter.process(input)).toBe('after');
    });

    it('should handle nested tags gracefully', () => {
      const input = '<inner_monologue><tag>nested</tag></inner_monologue>after';
      expect(filter.process(input)).toBe('after');
    });

    it('should handle monologue at start', () => {
      const input = '<inner_monologue>start</inner_monologue>text';
      expect(filter.process(input)).toBe('text');
    });

    it('should handle monologue at end', () => {
      const input = 'text<inner_monologue>end</inner_monologue>';
      expect(filter.process(input)).toBe('text');
    });

    it('should handle multiple chunks without monologue', () => {
      // 每次调用 process 都会立即返回可安全输出的内容
      const r1 = filter.process('part1');
      const r2 = filter.process('part2');
      const r3 = filter.process('part3');
      expect(r1 + r2 + r3).toBe('part1part2part3');
    });

    it('should handle incomplete start tag', () => {
      const r1 = filter.process('text<inner_monologue');
      const r2 = filter.process('>hidden</inner_monologue>after');
      expect(r1 + r2).toBe('textafter');
    });

    it('should handle incomplete end tag', () => {
      filter.process('<inner_monologue>text</inner_monologue');
      expect(filter.process('>after')).toBe('after');
    });
  });

  describe('flush', () => {
    it('should return empty string if buffer is empty', () => {
      expect(filter.flush()).toBe('');
    });

    it('should flush remaining content outside monologue', () => {
      filter.process('text');
      // process 已经输出了 text，flush 只返回缓冲区中未处理的内容
      // 由于没有标签，内容已经全部输出
      expect(filter.flush()).toBe('');
    });

    it('should clean and flush content inside monologue', () => {
      filter.process('<inner_monologue>incomplete');
      // 被截断时，输出内容（用户看不到 <inner_monologue> 标签）
      expect(filter.flush()).toBe('incomplete');
    });

    it('should clear buffer after flush', () => {
      filter.process('text');
      filter.flush();
      expect(filter.flush()).toBe('');
    });
  });

  describe('hadOutput', () => {
    it('should be false initially', () => {
      expect(filter.hadOutput).toBe(false);
    });

    it('should be true after output', () => {
      filter.process('text');
      expect(filter.hadOutput).toBe(true);
    });

    it('should be false if only monologue', () => {
      filter.process('<inner_monologue>hidden</inner_monologue>');
      expect(filter.hadOutput).toBe(false);
    });

    it('should be true after flush with content', () => {
      filter.process('text');
      filter.flush();
      expect(filter.hadOutput).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      filter.process('<inner_monologue>text');
      filter.reset();
      expect(filter.hadOutput).toBe(false);
      expect(filter.flush()).toBe('');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical agent response', () => {
      const chunks = [
        '<inner_monologue>\n用户说',
        '了姓名，记录下来...\n</inner_monologue>\n\n',
        '好的，张三',
        '，我已经记下了。',
      ];

      let output = '';
      for (const chunk of chunks) {
        output += filter.process(chunk);
      }
      output += filter.flush();

      expect(output).toBe('\n\n好的，张三，我已经记下了。');
      expect(output).not.toContain('inner_monologue');
      expect(output).not.toContain('用户说了姓名');
    });

    it('should handle streaming with multiple monologues', () => {
      const chunks = [
        '<inner_monologue>分析中...',
        '</inner_monologue>你的八字',
        '<inner_monologue>继续分析...',
        '</inner_monologue>很有特点。',
      ];

      let output = '';
      for (const chunk of chunks) {
        output += filter.process(chunk);
      }
      output += filter.flush();

      expect(output).toBe('你的八字很有特点。');
    });

    it('should handle interrupted monologue', () => {
      filter.process('<inner_monologue>正在思考');
      // 流被中断，没有结束标签
      const output = filter.flush();
      expect(output).toBe('正在思考');
    });
  });
});
