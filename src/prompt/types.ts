// Prompt System Types

import type { Skill } from '@/skills/types.js';
import type { PersonaConfig } from '@/persona/types.js';

export type Platform = 'cli' | 'feishu' | 'wechat';

export { PersonaConfig };

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
