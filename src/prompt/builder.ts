// System Prompt Builder - 组合式构建

import type { SystemPromptContext, BuildPromptOptions } from './types.js';
import { buildTimeAnchor } from './parts/time-anchor.js';
import { buildPersona } from './parts/persona.js';
import { buildBaziFramework } from './parts/bazi.js';
import { buildColdReadingEngine } from './parts/cold-reading.js';
import { buildPlatformRules } from './parts/platform-rules.js';
import { buildToolGuidelines } from './parts/tool-guidelines.js';
import { buildOutputRules } from './parts/output-rules.js';
import { buildFirstImpression } from './parts/first-impression.js';
import { buildLanguageDetection } from './parts/language-detection.js';
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

  // 2. 人设 (可从 SOUL.md 加载或外置文件)
  parts.push(await buildPersona(context.personaConfig));

  // 2.5 语言检测 (最高优先级，第一轮必须执行)
  parts.push(await buildLanguageDetection());

  // 2.6 首次接触规则 (前几轮对话的关键指导)
  parts.push(await buildFirstImpression());

  // 3. 八字框架 (核心方法，现在是 async)
  if (includeBazi) {
    parts.push(await buildBaziFramework());
  }

  // 4. 冷读引擎 (现在是 async)
  if (includeColdReading) {
    parts.push(await buildColdReadingEngine());
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

  // 7. 平台规则 (现在是 async)
  parts.push(await buildPlatformRules(context.platform));

  // 8. 工具使用指南
  if (includeToolGuidelines) {
    parts.push(buildToolGuidelines());
  }

  // 9. 输出格式规则 (现在是 async)
  if (includeOutputRules) {
    parts.push(await buildOutputRules());
  }

  return parts.join('\n\n');
}
