// Web Search Tool - 使用 Exa AI 进行语义搜索

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * WebSearch 结果项
 */
export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * WebSearch 返回结果
 */
export interface WebSearchResult {
  query: string;
  results: SearchResult[];
}

/**
 * Exa AI 搜索响应格式
 */
interface ExaSearchResponse {
  results: Array<{
    title: string;
    url: string;
    text?: string;
    snippet?: string;
  }>;
}

/**
 * 使用 Exa AI 进行语义搜索
 * 通过 mcporter MCP 调用
 */
export async function webSearch(query: string): Promise<WebSearchResult> {
  try {
    // 使用 mcporter 调用 exa.web_search_exa
    const { stdout } = await execAsync(
      `mcporter call exa.web_search_exa query="${query.replace(/"/g, '\\"')}" numResults=5`,
      {
        timeout: 30000,
        maxBuffer: 1024 * 1024, // 1MB buffer
      }
    );

    // 解析 mcporter 输出
    const results: SearchResult[] = [];

    // mcporter 返回的是 JSON 格式
    try {
      const response = JSON.parse(stdout) as ExaSearchResponse;

      if (response.results && Array.isArray(response.results)) {
        for (const item of response.results) {
          results.push({
            title: item.title || '无标题',
            snippet: item.text || item.snippet || '',
            url: item.url || '',
          });
        }
      }
    } catch {
      // 如果 JSON 解析失败，尝试从文本中提取
      const lines = stdout.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.includes('http')) {
          const urlMatch = line.match(/https?:\/\/[^\s]+/);
          if (urlMatch) {
            results.push({
              title: line.substring(0, 100),
              snippet: line,
              url: urlMatch[0],
            });
          }
        }
      }
    }

    // 如果没有结果，返回提示
    if (results.length === 0) {
      results.push({
        title: '未找到结果',
        snippet: `未能找到关于 "${query}" 的相关信息。建议尝试其他搜索词。`,
        url: '',
      });
    }

    return {
      query,
      results: results.slice(0, 5), // 最多返回 5 个结果
    };
  } catch (error: any) {
    // 出错时返回错误信息
    return {
      query,
      results: [
        {
          title: '搜索出错',
          snippet: `搜索 "${query}" 时出错: ${error.message}`,
          url: '',
        },
      ],
    };
  }
}

/**
 * 格式化搜索结果用于输出
 */
export function formatSearchResult(result: WebSearchResult): string {
  const lines: string[] = [];

  lines.push(`搜索: ${result.query}`);
  lines.push('');

  if (result.results.length === 0) {
    lines.push('未找到相关结果。');
    return lines.join('\n');
  }

  result.results.forEach((item, index) => {
    lines.push(`### ${index + 1}. ${item.title}`);
    lines.push(item.snippet);
    if (item.url) {
      lines.push(`来源: ${item.url}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}
