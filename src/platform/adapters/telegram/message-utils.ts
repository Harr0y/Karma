// Telegram Message Utilities - 消息处理工具

import { ProxyAgent, request, setGlobalDispatcher } from 'undici';
import type { TelegramApiResponse } from './types.js';

/**
 * API 调用选项
 */
export interface ApiCallOptions {
  retryAttempts?: number;
  retryDelay?: number;
}

// 初始化全局代理
function initProxy(): void {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  }
}

// 模块加载时初始化代理
initProxy();

/**
 * HTML 转义
 * 将特殊字符转换为 HTML 实体，防止 XSS 攻击
 *
 * @param text - 原始文本
 * @returns 转义后的文本
 */
export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * 消息分割
 * 将长消息分割为多个符合 Telegram 限制的消息
 * 优先在换行符处分割
 *
 * @param text - 原始文本
 * @param maxLength - 单条消息最大长度 (默认 4096)
 * @returns 分割后的消息数组
 */
export function splitMessage(text: string, maxLength: number = 4096): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const messages: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    // 尝试在 maxLength 附近找换行符
    let splitIndex = remaining.lastIndexOf('\n', maxLength);

    // 如果没有换行符，直接在 maxLength 处分割
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    } else {
      // 包含换行符
      splitIndex = splitIndex + 1;
    }

    messages.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex);
  }

  // 添加剩余部分
  if (remaining.length > 0) {
    messages.push(remaining);
  }

  return messages;
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 指数退避计算
 */
function calculateBackoff(attempt: number, baseDelay: number): number {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * 调用 Telegram Bot API
 * 带重试机制和错误处理
 *
 * @param botToken - Bot Token
 * @param method - API 方法名
 * @param params - 请求参数
 * @param options - 调用选项
 * @returns API 响应结果
 */
export async function callTelegramApi<T = unknown>(
  botToken: string,
  method: string,
  params: Record<string, unknown>,
  options: ApiCallOptions = {}
): Promise<T> {
  const {
    retryAttempts = 3,
    retryDelay = 1000,
  } = options;

  const url = `https://api.telegram.org/bot${botToken}/${method}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      // 使用 undici 的 request 函数（已配置全局代理）
      const response = await request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data: TelegramApiResponse<T> = await response.body.json() as TelegramApiResponse<T>;

      // API 返回错误
      if (!data.ok) {
        throw new Error(data.description || `Telegram API error: ${data.error_code}`);
      }

      return data.result as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 检查是否应该重试
      if (!shouldRetryRequest(error, attempt, retryAttempts)) {
        throw lastError;
      }

      // 计算退避时间
      const backoffMs = getRetryDelay(error, attempt, retryDelay);
      await delay(backoffMs);
    }
  }

  throw lastError || new Error('Max retry attempts exceeded');
}

/**
 * 判断是否应该重试请求
 * 注意：此函数保持同步，因为所有检查逻辑都是同步的
 */
function shouldRetryRequest(
  error: unknown,
  attempt: number,
  maxAttempts: number
): boolean {
  if (attempt >= maxAttempts) {
    return false;
  }

  // 检查是否是 HTTP 响应错误
  if (error instanceof Response) {
    const status = error.status;

    // 429 Rate Limit - 重试
    if (status === 429) {
      return true;
    }

    // 5xx Server Error - 重试
    if (status >= 500 && status < 600) {
      return true;
    }

    // 4xx Client Error - 不重试 (除了 429)
    return false;
  }

  // 网络错误或其他错误 - 重试
  if (error instanceof TypeError) {
    return true;
  }

  // 检查错误对象中是否有状态码
  if (error instanceof Error) {
    const anyError = error as any;
    if (anyError.status === 429 || (anyError.status >= 500 && anyError.status < 600)) {
      return true;
    }
  }

  return true;
}

/**
 * 获取重试延迟时间
 * 注意：此函数保持同步，因为所有检查逻辑都是同步的
 */
function getRetryDelay(
  error: unknown,
  attempt: number,
  baseDelay: number
): number {
  // 检查 Retry-After header
  if (error instanceof Response) {
    const retryAfter = error.headers?.get('retry-after');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
  }

  // 指数退避
  return calculateBackoff(attempt, baseDelay);
}

/**
 * 构建文件下载 URL
 */
export function getFileUrl(botToken: string, filePath: string): string {
  return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
}
