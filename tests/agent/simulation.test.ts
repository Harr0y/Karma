// Agent Simulation Tests - 模拟完整对话流程
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MonologueFilter } from '@/agent/monologue-filter.js';
import {
  extractClientInfo,
  extractAllFacts,
  extractAllPredictions,
} from '@/agent/info-extractor.js';

/**
 * 模拟 Agent 在不同场景下的输出
 * 测试数据提取和过滤是否正常工作
 */
describe('Agent Simulation Tests', () => {
  let filter: MonologueFilter;

  beforeEach(() => {
    filter = new MonologueFilter({ keepInnerMonologue: true });
  });

  afterEach(() => {
    filter.reset();
  });

  describe('场景 1: 新用户首次对话', () => {
    it('should handle initial user info collection', () => {
      // 模拟 Agent 第一轮输出
      const agentOutput = `<inner_monologue>
用户刚来，需要先收集基本信息。问一下生辰。
</inner_monologue>

你好，我是个算命的。你把生辰告诉我，我给你排个盘看看。`;

      // keepInnerMonologue: true 模式下，内容保留但标签移除
      const filtered = filter.process(agentOutput);
      expect(filtered).toContain('你好，我是个算命的。');
      expect(filtered).toContain('用户刚来'); // 内容保留
      expect(filtered).not.toContain('<inner_monologue>'); // 标签移除
    });

    it('should extract info when user provides it', () => {
      // 模拟用户回复后的 Agent 输出
      const agentOutput = `<inner_monologue>
用户给了生辰信息：1998年5月15日下午2点半，长沙人，男的，叫小明。
1998年，今年26岁，刚工作几年。
排一下八字。
</inner_monologue>

<client_info>
姓名：小明
性别：男
生辰：1998年5月15日下午2点半
出生地：长沙
</client_info>

好，长沙生的，男命，未时。等我排一下。`;

      // 提取客户信息
      const clientInfo = extractClientInfo(agentOutput);
      expect(clientInfo).not.toBeNull();
      expect(clientInfo!.name).toBe('小明');
      expect(clientInfo!.gender).toBe('male');
      expect(clientInfo!.birthDate).toBe('1998年5月15日下午2点半');
      expect(clientInfo!.birthPlace).toBe('长沙');

      // 过滤后给用户看
      const filtered = filter.process(agentOutput);
      expect(filtered).toContain('好，长沙生的');
      expect(filtered).not.toContain('<client_info>');
    });
  });

  describe('场景 2: 断言与确认', () => {
    it('should handle Barnum statements and user confirmation', () => {
      // Agent 做出断言
      const agentAssertions = `<inner_monologue>
26岁，2020年大学毕业，2020-2021年开始工作。
2022年是个关键年份，那年应该有变动。
先抛几个断言看看。
</inner_monologue>

我看了你的盘，说几个你先给我反馈一下：

1. 2022年你工作上是不是有变动？
2. 2023年感情上是不是有点问题？
3. 你这个人，看着外向，其实心里挺多事不跟人说的。`;

      // keepInnerMonologue: true 模式
      const filtered = filter.process(agentAssertions);
      expect(filtered).toContain('1. 2022年你工作上是不是有变动？');
      expect(filtered).toContain('先抛几个断言'); // 内容保留
      expect(filtered).not.toContain('<inner_monologue>'); // 标签移除
    });

    it('should record confirmed facts after user confirms', () => {
      // 用户确认后的 Agent 输出
      const agentConfirmOutput = `<inner_monologue>
用户确认了22年换工作，记下来。
感情问题否认了，没关系，换个角度。
</inner_monologue>

<confirmed_fact category="career">2022年换了工作</confirmed_fact>

对，22年确实是个转折点。那年你从A公司跳到B公司了吧？

感情那个我说错了，不过你这几年确实不太顺心，对吧？`;

      const facts = extractAllFacts(agentConfirmOutput);
      expect(facts).toHaveLength(1);
      expect(facts[0].category).toBe('career');
      expect(facts[0].fact).toBe('2022年换了工作');

      const filtered = filter.process(agentConfirmOutput);
      expect(filtered).toContain('对，22年确实是个转折点');
      expect(filtered).not.toContain('<confirmed_fact>');
    });
  });

  describe('场景 3: 预测输出', () => {
    it('should extract predictions during reading', () => {
      const agentOutput = `<inner_monologue>
现在开始做预测。
2025年流年有财星，应该不错。
2026年事业有贵人。
</inner_monologue>

看你接下来的运势：

<prediction year="2025">下半年财运不错，可能有意外收入</prediction>

<prediction year="2025">注意一下健康，尤其是肠胃</prediction>

<prediction year="2026">事业上有贵人相助</prediction>

这是大体趋势，你想详细了解哪方面？`;

      const predictions = extractAllPredictions(agentOutput);
      expect(predictions).toHaveLength(3);

      const year2025 = predictions.filter(p => p.year === 2025);
      expect(year2025).toHaveLength(2);
      expect(year2025[0].prediction).toContain('财运');
      expect(year2025[1].prediction).toContain('健康');

      const year2026 = predictions.filter(p => p.year === 2026);
      expect(year2026).toHaveLength(1);
      expect(year2026[0].prediction).toContain('贵人');

      const filtered = filter.process(agentOutput);
      expect(filtered).toContain('看你接下来的运势');
      expect(filtered).not.toContain('<prediction>');
    });
  });

  describe('场景 4: 完整对话流程模拟', () => {
    it('should handle multi-turn conversation with data accumulation', () => {
      // 模拟三轮对话
      const turns = [
        // 第一轮：收集信息
        {
          input: '我叫张三，1990年5月15日早上6点出生，长沙人',
          output: `<inner_monologue>
用户信息：张三，男（名字推断），1990/5/15 6:00，长沙
今年34岁，职业瓶颈期。
</inner_monologue>

<client_info>
姓名：张三
生辰：1990年5月15日早上6点
出生地：长沙
</client_info>

好，张三，长沙生的，早上6点，卯时。我给你排个盘。`,
        },
        // 第二轮：断言确认
        {
          input: '好的，你说吧',
          output: `<inner_monologue>
开始断言。34岁，2012年大学毕业，2012-2014第一份工作。
2018年左右可能有感情变化。
</inner_monologue>

我看了你的盘，几个事你给我反馈一下：

1. 你现在工作是不是有点瓶颈，想换但还没找到合适的机会？
2. 2018年左右，感情上是不是有什么事？
3. 你这个人，表面看着挺稳，其实心里压力挺大？`,
        },
        // 第三轮：确认事实，做出预测
        {
          input: '1和3对，2不对，2018年没啥事',
          output: `<inner_monologue>
1和3对了，2错了。记下来确认的事实。
换工作确实是瓶颈期，这个对上了。
</inner_monologue>

<confirmed_fact category="career">工作遇到瓶颈，想换但没找到合适机会</confirmed_fact>

<confirmed_fact category="personality">表面看着稳，内心压力大</confirmed_fact>

<prediction year="2025">下半年有跳槽机会</prediction>

<prediction year="2025">注意情绪管理</prediction>

对，1和3我看对了。2018年那个我说错了。

你现在这个瓶颈期，我看下半年应该有机会。到时候有合适的就抓住。`,
        },
      ];

      // 模拟处理每轮对话
      const allClientInfo: ReturnType<typeof extractClientInfo>[] = [];
      const allFacts: ReturnType<typeof extractAllFacts> = [];
      const allPredictions: ReturnType<typeof extractAllPredictions> = [];

      for (const turn of turns) {
        const clientInfo = extractClientInfo(turn.output);
        if (clientInfo) allClientInfo.push(clientInfo);

        const facts = extractAllFacts(turn.output);
        allFacts.push(...facts);

        const predictions = extractAllPredictions(turn.output);
        allPredictions.push(...predictions);
      }

      // 验证收集的数据
      expect(allClientInfo).toHaveLength(1);
      expect(allClientInfo[0]!.name).toBe('张三');

      expect(allFacts).toHaveLength(2);
      expect(allFacts.map(f => f.category)).toContain('career');
      expect(allFacts.map(f => f.category)).toContain('personality');

      expect(allPredictions).toHaveLength(2);
      expect(allPredictions.every(p => p.year === 2025)).toBe(true);
    });
  });

  describe('场景 5: 错误处理', () => {
    it('should handle user denial gracefully', () => {
      const agentOutput = `<inner_monologue>
用户否认了我的断言。需要换个角度重新解读。
不要直接认错，要重新包装。
</inner_monologue>

嗯，我说的是那个方面。可能我理解偏了。

你具体是哪方面不太对？给我说说，我再看看。`;

      // 没有确认的事实，所以不记录
      const facts = extractAllFacts(agentOutput);
      expect(facts).toHaveLength(0);

      // keepInnerMonologue: true 模式
      const filtered = filter.process(agentOutput);
      expect(filtered).toContain('嗯，我说的是那个方面');
      expect(filtered).toContain('用户否认了我的断言'); // 内容保留
      expect(filtered).not.toContain('<inner_monologue>'); // 标签移除
    });

    it('should handle partial tag in streaming', () => {
      // 模拟流式输出被截断
      const chunks = [
        '<inner_monologue>正在分析',
        '...</inner_monologue>',
        '<client_info>\n姓名：',
        '测试\n</client_info>',
      ];

      let rawContent = '';
      let filteredOutput = '';

      for (const chunk of chunks) {
        rawContent += chunk;
        filteredOutput += filter.process(chunk);
      }
      filteredOutput += filter.flush();

      // 仍然能提取到完整信息
      const clientInfo = extractClientInfo(rawContent);
      expect(clientInfo!.name).toBe('测试');
    });
  });

  describe('场景 6: 特殊字符和边界', () => {
    it('should handle special characters in content', () => {
      // 注意：正则表达式 [^<]* 会在遇到 < 时停止匹配
      // 所以包含 < 或 > 的内容可能会被截断
      // 这是当前实现的限制，Agent 应避免在标签内使用这些字符
      const agentOutput = `<confirmed_fact category="career">收入约 10k，期望 20k 以上</confirmed_fact>

<prediction year="2025">薪资涨幅 30%+</prediction>`;

      const facts = extractAllFacts(agentOutput);
      expect(facts).toHaveLength(1);
      expect(facts[0].fact).toContain('10k');
      expect(facts[0].fact).toContain('20k');

      const predictions = extractAllPredictions(agentOutput);
      expect(predictions).toHaveLength(1);
      expect(predictions[0].prediction).toContain('30%+');
    });

    it('should handle very long content', () => {
      const longFact = '这是一个很长的事实'.repeat(100);
      const agentOutput = `<confirmed_fact category="test">${longFact}</confirmed_fact>`;

      const facts = extractAllFacts(agentOutput);
      expect(facts).toHaveLength(1);
      expect(facts[0].fact.length).toBe(longFact.length);
    });
  });
});
