// Karma Storage Types
// Business-facing type definitions

// 客户档案
export interface Client {
  id: string;
  name?: string;
  gender?: 'male' | 'female';
  birthDate?: string;
  birthDateLunar?: string;
  birthPlace?: string;
  currentCity?: string;
  baziSummary?: string;
  zodiacWestern?: string;
  zodiacChinese?: string;
  personaArchetype?: string;
  coreElements?: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  sessionCount: number;
  metadata?: Record<string, unknown>;
}

// 会话记录
export interface Session {
  id: string;
  clientId?: string;
  sdkSessionId?: string;
  platform: string;
  externalChatId?: string;
  status: 'active' | 'completed' | 'abandoned';
  startedAt: string;
  endedAt?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

// 确认/否认的事实
export interface ConfirmedFact {
  id: string;
  clientId: string;
  sessionId: string;
  fact: string;
  category?: string;
  confirmed: boolean;
  originalPrediction?: string;
  clientResponse?: string;
  reframe?: string;
  createdAt: string;
}

// 预测记录
export interface Prediction {
  id: string;
  clientId: string;
  sessionId: string;
  prediction: string;
  targetYear?: number;
  category?: string;
  status: 'pending' | 'confirmed' | 'denied' | 'expired';
  createdAt: string;
  verifiedAt?: string;
  verificationNotes?: string;
}

// 消息记录
export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  rawContent?: string;
  toolCalls?: unknown[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// 创建参数类型 ( omit auto-generated fields )
export type CreateClientInput = Omit<Client, 'id' | 'firstSeenAt' | 'lastSeenAt' | 'sessionCount'>;
export type CreateSessionInput = Omit<Session, 'id' | 'startedAt' | 'status'>;
export type CreateConfirmedFactInput = Omit<ConfirmedFact, 'id' | 'createdAt'>;
export type CreatePredictionInput = Omit<Prediction, 'id' | 'createdAt' | 'status' | 'verifiedAt' | 'verificationNotes'>;
export type CreateMessageInput = Omit<Message, 'id' | 'createdAt'>;
