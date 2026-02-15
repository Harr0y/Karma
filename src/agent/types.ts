// Agent Types

export interface AgentConfig {
  model: string;
  platform: 'cli' | 'feishu' | 'wechat';
  permissionMode?: 'bypassPermissions' | 'auto';
}
