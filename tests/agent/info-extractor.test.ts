// 客户信息提取测试
// 测试目标：从 Agent 输出中提取结构化客户信息

import { describe, it, expect } from 'vitest';
import {
  extractClientInfo,
  extractFact,
  extractPrediction,
  type ExtractedClientInfo,
} from '@/agent/info-extractor.js';

describe('Info Extractor', () => {
  describe('extractClientInfo', () => {
    it('should extract client info from structured output', () => {
      // Given: Agent 输出包含客户信息标签
      const text = `
你好，请坐。

<client_info>
姓名：张三
性别：男
生辰：1990年5月15日早上6点
出生地：北京
</client_info>

让我给你排一下八字。
`;

      // When: 提取信息
      const info = extractClientInfo(text);

      // Then: 正确提取
      expect(info).not.toBeNull();
      expect(info!.name).toBe('张三');
      expect(info!.gender).toBe('male');
      expect(info!.birthDate).toBe('1990年5月15日早上6点');
      expect(info!.birthPlace).toBe('北京');
    });

    it('should extract female gender', () => {
      const text = `
<client_info>
姓名：李四
性别：女
生辰：1985年3月20日
</client_info>
`;
      const info = extractClientInfo(text);
      expect(info!.gender).toBe('female');
    });

    it('should handle partial info', () => {
      const text = `
<client_info>
姓名：王五
性别：男
</client_info>
`;
      const info = extractClientInfo(text);
      expect(info!.name).toBe('王五');
      expect(info!.gender).toBe('male');
      expect(info!.birthDate).toBeUndefined();
      expect(info!.birthPlace).toBeUndefined();
    });

    it('should return null if no client_info tag', () => {
      const text = '你好，请告诉我你的生辰八字。';
      const info = extractClientInfo(text);
      expect(info).toBeNull();
    });

    it('should return null if tag is empty', () => {
      const text = '<client_info></client_info>';
      const info = extractClientInfo(text);
      expect(info).toBeNull();
    });

    it('should handle colons in different formats', () => {
      // 中文冒号和英文冒号都支持
      const text1 = '<client_info>姓名: 张三</client_info>';
      const text2 = '<client_info>姓名：李四</client_info>';

      expect(extractClientInfo(text1)!.name).toBe('张三');
      expect(extractClientInfo(text2)!.name).toBe('李四');
    });

    it('should extract current city', () => {
      const text = `
<client_info>
姓名：赵六
现居：上海
</client_info>
`;
      const info = extractClientInfo(text);
      expect(info!.currentCity).toBe('上海');
    });
  });

  describe('extractFact', () => {
    it('should extract confirmed fact with category', () => {
      const text = `
你之前提到过工作的事。

<confirmed_fact category="career">目前在互联网公司工作，做产品经理</confirmed_fact>

这个和你的八字是吻合的。
`;

      const fact = extractFact(text);
      expect(fact).not.toBeNull();
      expect(fact!.fact).toBe('目前在互联网公司工作，做产品经理');
      expect(fact!.category).toBe('career');
    });

    it('should extract confirmed fact without category', () => {
      const text = '<confirmed_fact>已婚，有一个孩子</confirmed_fact>';

      const fact = extractFact(text);
      expect(fact!.fact).toBe('已婚，有一个孩子');
      expect(fact!.category).toBeUndefined();
    });

    it('should return null if no confirmed_fact tag', () => {
      const text = '你说的对，我确实是在互联网行业。';
      const fact = extractFact(text);
      expect(fact).toBeNull();
    });

    it('should handle multiple facts (returns first)', () => {
      const text = `
<confirmed_fact category="health">身体还不错</confirmed_fact>
<confirmed_fact category="wealth">收入稳定</confirmed_fact>
`;
      const fact = extractFact(text);
      expect(fact!.fact).toBe('身体还不错');
    });
  });

  describe('extractPrediction', () => {
    it('should extract prediction with year', () => {
      const text = `
根据你的大运流年，我看到：

<prediction year="2025">下半年有晋升机会，特别是在9月到11月之间</prediction>

这个机会你要抓住。
`;

      const pred = extractPrediction(text);
      expect(pred).not.toBeNull();
      expect(pred!.prediction).toBe('下半年有晋升机会，特别是在9月到11月之间');
      expect(pred!.year).toBe(2025);
    });

    it('should extract prediction without year', () => {
      const text = '<prediction>未来三年财运会逐渐好转</prediction>';

      const pred = extractPrediction(text);
      expect(pred!.prediction).toBe('未来三年财运会逐渐好转');
      expect(pred!.year).toBeUndefined();
    });

    it('should return null if no prediction tag', () => {
      const text = '明年你的事业会有起色。';
      const pred = extractPrediction(text);
      expect(pred).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('should extract all types from complex output', () => {
      const text = `
好的，让我看看你的八字。

<client_info>
姓名：测试用户
性别：女
生辰：1992年8月8日中午12点
出生地：广州
</client_info>

你之前说的情况我都记下了。

<confirmed_fact category="relationship">目前单身，一直在相亲</confirmed_fact>

关于你的感情，我看到：

<prediction year="2025">今年下半年会遇到合适的人</prediction>
`;

      const info = extractClientInfo(text);
      const fact = extractFact(text);
      const pred = extractPrediction(text);

      expect(info!.name).toBe('测试用户');
      expect(info!.gender).toBe('female');
      expect(fact!.category).toBe('relationship');
      expect(pred!.year).toBe(2025);
    });
  });
});
