// Platform Rules - 平台特定规则

import type { Platform } from '../types.js';
import { getDefaultLoader } from '../loader.js';

// 保留默认内容作为 fallback（兼容性）
const DEFAULT_CLI_RULES = `# CLI 平台规则

- 直接在终端输出，支持 ANSI 颜色
- 长回复不受限制
- 使用 markdown 格式（表格、列表、代码块）
- 支持多行输出`;

const DEFAULT_FEISHU_RULES = `# Feishu 平台规则

- 输出会转换为 Feishu 卡片或 markdown
- 避免过长消息，考虑分条发送
- 表格使用 markdown 格式
- 不支持代码块高亮
- 用户可能从手机或桌面端访问，注意排版清晰`;

const DEFAULT_WECHAT_RULES = `# WeChat 平台规则

- 消息长度有限制，考虑分段发送
- 纯文本格式，不支持 markdown
- 避免复杂表格，使用列表代替
- 适合短平快的回复风格`;

const DEFAULT_RULES: Record<string, string> = {
  cli: DEFAULT_CLI_RULES,
  feishu: DEFAULT_FEISHU_RULES,
  wechat: DEFAULT_WECHAT_RULES,
};

/**
 * 构建平台规则部分
 * 优先从外置文件加载，失败则使用默认内容
 */
export async function buildPlatformRules(platform: Platform): Promise<string> {
  const validPlatforms = ['cli', 'feishu', 'wechat'];

  if (!validPlatforms.includes(platform)) {
    return '';
  }

  try {
    const loader = getDefaultLoader();
    const content = await loader.loadPlatformRules(platform);

    // 如果外置文件不存在或为空，使用默认
    if (content) {
      return content;
    }
  } catch {
    // 加载失败，使用默认
  }

  return DEFAULT_RULES[platform] || '';
}
