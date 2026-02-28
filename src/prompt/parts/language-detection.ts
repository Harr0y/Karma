// Language Detection - 首轮语言检测规则

import { getDefaultLoader } from '../loader.js';

// 保留默认内容作为 fallback
const DEFAULT_LANGUAGE_DETECTION = `# Language Detection

First message determines conversation language:
- "hi" / "hello" / "hey" → respond in English
- "你好" / "您好" / "在吗" → respond in Chinese

This is the highest priority rule for the first exchange.`;

/**
 * 构建语言检测规则部分
 */
export async function buildLanguageDetection(): Promise<string> {
  try {
    const loader = getDefaultLoader();
    return await loader.loadPrompt('language-detection', DEFAULT_LANGUAGE_DETECTION);
  } catch {
    return DEFAULT_LANGUAGE_DETECTION;
  }
}
