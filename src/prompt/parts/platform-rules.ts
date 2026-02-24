// Platform Rules - 平台特定规则

import type { Platform } from '../types.js';
import { getDefaultLoader } from '../loader.js';

// 保留默认内容作为 fallback（兼容性）
const DEFAULT_CLI_RULES = `# CLI 平台规则

- 直接在终端输出，支持 ANSI 颜色
- 长回复不受限制
- 使用 markdown 格式（表格、列表、代码块）
- 支持多行输出`;

const DEFAULT_HTTP_RULES = `# HTTP 平台规则

- 输出通过 SSE 流式返回
- 支持 markdown 格式
- 长回复不受限制
- 适合 API 集成场景`;

const DEFAULT_FEISHU_RULES = `# Feishu 平台规则

- 输出会转换为 Feishu 卡片或 markdown
- 避免过长消息，考虑分条发送
- 表格使用 markdown 格式
- 不支持代码块高亮
- 用户可能从手机或桌面端访问，注意排版清晰`;

const DEFAULT_DISCORD_RULES = `# Discord 平台规则

- 支持 markdown 格式
- 消息长度有 2000 字符限制
- 支持嵌入卡片（Embed）
- 适合社区场景`;

const DEFAULT_TELEGRAM_RULES = `# Telegram 平台规则

- 支持 markdown 子集
- 消息长度有 4096 字符限制
- 支持内联键盘
- 适合即时通讯场景`;

const DEFAULT_RULES: Record<string, string> = {
  cli: DEFAULT_CLI_RULES,
  http: DEFAULT_HTTP_RULES,
  feishu: DEFAULT_FEISHU_RULES,
  discord: DEFAULT_DISCORD_RULES,
  telegram: DEFAULT_TELEGRAM_RULES,
};

/**
 * 构建平台规则部分
 * 优先从外置文件加载，失败则使用默认内容
 */
export async function buildPlatformRules(platform: Platform): Promise<string> {
  const validPlatforms = ['cli', 'http', 'feishu', 'discord', 'telegram'];

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
