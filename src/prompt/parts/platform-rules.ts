// Platform Rules - 平台特定规则

import type { Platform } from '../types.js';

export function buildPlatformRules(platform: Platform): string {
  switch (platform) {
    case 'cli':
      return buildCliRules();
    case 'feishu':
      return buildFeishuRules();
    case 'wechat':
      return buildWechatRules();
    default:
      return '';
  }
}

function buildCliRules(): string {
  return `# CLI 平台规则

- 直接在终端输出，支持 ANSI 颜色
- 长回复不受限制
- 使用 markdown 格式（表格、列表、代码块）
- 支持多行输出`;
}

function buildFeishuRules(): string {
  return `# Feishu 平台规则

- 输出会转换为 Feishu 卡片或 markdown
- 避免过长消息，考虑分条发送
- 表格使用 markdown 格式
- 不支持代码块高亮
- 用户可能从手机或桌面端访问，注意排版清晰`;
}

function buildWechatRules(): string {
  return `# WeChat 平台规则

- 消息长度有限制，考虑分段发送
- 纯文本格式，不支持 markdown
- 避免复杂表格，使用列表代替
- 适合短平快的回复风格`;
}
