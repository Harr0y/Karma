// Feishu Adapter - 飞书平台适配器

import * as lark from '@larksuiteoapi/node-sdk';
import type {
  PlatformAdapter,
  IncomingMessage,
  MessageHandler,
  MediaContent,
  ImageContent,
  AudioContent,
  FileContent,
} from '../../types.js';
import type { FeishuConfig } from './types.js';
import { FeishuFileHandler } from './file-handler.js';
import { getLogger } from '@/logger/index.js';
import type { Logger } from '@/logger/types.js';

/**
 * 飞书平台适配器
 */
export class FeishuAdapter implements PlatformAdapter {
  readonly platform = 'feishu' as const;

  private config: FeishuConfig;
  private client: lark.Client;
  private wsClient?: lark.WSClient;
  private fileHandler: FeishuFileHandler;
  private messageHandlers: MessageHandler[] = [];
  private running = false;
  private logger: Logger;

  constructor(config: FeishuConfig) {
    this.config = config;
    this.logger = getLogger().child({ module: 'platform' });
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
      appType: lark.AppType.SelfBuild,
      domain: lark.Domain.Lark,
    });
    this.fileHandler = new FeishuFileHandler(this.client);
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.info('适配器未启用', { operation: 'start', metadata: { platform: 'feishu' } });
      return;
    }

    this.logger.info('启动飞书适配器', { operation: 'start' });

    this.wsClient = new lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      domain: lark.Domain.Lark,
    });

    const eventDispatcher = new lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: unknown) => {
        await this.handleRawMessage(data);
      },
    });

    await this.wsClient.start({
      eventDispatcher,
    });

    this.running = true;
    this.logger.info('WebSocket 连接已建立', { operation: 'ws_connect' });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.logger.info('适配器已停止', { operation: 'stop' });
  }

  isRunning(): boolean {
    return this.running;
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  async sendMessage(chatId: string, content: string): Promise<string> {
    const response = await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'text',
        content: JSON.stringify({ text: content }),
      },
    });

    return response.data?.message_id || '';
  }

  async sendImage(chatId: string, image: ImageContent): Promise<string> {
    let imageKey: string;

    if (image.data) {
      imageKey = await this.fileHandler.uploadImage(image.data);
    } else if (image.url) {
      imageKey = await this.fileHandler.uploadImageFromUrl(image.url);
    } else {
      throw new Error('Image must have data or url');
    }

    const response = await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'image',
        content: JSON.stringify({ image_key: imageKey }),
      },
    });

    // 发送 caption（如果有）
    if (image.caption) {
      await this.sendMessage(chatId, image.caption);
    }

    return response.data?.message_id || '';
  }

  async sendAudio(chatId: string, audio: AudioContent): Promise<string> {
    let mediaKey: string;

    if (audio.data) {
      mediaKey = await this.fileHandler.uploadMedia(audio.data, 'opus');
    } else if (audio.url) {
      mediaKey = await this.fileHandler.uploadMediaFromUrl(audio.url, 'opus');
    } else {
      throw new Error('Audio must have data or url');
    }

    const response = await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'audio',
        content: JSON.stringify({
          file_key: mediaKey,
          duration: audio.duration || 0,
        }),
      },
    });

    return response.data?.message_id || '';
  }

  async sendFile(chatId: string, file: FileContent): Promise<string> {
    let fileKey: string;

    if (file.data) {
      fileKey = await this.fileHandler.uploadFile(file.data, file.fileName);
    } else if (file.url) {
      fileKey = await this.fileHandler.uploadFileFromUrl(file.url, file.fileName);
    } else {
      throw new Error('File must have data or url');
    }

    const response = await this.client.im.message.create({
      params: { receive_id_type: 'chat_id' },
      data: {
        receive_id: chatId,
        msg_type: 'file',
        content: JSON.stringify({ file_key: fileKey }),
      },
    });

    return response.data?.message_id || '';
  }

  async downloadMedia(media: MediaContent): Promise<string> {
    return this.fileHandler.downloadFile(media.fileId);
  }

  private async handleRawMessage(data: unknown): Promise<void> {
    try {
      const message = this.parseMessage(data);

      this.logger.debug('收到消息', {
        operation: 'message_receive',
        metadata: {
          messageId: message.id,
          chatId: message.chatId,
          senderType: message.senderType,
        },
      });

      // 分发给所有处理器
      for (const handler of this.messageHandlers) {
        try {
          await handler(message);
        } catch (err) {
          this.logger.error('消息处理错误', err instanceof Error ? err : undefined, {
            operation: 'handler_error',
            metadata: { messageId: message.id },
          });
        }
      }
    } catch (err) {
      this.logger.error('解析消息错误', err instanceof Error ? err : undefined, {
        operation: 'parse_error',
      });
    }
  }

  private parseMessage(data: unknown): IncomingMessage {
    const event = (data as any).event;
    const { message, sender } = event;

    return {
      id: message.message_id,
      platform: 'feishu',
      chatId: message.chat_id,
      userId: sender?.sender_id?.open_id,
      senderType: sender?.sender_type === 'app' ? 'bot' : 'user',
      text: this.extractText(message),
      timestamp: Number(message.create_time) * 1000,
    };
  }

  private extractText(message: any): string {
    const content = JSON.parse(message.content || '{}');

    if (message.message_type === 'text') {
      return content.text || '';
    }

    if (message.message_type === 'post') {
      return this.extractPostText(content);
    }

    return '';
  }

  private extractPostText(content: any): string {
    if (!content?.content) return '';
    return content.content.flat().map((c: any) => c.text || '').join('');
  }
}
