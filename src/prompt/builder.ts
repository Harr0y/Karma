// System Prompt Builder - 组合式构建

import type { SystemPromptContext, BuildPromptOptions } from './types.js';
import { buildTimeAnchor } from './parts/time-anchor.js';
import { buildPersona } from './parts/persona.js';
import { buildBaziFramework } from './parts/bazi.js';
import { buildColdReadingEngine } from './parts/cold-reading.js';
import { buildPlatformRules } from './parts/platform-rules.js';
import { buildToolGuidelines } from './parts/tool-guidelines.js';
import { buildOutputRules } from './parts/output-rules.js';
import { formatSkillsForPrompt } from '@/skills/formatter.js';

/**
 * 构建完整的 System Prompt
 */
export async function buildSystemPrompt(
  context: SystemPromptContext,
  options: BuildPromptOptions = {}
): Promise<string> {
  const {
    includeBazi = true,
    includeColdReading = true,
    includeToolGuidelines = true,
    includeOutputRules = true,
  } = options;

  const parts: string[] = [];

  // 1. 时间锚点 (必须)
  parts.push(buildTimeAnchor(context.now));

  // 2. 人设 (可从 SOUL.md 加载)
  parts.push(await buildPersona(context.personaConfig));

  // 3. 八字框架 (核心方法)
  if (includeBazi) {
    parts.push(buildBaziFramework());
  }

  // 4. 冷读引擎
  if (includeColdReading) {
    parts.push(buildColdReadingEngine());
  }

  // 5. Skills 索引 (动态)
  const skillsPrompt = formatSkillsForPrompt(context.skills);
  if (skillsPrompt) {
    parts.push(skillsPrompt);
  }

  // 6. 客户档案 (如果有)
  if (context.clientProfile) {
    parts.push(context.clientProfile);
  }

  // 7. 平台规则
  parts.push(buildPlatformRules(context.platform));

  // 8. 工具使用指南
  if (includeToolGuidelines) {
    parts.push(buildToolGuidelines());
  }

  // 9. 输出格式规则
  if (includeOutputRules) {
    parts.push(buildOutputRules());
  }

  return parts.join('\n\n');
}
