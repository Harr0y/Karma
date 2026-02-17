// Persona Types - 人设系统类型定义

import type { Client } from '@/storage/schema.js';

// ===== 历史特征 =====

export interface HistoryFeatures {
  topTopics: string[];       // 历史高频话题
  confirmedFactRate: number; // 断言命中率 (0-1)
  totalSessions: number;     // 总会话数
  lastSessionDate?: string;  // 上次咨询时间
}

// ===== 用户微调片段 =====

export interface TuningContext {
  client: Client | null;
  history: HistoryFeatures;
}

// ===== PersonaService 接口 =====

export interface PersonaServiceOptions {
  soulPath: string;              // SOUL.md 文件路径
  storage: import('@/storage/service.js').StorageService;
}

// ===== PersonaConfig 扩展 =====

export interface PersonaConfig {
  // 现有字段
  path?: string;
  content?: string;

  // 新增：完整服务模式
  personaService?: import('./service.js').PersonaService;
  clientId?: string;
}
