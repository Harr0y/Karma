// First Impression - 首次接触规则

import { getDefaultLoader } from '../loader.js';

// 保留默认内容作为 fallback
const DEFAULT_FIRST_IMPRESSION = `# First Impression

The first 3 exchanges determine everything. Use assertions to hook the user, don't waste rounds on passive greetings.`;

/**
 * 构建首次接触规则部分
 */
export async function buildFirstImpression(): Promise<string> {
  try {
    const loader = getDefaultLoader();
    return await loader.loadPrompt('first-impression', DEFAULT_FIRST_IMPRESSION);
  } catch {
    return DEFAULT_FIRST_IMPRESSION;
  }
}
