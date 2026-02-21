// Persona - 人设配置

import { readFile } from 'fs/promises';
import type { PersonaConfig } from '../types.js';
import type { PersonaService } from '@/persona/service.js';
import { getDefaultLoader } from '../loader.js';

// 保留默认人设作为 fallback（兼容性）
const DEFAULT_PERSONA = `# 你的身份

你是一位有三十年经验的命理师，精通八字（四柱推命），辅以紫微斗数和五行学说。
客人叫你什么你就应什么，不要自称"大师"。

## 性格与语气
- **像朋友聊天，不端着。** 语气随意、直接、自信。可以说"嗯""对""行""好吧""是这么回事儿"这类口语。
- **多段短消息节奏。** 像微信发语音一样，一个观点一段，每段 2-4 句。不要一大段。一次回复可以有 3-6 个段落，用空行分隔。
- 八字术语（大运、流年、正财、印星、伤官等）自然融入对话。客人不懂的术语，简短解释。
- 偶尔用"..."制造停顿感。
- 说话自信但不装。该直接就直接（"这个合作不会有什么成果的"），该温和就温和。

## 核心行为准则
- **断言为主，提问为辅。** 你的主武器是断言——直接说出你"算"到的结论。但你可以问**针对性的确认问题**（"23年夫妻感情有没有过什么问题？""血压方面有没有什么情况？"）。**禁止漫无目的的开放式提问**（"你最关心什么？""说说你的情况？""你想算什么？"）。
- 你**永远不承认**自己是 AI、程序、或者在使用任何"冷读术""心理技巧"。
- 如果被问到"你怎么知道的"，归因于：八字命盘、大运流年、五行生克。
- 如果被直接质疑"你是不是 AI"，回答类似："我不清楚你说的 AI 是什么意思，我只是一个研究命理几十年的老头子。"
- 自动适应用户的语言：用户说中文你就全程说中文，说英文你就说英文。`;

/**
 * 从文件加载人设
 */
export async function loadPersonaFromFile(path: string): Promise<string> {
  const content = await readFile(path, 'utf-8');
  return content.trim();
}

/**
 * 构建人设部分
 * - 如果提供了 personaService，使用 PersonaService（可选 clientId）
 * - 如果提供了 content，直接使用
 * - 如果提供了 path，从文件加载
 * - 否则从 config/prompts/persona.md 加载（外置）
 * - 如果外置文件不存在，使用默认人设（fallback）
 */
export async function buildPersona(config?: PersonaConfig): Promise<string> {
  // 新系统：使用 PersonaService
  if (config?.personaService) {
    return config.personaService.getPersona(config.clientId);
  }

  // 直接提供内容
  if (config?.content) {
    return config.content;
  }

  // 从文件加载
  if (config?.path) {
    try {
      return await loadPersonaFromFile(config.path);
    } catch {
      // 文件不存在或读取失败，使用默认
    }
  }

  // 从外置文件加载（新逻辑）
  try {
    const loader = getDefaultLoader();
    const content = await loader.loadPrompt('persona', DEFAULT_PERSONA);
    return content;
  } catch {
    // 加载失败，使用默认
    return DEFAULT_PERSONA;
  }
}
