// Prompt System Types

import type { Skill } from '@/skills/types.js';

export type Platform = 'cli' | 'feishu' | 'wechat';

export interface PersonaConfig {
  path?: string;      // SOUL.md 文件路径
  content?: string;   // 直接提供内容
}

export interface SystemPromptContext {
  now: Date;
  clientProfile?: string;
  skills: Skill[];
  platform: Platform;
  personaConfig?: PersonaConfig;
}

export interface BuildPromptOptions {
  includeBazi?: boolean;           // 默认 true
  includeColdReading?: boolean;    // 默认 true
  includeToolGuidelines?: boolean; // 默认 true
  includeOutputRules?: boolean;    // 默认 true
}
