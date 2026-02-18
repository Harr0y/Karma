// Karma Tools - 自定义工具注册
// 这些工具可以通过 prompt 引导 Agent 使用

import { calculateBazi, formatBaziResult } from './bazi-calculator.js';
import type { BaziInput } from './bazi-calculator.js';

/**
 * 工具定义
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  handler: (input: Record<string, any>) => Promise<any>;
}

/**
 * 八字排盘工具
 */
export const baziCalculatorTool: ToolDefinition = {
  name: 'bazi_calculator',
  description: '根据生辰信息排八字命盘，返回四柱、大运、流年、纳音等信息。当你获取到客户的完整生辰信息后，使用此工具进行排盘。',
  inputSchema: {
    type: 'object',
    properties: {
      birthDate: {
        type: 'string',
        description: '公历生日，支持 ISO 格式（1990-05-15T06:00:00）或中文格式（1990年5月15日早上6点）',
      },
      gender: {
        type: 'string',
        enum: ['male', 'female'],
        description: '性别：male（男）或 female（女）',
      },
    },
    required: ['birthDate', 'gender'],
  },
  handler: async (input: Record<string, any>) => {
    const baziInput: BaziInput = {
      birthDate: input.birthDate,
      gender: input.gender,
    };

    const result = await calculateBazi(baziInput);
    return {
      success: true,
      data: result,
      formatted: formatBaziResult(result),
    };
  },
};

/**
 * 所有自定义工具
 */
export const karmaTools: ToolDefinition[] = [baziCalculatorTool];

/**
 * 执行工具
 */
export async function executeTool(
  name: string,
  input: Record<string, any>
): Promise<any> {
  const tool = karmaTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return tool.handler(input);
}

/**
 * 生成工具说明文本（用于 prompt）
 */
export function generateToolsPrompt(): string {
  const toolDescriptions = karmaTools.map((tool) => {
    const props = Object.entries(tool.inputSchema.properties)
      .map(([key, value]) => `    - ${key}: ${value.description}`)
      .join('\n');

    return `### ${tool.name}

${tool.description}

参数：
${props}
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
