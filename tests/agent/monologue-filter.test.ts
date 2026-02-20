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

  describe('client_info filtering', () => {
    it('should filter client_info tags', () => {
      const input =
        '<client_info>姓名：张三\n性别：男\n生辰：1990-05-15</client_info>好的，记下了';
      expect(filter.process(input)).toBe('好的，记下了');
    });

    it('should filter client_info in the middle of text', () => {
      const input = '开始<client_info>hidden</client_info>结束';
      expect(filter.process(input)).toBe('开始结束');
    });

    it('should handle multiple client_info tags', () => {
      const input = '<client_info>a</client_info>text<client_info>b</client_info>';
      expect(filter.process(input)).toBe('text');
    });
  });

  describe('confirmed_fact filtering', () => {
    it('should filter confirmed_fact tags', () => {
      const input =
        '<confirmed_fact category="career">工作压力大</confirmed_fact>确实如此';
      expect(filter.process(input)).toBe('确实如此');
    });

    it('should filter confirmed_fact without category', () => {
      const input = '<confirmed_fact>简单的确认</confirmed_fact>好的';
      expect(filter.process(input)).toBe('好的');
    });

    it('should handle confirmed_fact at start', () => {
      const input = '<confirmed_fact category="wealth">财运一般</confirmed_fact>我们来分析';
      expect(filter.process(input)).toBe('我们来分析');
    });
  });

  describe('prediction filtering', () => {
    it('should filter prediction tags', () => {
      const input = '<prediction year="2025">下半年有好运</prediction>其他内容';
      expect(filter.process(input)).toBe('其他内容');
    });

    it('should filter prediction without year', () => {
      const input = '开始<prediction>未来会更好</prediction>结束';
      expect(filter.process(input)).toBe('开始结束');
    });
  });

  describe('mixed tags', () => {
    it('should filter all tag types in one text', () => {
      const input =
        '<inner_monologue>思考</inner_monologue>' +
        '你好<client_info>姓名：李四</client_info>' +
        '<confirmed_fact category="career">程序员</confirmed_fact>' +
        '分析<prediction year="2026">升职</prediction>完成';
      expect(filter.process(input)).toBe('你好分析完成');
    });

    it('should handle streaming with mixed tags', () => {
      const chunks = [
        '<inner_monologue>分析',
        '中...</inner_monologue>',
        '<client_info>姓名：张三</client_info>',
        '好的',
        '<confirmed_fact category="career">IT行业</confirmed_fact>',
        '，来看财运',
      ];

      let output = '';
      for (const chunk of chunks) {
        output += filter.process(chunk);
      }
      output += filter.flush();

      expect(output).toBe('好的，来看财运');
    });

    it('should filter real-world karma response', () => {
      // 模拟真实的 Karma 回复
      const input = `<inner_monologue>
用户提供了生辰信息，我需要排盘分析。
</inner_monologue>

<client_info>
姓名：未知
性别：男
生辰：1998年5月15日未时
出生地：长沙
</client_info>

行，长沙生的，男命，未时。等我排一下。

<confirmed_fact category="career">2020-2021年开始工作变难</confirmed_fact>

嗯，我说对了就行。你事业上有个好消息。`;

      const output = filter.process(input);

      // 验证所有内部标签都被过滤
      expect(output).not.toContain('inner_monologue');
      expect(output).not.toContain('client_info');
      expect(output).not.toContain('confirmed_fact');

      // 验证用户可见的内容保留
      expect(output).toContain('行，长沙生的，男命，未时。等我排一下。');
      expect(output).toContain('嗯，我说对了就行。你事业上有个好消息。');

      // 验证内部思考内容被过滤
      expect(output).not.toContain('用户提供了生辰信息');
      expect(output).not.toContain('姓名：未知');
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

    it('should clean and flush content inside client_info', () => {
      filter.process('<client_info>姓名：测试');
      expect(filter.flush()).toBe('姓名：测试');
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

    it('should be false if only client_info', () => {
      filter.process('<client_info>hidden</client_info>');
      expect(filter.hadOutput).toBe(false);
    });

    it('should be false if only confirmed_fact', () => {
      filter.process('<confirmed_fact>hidden</confirmed_fact>');
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

    it('should not expose any internal tags in output', () => {
      const input =
        '<inner_monologue>思考</inner_monologue>' +
        '可见文本1' +
        '<client_info>信息</client_info>' +
        '可见文本2' +
        '<confirmed_fact category="test">事实</confirmed_fact>' +
        '可见文本3' +
        '<prediction year="2025">预测</prediction>';

      const output = filter.process(input);

      expect(output).not.toContain('inner_monologue');
      expect(output).not.toContain('client_info');
      expect(output).not.toContain('confirmed_fact');
      expect(output).not.toContain('prediction');
      expect(output).toBe('可见文本1可见文本2可见文本3');
    });
  });
});
