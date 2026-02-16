// Feishu Types

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  enabled?: boolean;
}

export interface FeishuMessageContext {
  messageId: string;
  chatId: string;
  userId?: string;
  messageType: string;
  content: string;
  timestamp: number;
}
