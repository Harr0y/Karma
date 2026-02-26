// Web Search Tool - 搜索历史事件和相关信息

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
 * 使用 DuckDuckGo Instant Answer API 进行搜索
 * 这是一个免费的搜索 API，不需要 API key
 */
export async function webSearch(query: string): Promise<WebSearchResult> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Karma-Agent/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Search API error: ${response.status}`);
    }

    const data = await response.json();

    // 从 DuckDuckGo 响应中提取结果
    const results: SearchResult[] = [];

    // 添加摘要（如果有）
    if (data.Abstract) {
      results.push({
        title: data.Heading || '摘要',
        snippet: data.Abstract,
        url: data.AbstractURL || '',
      });
    }

    // 添加相关主题
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || '相关主题',
            snippet: topic.Text,
            url: topic.FirstURL,
          });
        }
      }
    }

    // 如果没有结果，返回一个提示
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
