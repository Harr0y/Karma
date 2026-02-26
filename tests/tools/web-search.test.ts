// WebSearch Tool Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webSearch, formatSearchResult, type SearchResult, type WebSearchResult } from '@/tools/web-search.js';

describe('webSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('webSearch function', () => {
    it('should call DuckDuckGo API with correct URL', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Abstract: 'Test abstract',
          Heading: 'Test heading',
          AbstractURL: 'https://example.com',
          RelatedTopics: [],
        }),
      } as Response);

      await webSearch('test query');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.duckduckgo.com/?q=test%20query&format=json&no_html=1&skip_disambig=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        })
      );
    });

    it('should return abstract as first result', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Abstract: 'This is the abstract',
          Heading: 'Test Heading',
          AbstractURL: 'https://example.com/abstract',
          RelatedTopics: [],
        }),
      } as Response);

      const result = await webSearch('test');

      expect(result.query).toBe('test');
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        title: 'Test Heading',
        snippet: 'This is the abstract',
        url: 'https://example.com/abstract',
      });
    });

    it('should include related topics in results', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Abstract: '',
          RelatedTopics: [
            { Text: 'Topic 1 - Description', FirstURL: 'https://example.com/1' },
            { Text: 'Topic 2 - Description', FirstURL: 'https://example.com/2' },
          ],
        }),
      } as Response);

      const result = await webSearch('test');

      expect(result.results.length).toBeGreaterThanOrEqual(2);
      expect(result.results.some(r => r.title === 'Topic 1')).toBe(true);
    });

    it('should limit results to 5', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Abstract: 'Abstract',
          RelatedTopics: Array(10).fill(null).map((_, i) => ({
            Text: `Topic ${i} - Description`,
            FirstURL: `https://example.com/${i}`,
          })),
        }),
      } as Response);

      const result = await webSearch('test');

      expect(result.results.length).toBeLessThanOrEqual(5);
    });

    it('should return "no results" message when nothing found', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Abstract: '',
          RelatedTopics: [],
        }),
      } as Response);

      const result = await webSearch('nonexistent query xyz123');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('未找到结果');
      expect(result.results[0].snippet).toContain('nonexistent query xyz123');
    });

    it('should handle API errors gracefully', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const result = await webSearch('test');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('搜索出错');
    });

    it('should handle network errors', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await webSearch('test');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('搜索出错');
      expect(result.results[0].snippet).toContain('Network error');
    });

    it('should handle Chinese queries correctly', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Abstract: '',
          RelatedTopics: [],
        }),
      } as Response);

      await webSearch('2008年 北京 重大事件');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('2008%E5%B9%B4%20%E5%8C%97%E4%BA%AC'),
        expect.any(Object)
      );
    });

    it('should skip related topics without Text or FirstURL', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Abstract: '',
          RelatedTopics: [
            { Text: 'Valid Topic', FirstURL: 'https://example.com/valid' },
            { Text: 'Missing URL' }, // No FirstURL
            { FirstURL: 'https://example.com/notext' }, // No Text
            { Other: 'data' }, // Neither
          ],
        }),
      } as Response);

      const result = await webSearch('test');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Valid Topic');
    });
  });

  describe('formatSearchResult function', () => {
    it('should format search results correctly', () => {
      const result: WebSearchResult = {
        query: 'test query',
        results: [
          { title: 'Result 1', snippet: 'Snippet 1', url: 'https://example.com/1' },
          { title: 'Result 2', snippet: 'Snippet 2', url: 'https://example.com/2' },
        ],
      };

      const formatted = formatSearchResult(result);

      expect(formatted).toContain('搜索: test query');
      expect(formatted).toContain('### 1. Result 1');
      expect(formatted).toContain('Snippet 1');
      expect(formatted).toContain('来源: https://example.com/1');
      expect(formatted).toContain('### 2. Result 2');
    });

    it('should handle empty results', () => {
      const result: WebSearchResult = {
        query: 'empty query',
        results: [],
      };

      const formatted = formatSearchResult(result);

      expect(formatted).toContain('搜索: empty query');
      expect(formatted).toContain('未找到相关结果');
    });

    it('should handle results without URL', () => {
      const result: WebSearchResult = {
        query: 'test',
        results: [
          { title: 'No URL', snippet: 'No URL snippet', url: '' },
        ],
      };

      const formatted = formatSearchResult(result);

      expect(formatted).toContain('No URL');
      expect(formatted).not.toContain('来源:');
    });

    it('should handle special characters in results', () => {
      const result: WebSearchResult = {
        query: 'test <script>',
        results: [
          { title: 'Title with <tags>', snippet: 'Snippet & "quotes"', url: 'https://example.com?a=1&b=2' },
        ],
      };

      const formatted = formatSearchResult(result);

      expect(formatted).toContain('test <script>');
      expect(formatted).toContain('Title with <tags>');
      expect(formatted).toContain('Snippet & "quotes"');
    });
  });
});
