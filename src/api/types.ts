// API Types - HTTP API 请求/响应类型定义

// ============== Session ==============

export interface CreateSessionRequest {
  userId?: string;
  metadata?: {
    platform?: string;
    persona?: string;
    [key: string]: unknown;
  };
}

export interface CreateSessionResponse {
  sessionId: string;
  createdAt: string;
}

export interface SessionInfo {
  sessionId: string;
  clientId?: string;
  platform: string;
  startedAt: string;
}

// ============== Chat ==============

export interface ChatRequest {
  sessionId: string;
  message: string;
}

// SSE 消息类型
export type SSEMessageType = 'text' | 'tool_use' | 'done' | 'error';

export interface SSEMessage {
  type: SSEMessageType;
  content?: string;
  toolName?: string;
  error?: string;
}

// ============== History ==============

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface GetHistoryResponse {
  sessionId: string;
  messages: Message[];
  extractedInfo?: {
    name?: string;
    birthDate?: string;
    birthPlace?: string;
    concerns?: string[];
  };
}

// ============== Error ==============

export interface APIError {
  error: string;
  code: string;
  details?: unknown;
}
