// Feishu File Handler - 飞书文件处理

import * as lark from '@larksuiteoapi/node-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 飞书文件处理器
 */
export class FeishuFileHandler {
  private client: lark.Client;

  constructor(client: lark.Client) {
    this.client = client;
  }

  /**
   * 上传图片
   */
  async uploadImage(imageBuffer: Buffer, fileName?: string): Promise<string> {
    const tmpPath = this.saveToTemp(imageBuffer, fileName || 'image.png');

    try {
      const response = await this.client.im.image.create({
        data: {
          image_type: 'message',
          image: fs.createReadStream(tmpPath),
        },
      });

      return response?.image_key || '';
    } finally {
      this.cleanup(tmpPath);
    }
  }

  /**
   * 从 URL 上传图片
   * Note: Requires node-fetch or undici. Use uploadImage for Buffer input.
   */
  async uploadImageFromUrl(url: string): Promise<string> {
    // Dynamic import to avoid bundling issues
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadImage(buffer, path.basename(url));
  }

  /**
   * 上传文件
   */
  async uploadFile(fileBuffer: Buffer, fileName: string): Promise<string> {
    const tmpPath = this.saveToTemp(fileBuffer, fileName);

    try {
      const response = await this.client.im.file.create({
        data: {
          file_type: 'stream',
          file_name: fileName,
          file: fs.createReadStream(tmpPath),
        },
      });

      return response?.file_key || '';
    } finally {
      this.cleanup(tmpPath);
    }
  }

  /**
   * 从 URL 上传文件
   * Note: Requires node-fetch or undici. Use uploadFile for Buffer input.
   */
  async uploadFileFromUrl(url: string, fileName: string): Promise<string> {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadFile(buffer, fileName);
  }

  /**
   * 上传媒体文件 (音频)
   */
  async uploadMedia(mediaBuffer: Buffer, format: string): Promise<string> {
    const fileName = `media.${format}`;
    const tmpPath = this.saveToTemp(mediaBuffer, fileName);

    try {
      const response = await this.client.im.file.create({
        data: {
          file_type: 'stream',
          file_name: fileName,
          file: fs.createReadStream(tmpPath),
        },
      });

      return response?.file_key || '';
    } finally {
      this.cleanup(tmpPath);
    }
  }

  /**
   * 从 URL 上传媒体
   * Note: Requires node-fetch or undici. Use uploadMedia for Buffer input.
   */
  async uploadMediaFromUrl(url: string, format: string): Promise<string> {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadMedia(buffer, format);
  }

  /**
   * 下载文件
   */
  async downloadFile(fileKey: string): Promise<string> {
    const response = await this.client.im.file.get({
      path: { file_key: fileKey },
    });

    // Create temp file path
    const tmpPath = path.join(os.tmpdir(), 'karma-feishu', fileKey);
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });

    // Write file using SDK helper
    await response.writeFile(tmpPath);

    return tmpPath;
  }

  /**
   * 保存到临时目录
   */
  private saveToTemp(buffer: Buffer, fileName: string): string {
    const tmpDir = path.join(os.tmpdir(), 'karma-feishu');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const tmpPath = path.join(tmpDir, fileName);
    fs.writeFileSync(tmpPath, buffer);
    return tmpPath;
  }

  /**
   * 清理临时文件
   */
  private cleanup(tmpPath: string): void {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
