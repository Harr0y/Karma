// Karma Tools - 自定义工具注册
// 使用 SDK 的 createSdkMcpServer 注册工具

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { calculateBazi, formatBaziResult } from './bazi-calculator.js';
import type { BaziInput } from './bazi-calculator.js';

// ============================================================================
// Schema 定义（提到函数外，避免重复创建）
// ============================================================================

/**
 * 八字排盘工具的 Zod Schema
 */
const baziSchema = {
  birthDate: z.string().describe('公历生日，支持 ISO 格式（1990-05-15T06:00:00）或中文格式（1990年5月15日早上6点）'),
  gender: z.enum(['male', 'female']).describe('性别：male（男）或 female（女）'),
};

// ============================================================================
// MCP Server 创建
// ============================================================================

/**
 * 创建 Karma MCP Server
 * 使用 SDK 的 createSdkMcpServer 注册工具
 */
export function createKarmaMcpServer() {
  // 创建 SDK 工具
  const baziTool = tool(
    'bazi_calculator',
    '根据生辰信息排八字命盘，返回四柱、大运、流年、纳音等信息。当你获取到客户的完整生辰信息后，使用此工具进行排盘。',
    baziSchema,
    async (args, _extra) => {
      try {
        const baziInput: BaziInput = {
          birthDate: args.birthDate,
          gender: args.gender,
        };

        const result = await calculateBazi(baziInput);
        const formatted = formatBaziResult(result);

        return {
          content: [
            {
              type: 'text' as const,
              text: formatted,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `八字排盘失败: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // 创建并返回 MCP Server
  return createSdkMcpServer({
    name: 'karma-tools',
    version: '1.0.0',
    tools: [baziTool],
  });
}

// ============================================================================
// Prompt 生成（用于 System Prompt 中的工具说明）
// ============================================================================

/**
 * 工具元信息（用于动态生成 prompt）
 */
const toolMetadata = [
  {
    name: 'bazi_calculator',
    description: '根据生辰信息排八字命盘，返回四柱、大运、流年、纳音等信息。当你获取到客户的完整生辰信息后，使用此工具进行排盘。',
    parameters: [
      { name: 'birthDate', description: '公历生日，支持 ISO 格式（1990-05-15T06:00:00）或中文格式（1990年5月15日早上6点）' },
      { name: 'gender', description: '性别：male（男）或 female（女）' },
    ],
  },
];

/**
 * 生成工具说明文本（用于 System Prompt）
 * 动态生成，添加新工具只需更新 toolMetadata
 */
export function generateToolsPrompt(): string {
  const toolDescriptions = toolMetadata.map((tool) => {
    const params = tool.parameters
      .map((p) => `    - ${p.name}: ${p.description}`)
      .join('\n');

    return `### ${tool.name}

${tool.description}

参数：
${params}
`;
  });

  return `# 可用工具

你可以使用以下工具来辅助命理分析。当你获取到足够的信息后，调用相应工具。

${toolDescriptions.join('\n')}

## 使用方式

在 inner_monologue 中，你可以这样调用：

\`\`\`
调用工具: bazi_calculator
参数: {
  "birthDate": "1990年5月15日早上6点",
  "gender": "male"
}
\`\`\`

工具会返回格式化的八字信息，你可以在后续对话中使用这些信息。`;
}
