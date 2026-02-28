// Platform Rules - 平台特定规则

import type { Platform } from '../types.js';
import { getDefaultLoader } from '../loader.js';

/**
 * 构建平台规则部分
 * 只从外置文件加载，不再使用硬编码 fallback
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
    // 加载失败，记录警告
    console.warn(`Failed to load platform rules for ${platform}:`, error);
  }

  // 返回空字符串而不是 fallback
  // 外置文件应该总是存在
  return '';
}
