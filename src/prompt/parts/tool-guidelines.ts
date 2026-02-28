// Tool Guidelines - 工具使用指南

import { getDefaultLoader } from '../loader.js';
import { generateToolsPrompt } from '@/tools/index.js';

// 保留默认内容作为 fallback
const DEFAULT_TOOL_GUIDELINES = `# Tool Guidelines

Use bazi_calculator and web_search tools appropriately. See tool descriptions for details.`;

/**
 * 构建工具使用指南部分
 */
export async function buildToolGuidelines(): Promise<string> {
  try {
    const loader = getDefaultLoader();
    const externalContent = await loader.loadPrompt('tool-guidelines', DEFAULT_TOOL_GUIDELINES);

    // 获取动态工具描述
    const karmaToolsPrompt = generateToolsPrompt();

    // 合并外置指南和动态工具描述
    return `${externalContent}

---

# Available Tools

${karmaToolsPrompt}`;
  } catch {
    // Fallback: 只返回动态工具描述
    const karmaToolsPrompt = generateToolsPrompt();
    return `# Tool Guidelines

${karmaToolsPrompt}`;
  }
}
