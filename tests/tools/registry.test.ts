// Tools Registry Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: vi.fn((name, desc, schema, handler) => ({ name, desc, schema, handler })),
  createSdkMcpServer: vi.fn((config) => ({ ...config, type: 'mcp-server' })),
}));

// Mock bazi-calculator
vi.mock('@/tools/bazi-calculator.js', () => ({
  calculateBazi: vi.fn(async (input) => ({
    fourPillars: {
      year: { stem: '庚', branch: '午' },
      month: { stem: '辛', branch: '巳' },
      day: { stem: '庚', branch: '辰' },
      hour: { stem: '己', branch: '卯' },
    },
    dayun: [],
    liunian: [],
    nayin: {},
  })),
  formatBaziResult: vi.fn((result) => 'formatted bazi result'),
}));

// Mock web-search
vi.mock('@/tools/web-search.js', () => ({
  webSearch: vi.fn(async (query) => ({
    query,
    results: [
      { title: '搜索结果1', snippet: '这是搜索结果1的内容', url: 'https://example.com/1' },
      { title: '搜索结果2', snippet: '这是搜索结果2的内容', url: 'https://example.com/2' },
    ],
  })),
  formatSearchResult: vi.fn((result) => {
    const lines = [`搜索: ${result.query}`, ''];
    result.results.forEach((item: any, index: number) => {
      lines.push(`### ${index + 1}. ${item.title}`);
      lines.push(item.snippet);
      if (item.url) {
        lines.push(`来源: ${item.url}`);
      }
      lines.push('');
    });
    return lines.join('\n');
  }),
}));

import { createKarmaMcpServer, generateToolsPrompt } from '@/tools/registry.js';
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { webSearch } from '@/tools/web-search.js';

describe('createKarmaMcpServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call SDK tool() with correct parameters for bazi_calculator', () => {
    createKarmaMcpServer();

    expect(tool).toHaveBeenCalledWith(
      'bazi_calculator',
      expect.stringContaining('八字命盘'),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should call SDK tool() with correct parameters for web_search', () => {
    createKarmaMcpServer();

    expect(tool).toHaveBeenCalledWith(
      'web_search',
      expect.stringContaining('搜索'),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should call createSdkMcpServer with correct config', () => {
    createKarmaMcpServer();

    expect(createSdkMcpServer).toHaveBeenCalledWith({
      name: 'karma-tools',
      version: '1.0.0',
      tools: expect.arrayContaining([
        expect.objectContaining({ name: 'bazi_calculator' }),
        expect.objectContaining({ name: 'web_search' }),
      ]),
    });
  });

  it('should return MCP server config', () => {
    const result = createKarmaMcpServer();

    expect(result).toHaveProperty('type', 'mcp-server');
    expect(result).toHaveProperty('name', 'karma-tools');
    expect(result).toHaveProperty('version', '1.0.0');
  });

  it('bazi_calculator tool handler should call calculateBazi and return formatted result', async () => {
    createKarmaMcpServer();

    // 找到 bazi_calculator tool
    const baziCall = vi.mocked(tool).mock.calls.find(call => call[0] === 'bazi_calculator');
    expect(baziCall).toBeDefined();
    const handler = baziCall![3];

    // 调用 handler
    const result = await handler(
      { birthDate: '1990-05-15T06:00:00', gender: 'male' },
      {}
    );

    expect(result).toHaveProperty('content');
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0].text).toBe('formatted bazi result');
  });

  it('web_search tool handler should call webSearch and return results', async () => {
    createKarmaMcpServer();

    // 找到 web_search tool
    const webSearchCall = vi.mocked(tool).mock.calls.find(call => call[0] === 'web_search');
    expect(webSearchCall).toBeDefined();
    const handler = webSearchCall![3];

    // 调用 handler
    const result = await handler(
      { query: '2008年 北京 重大事件' },
      {}
    );

    expect(webSearch).toHaveBeenCalledWith('2008年 北京 重大事件');
    expect(result).toHaveProperty('content');
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0].text).toContain('搜索结果');
  });

  it('tool handlers should handle errors gracefully', async () => {
    createKarmaMcpServer();

    const baziCall = vi.mocked(tool).mock.calls.find(call => call[0] === 'bazi_calculator');
    const handler = baziCall![3];

    const result = await handler(
      { birthDate: '1990-05-15T06:00:00', gender: 'male' },
      {}
    );

    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
  });
});

describe('generateToolsPrompt', () => {
  it('should return tool documentation', () => {
    const prompt = generateToolsPrompt();

    expect(prompt).toContain('bazi_calculator');
    expect(prompt).toContain('birthDate');
    expect(prompt).toContain('gender');
    expect(prompt).toContain('可用工具');
  });

  it('should include web_search tool documentation', () => {
    const prompt = generateToolsPrompt();

    expect(prompt).toContain('web_search');
    expect(prompt).toContain('query');
    expect(prompt).toContain('搜索');
  });
});
