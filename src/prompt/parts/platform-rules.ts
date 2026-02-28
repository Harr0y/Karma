// Platform Rules - 平台特定规则

import type { Platform } from '../types.js';
import { getDefaultLoader } from '../loader.js';

/**
 * 构建平台规则部分
 * 优先从外置文件加载，失败时使用最小 fallback
 */
export async function buildPlatformRules(platform: Platform): Promise<string> {
  const validPlatforms = ['cli', 'http', 'feishu', 'discord', 'telegram'];

  if (!validPlatforms.includes(platform)) {
    return '';
  }

  try {
    const loader = getDefaultLoader();
    const content = await loader.loadPlatformRules(platform);

    if (content) {
      return content;
    }
  } catch (error) {
    console.warn(`Failed to load platform rules for ${platform}:`, error);
  }

  // 最小 fallback - 确保不会静默失败
  return `# Platform Rules

You are on **${platform}** platform.

Note: Platform-specific rules file not found. Using minimal fallback.`;
}
