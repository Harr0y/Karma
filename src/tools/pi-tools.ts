/**
 * pi-mono AgentTool 定义
 *
 * 将 Karma 的工具迁移到 pi-mono 的 AgentTool 格式
 */

import { Type, type Static } from '@sinclair/typebox';
import { AgentTool } from '@mariozechner/pi-agent-core';
import { calculateBazi, formatBaziResult, type BaziInput, type BaziResult } from './bazi-calculator.js';

/**
 * 八字排盘工具参数 Schema
 */
export const BaziToolParameters = Type.Object({
  birthDate: Type.String({
    description: '公历生日，支持 ISO 格式（1990-05-15T06:00:00）或中文格式（1990年5月15日早上6点）',
  }),
  gender: Type.Enum({ male: 'male', female: 'female' }, {
    description: '性别：male（男）或 female（女）',
  }),
});

export type BaziToolParams = Static<typeof BaziToolParameters>;

/**
 * 工具详情类型（result 是已解析的值，不是 Promise）
 */
interface BaziToolDetails {
  input: BaziInput;
  result: BaziResult;
}

/**
 * 创建八字排盘 AgentTool
 */
export function createBaziTool(): AgentTool<typeof BaziToolParameters, BaziToolDetails> {
  return {
    name: 'bazi_calculator',
    label: '八字排盘',
    description: '根据生辰信息排八字命盘，返回四柱、大运、流年、纳音等信息。当你获取到客户的完整生辰信息后，使用此工具进行排盘。',
    parameters: BaziToolParameters,
    execute: async (toolCallId, params, signal, onUpdate) => {
      try {
        // 转换参数格式
        const baziInput: BaziInput = {
          birthDate: params.birthDate,
          gender: params.gender,
        };

        // 执行排盘
        const result = await calculateBazi(baziInput);

        // 格式化输出
        const formatted = formatBaziResult(result);

        return {
          content: [{ type: 'text' as const, text: formatted }],
          details: {
            input: baziInput,
            result,
          },
        };
      } catch (error: any) {
        // 返回错误信息
        return {
          content: [{ type: 'text' as const, text: `八字排盘失败: ${error.message}` }],
          details: {
            input: {
              birthDate: params.birthDate,
              gender: params.gender,
            },
            result: null as any,
          },
        };
      }
    },
  };
}

/**
 * 导出所有 Karma 工具
 */
export function createKarmaTools(): AgentTool<any, any>[] {
  return [
    createBaziTool(),
  ];
}
