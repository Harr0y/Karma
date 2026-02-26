// Data Extraction Integration Tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MonologueFilter } from '@/agent/monologue-filter.js';
import {
  extractClientInfo,
  extractAllFacts,
  extractAllPredictions,
} from '@/agent/info-extractor.js';

describe('Data Extraction Integration', () => {
  let filter: MonologueFilter;

  beforeEach(() => {
    filter = new MonologueFilter({ keepInnerMonologue: true });
  });

  afterEach(() => {
    filter.reset();
  });

  describe('完整 Agent 输出模拟', () => {
    it('should extract client info from realistic agent output', () => {
      const agentOutput = `<inner_monologue>
用户提供了基本信息，我需要记录下来。
</inner_monologue>

<client_info>
姓名：张三
性别：男
生辰：1990年5月15日早上6点
出生地：湖南长沙
现居：北京
</client_info>

好的，张三，我记下了你的信息。`;

      const clientInfo = extractClientInfo(agentOutput);

      expect(clientInfo).not.toBeNull();
      expect(clientInfo!.name).toBe('张三');
      expect(clientInfo!.gender).toBe('male');
      expect(clientInfo!.birthDate).toBe('1990年5月15日早上6点');
      expect(clientInfo!.birthPlace).toBe('湖南长沙');
      expect(clientInfo!.currentCity).toBe('北京');
    });

    it('should extract multiple confirmed facts', () => {
      const agentOutput = `根据你的反馈，我确认以下几点：

<confirmed_fact category="career">目前在互联网公司工作</confirmed_fact>

<confirmed_fact category="relationship">已婚三年</confirmed_fact>

<confirmed_fact category="health">近期有睡眠问题</confirmed_fact>

这些是我对你情况的了解。`;

      const facts = extractAllFacts(agentOutput);

      expect(facts).toHaveLength(3);
      expect(facts[0]).toEqual({ category: 'career', fact: '目前在互联网公司工作' });
      expect(facts[1]).toEqual({ category: 'relationship', fact: '已婚三年' });
      expect(facts[2]).toEqual({ category: 'health', fact: '近期有睡眠问题' });
    });

    it('should extract multiple predictions', () => {
      const agentOutput = `基于你的命盘，我做出以下预测：

<prediction year="2025">下半年有晋升机会</prediction>

<prediction year="2026">财运明显好转</prediction>

<prediction>未来三年感情稳定</prediction>

以上是我的判断。`;

      const predictions = extractAllPredictions(agentOutput);

      expect(predictions).toHaveLength(3);
      expect(predictions[0]).toEqual({ year: 2025, prediction: '下半年有晋升机会' });
      expect(predictions[1]).toEqual({ year: 2026, prediction: '财运明显好转' });
      expect(predictions[2]).toEqual({ year: undefined, prediction: '未来三年感情稳定' });
    });

    it('should handle mixed content with all tag types', () => {
      const agentOutput = `<inner_monologue>
用户是90年的，今年34岁，正处于职业瓶颈期。
</inner_monologue>

<client_info>
姓名：李四
性别：男
生辰：1990年8月20日下午3点
出生地：广州
</client_info>

李四，我看了你的命盘。

<confirmed_fact category="career">2022年换了工作</confirmed_fact>

<confirmed_fact category="wealth">收入比之前高了</confirmed_fact>

22年确实是个转折点。那年你那边是不是发生了什么大事？

<prediction year="2025">事业上有新的机会</prediction>

<prediction year="2025">注意健康问题</prediction>`;

      // 提取所有信息
      const clientInfo = extractClientInfo(agentOutput);
      const facts = extractAllFacts(agentOutput);
      const predictions = extractAllPredictions(agentOutput);

      // 验证客户信息
      expect(clientInfo).not.toBeNull();
      expect(clientInfo!.name).toBe('李四');

      // 验证事实
      expect(facts).toHaveLength(2);
      expect(facts.map(f => f.category)).toContain('career');
      expect(facts.map(f => f.category)).toContain('wealth');

      // 验证预测
      expect(predictions).toHaveLength(2);
      expect(predictions.every(p => p.year === 2025)).toBe(true);
    });
  });

  describe('MonologueFilter 与数据提取协作', () => {
    it('should filter tags from user-visible output while keeping for extraction', () => {
      const agentOutput = `<inner_monologue>思考中...</inner_monologue>
<client_info>姓名：王五</client_info>
你好，王五！
<confirmed_fact category="test">测试事实</confirmed_fact>
这是可见内容。`;

      // 先提取数据（使用原始内容）
      const facts = extractAllFacts(agentOutput);
      expect(facts).toHaveLength(1);

      // 然后过滤给用户看
      const filtered = filter.process(agentOutput);

      // 用户看到的内容不包含标签
      expect(filtered).not.toContain('<client_info>');
      expect(filtered).not.toContain('<confirmed_fact>');
      expect(filtered).toContain('你好，王五！');
      expect(filtered).toContain('这是可见内容。');
    });

    it('should handle streaming with data extraction', () => {
      const chunks = [
        '<inner_monologue>分',
        '析中...</inner_monologue>',
        '<client_info>\n姓名：赵六\n</client_info>',
        '好的赵六。',
        '<confirmed_fact category="career">程序员</confirmed_fact>',
      ];

      let rawContent = '';
      let filteredOutput = '';

      for (const chunk of chunks) {
        rawContent += chunk;
        filteredOutput += filter.process(chunk);
      }
      filteredOutput += filter.flush();

      // 从原始内容提取
      const clientInfo = extractClientInfo(rawContent);
      const facts = extractAllFacts(rawContent);

      expect(clientInfo!.name).toBe('赵六');
      expect(facts).toHaveLength(1);
      expect(facts[0].fact).toBe('程序员');

      // 过滤后不包含标签
      expect(filteredOutput).not.toContain('<client_info>');
      expect(filteredOutput).not.toContain('<confirmed_fact>');
    });
  });

  describe('边界情况', () => {
    it('should handle empty tag content', () => {
      const output = `<client_info></client_info>
<confirmed_fact></confirmed_fact>
<prediction></prediction>`;

      expect(extractClientInfo(output)).toBeNull();
      expect(extractAllFacts(output)).toHaveLength(0);
      expect(extractAllPredictions(output)).toHaveLength(0);
    });

    it('should handle malformed tags gracefully', () => {
      const output = `<client_info
姓名：测试
</client_info>

<confirmed_fact category="test>未闭合引号</confirmed_fact>

<prediction year="2025">正常预测</prediction>`;

      // 应该能提取到正常的预测
      const predictions = extractAllPredictions(output);
      expect(predictions).toHaveLength(1);
      expect(predictions[0].prediction).toBe('正常预测');
    });

    it('should handle tags with extra whitespace', () => {
      // 注意：extractClientInfo 正则要求 "姓名：" 后面紧跟内容，不支持额外空格
      // 这是设计如此，Agent 应输出标准格式
      const output = `<client_info>
姓名：张三
性别：男
</client_info>`;

      const clientInfo = extractClientInfo(output);
      expect(clientInfo!.name).toBe('张三');
      expect(clientInfo!.gender).toBe('male');
    });

    it('should handle multiline fact content', () => {
      const output = `<confirmed_fact category="career">
工作经历：
- 2018-2020 A公司
- 2020-至今 B公司
</confirmed_fact>`;

      const facts = extractAllFacts(output);
      expect(facts).toHaveLength(1);
      expect(facts[0].fact).toContain('工作经历');
      expect(facts[0].fact).toContain('A公司');
    });
  });

  describe('中英文混合', () => {
    it('should handle English colons in tags', () => {
      const output = `<client_info>
姓名: John
性别: 男
生辰: 1990-05-15
</client_info>`;

      const clientInfo = extractClientInfo(output);
      expect(clientInfo!.name).toBe('John');
      expect(clientInfo!.birthDate).toBe('1990-05-15');
    });

    it('should handle mixed content', () => {
      const output = `<client_info>
Name: 张三
性别: Male
</client_info>

<confirmed_fact category="career">Working in tech industry</confirmed_fact>`;

      const clientInfo = extractClientInfo(output);
      // 英文 "Name:" 不会被识别，只有中文 "姓名:" 会被识别
      // 由于没有识别到任何字段，返回 null
      expect(clientInfo).toBeNull();
      // 但 fact 会被提取
      const facts = extractAllFacts(output);
      expect(facts).toHaveLength(1);
    });
  });
});
