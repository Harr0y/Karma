// Platform Rules - 平台特定规则

import type { Platform } from '../types.js';
import { getDefaultLoader } from '../loader.js';

// 完整 fallback 规则（确保外置文件不存在时仍有完整指导）
const DEFAULT_CLI_RULES = `# CLI Platform Rules

## Character Limits
- No strict limit, terminal is scrollable
- Recommended: keep single output under 2000 characters for readability

## Format Support
- Full markdown support
- ANSI colors supported
- Tables, code blocks, lists all work

## Content Style
- Can go into detail
- Use formatting to improve readability`;

const DEFAULT_HTTP_RULES = `# HTTP Platform Rules

## Character Limits
- No strict limit via SSE streaming

## Format Support
- Full markdown support
- JSON responses for structured data

## Content Style
- Suitable for API integration`;

const DEFAULT_FEISHU_RULES = `# Feishu Platform Rules

## Character Limits
- Single message recommended under 4000 characters
- Split long content or use cards

## Format Support
- Markdown subset supported
- Tables supported
- Feishu cards (rich text) supported

## Content Style
- Professional but not stiff
- Keep layout clear for mobile/desktop`;

const DEFAULT_DISCORD_RULES = `# Discord Platform Rules

## Character Limits
- Message limit: 2000 characters
- Split long messages

## Format Support
- Markdown supported
- Embeds supported

## Content Style
- Casual, community-friendly`;

const DEFAULT_TELEGRAM_RULES = `# Telegram Platform Rules

## Character Limits
- Message limit: 4096 characters

## Format Support
- Markdown subset supported
- Inline keyboards supported

## Content Style
- Like instant messaging`;

const DEFAULT_WECHAT_RULES = `# WeChat Platform Rules

## Character Limits
- Keep messages concise

## Format Support
- Limited markdown support

## Content Style
- Casual, like chatting with a friend`;

const DEFAULT_RULES: Record<string, string> = {
  cli: DEFAULT_CLI_RULES,
  http: DEFAULT_HTTP_RULES,
  feishu: DEFAULT_FEISHU_RULES,
  discord: DEFAULT_DISCORD_RULES,
  telegram: DEFAULT_TELEGRAM_RULES,
  wechat: DEFAULT_WECHAT_RULES,
};

/**
 * 构建平台规则部分
 * 优先从外置文件加载，失败时使用完整 fallback
 */
export async function buildPlatformRules(platform: Platform): Promise<string> {
  const validPlatforms = ['cli', 'http', 'feishu', 'discord', 'telegram', 'wechat'];

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

  // 使用完整 fallback
  return DEFAULT_RULES[platform] || `# Platform Rules\n\nYou are on **${platform}** platform.`;
}
