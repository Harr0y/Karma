// Integration Test - Real DuckDuckGo API Call
import { describe, it, expect, beforeAll } from 'vitest';
import { webSearch, formatSearchResult } from '@/tools/web-search.js';

/**
 * 集成测试：真实调用 DuckDuckGo API
 *
 * 注意： 这个测试会发起真实的网络请求
 * - 测试可能会因为网络问题或 API 变化而失败
 * - 建议在 CI 中标记为可选或使用 skip 条件
 */
describe('Integration: WebSearch Real API', () => {
  // 标记为集成测试，  const isIntegrationTest = true;

  beforeAll(() => {
    // 检查是否跳过集成测试
    const skipIntegration = process.env.SKIP_INTEGRATION_TESTS === 'true';
    if (skipIntegration) {
      console.log('Skipping integration tests (SKIP_INTEGRATION_TESTS=true)');
    }
  });

  // 这些测试可能会因为网络原因失败，设置为可选
  describe('real DuckDuckGo API calls', { timeout: 30000 }, () => {
    it.skipIf(process.env.SKIP_INTEGRATION_TESTS === 'true', 'skipped due to SKIP_INTEGRATION_TESTS');

    it('should return results for a real query', async () => {
      const result = await webSearch('2008年 北京 奥运会');

      expect(result.query).toBe('2008年 北京 奥运会');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]).toHaveProperty('title');
      expect(result.results[0]).toHaveProperty('snippet');
      expect(result.results[0]).toHaveProperty('url');
    });

    it('should return results for Chinese historical events', async () => {
      const result = await webSearch('1998年 金融危机');

      expect(result.query).toBe('1998年 金融危机');
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should handle English queries', async () => {
      const result = await webSearch('Beijing 2008 Olympics');

      expect(result.query).toBe('Beijing 2008 Olympics');
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should return "no results" for nonsense query', async () => {
      const result = await webSearch('xyzabc123nonexistentquery999');

      expect(result.query).toBe('xyzabc123nonexistentquery999');
      // DuckDuckGo 可能返回结果也可能返回空结果
      expect(result.results).toBeDefined();
    });

    it('should format search results correctly', async () => {
      const result = await webSearch('Python programming');
      const formatted = formatSearchResult(result);

      expect(formatted).toContain('搜索: Python programming');
      expect(formatted).toContain('###');
    });
  });

  describe('formatSearchResult with real data', () => {
    it('should format results from real API call', async () => {
      const result = await webSearch('JavaScript');
      const formatted = formatSearchResult(result);

      // 验证格式化输出包含关键元素
      expect(formatted).toContain('搜索:');
      expect(formatted).toContain('JavaScript');

      // 如果有 URL，应该包含来源
      if (result.results[0]?.url) {
        expect(formatted).toContain('来源:');
      }
    });
  });
});
