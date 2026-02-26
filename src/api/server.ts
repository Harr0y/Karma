// Karma HTTP API Server
// 轻量级 HTTP 服务器，提供 API 给外部调用

import * as http from 'http';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { StorageService } from '../storage/index.js';
import { loadSkills } from '../skills/index.js';
import { SessionManager } from '../session/index.js';
import { AgentRunner } from '../agent/index.js';
import { PersonaService } from '../persona/index.js';
import { getConfig } from '../config/index.js';
import { getLogger, setLogger, createLogger, type Logger } from '../logger/index.js';
import { HttpAdapter } from '../platform/adapters/http/index.js';
import { TelegramAdapter } from '../platform/adapters/telegram/index.js';
import type { ActiveSession } from '../session/types.js';
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  ChatRequest,
  SSEMessage,
  GetHistoryResponse,
  APIError,
} from './types.js';

export interface ServerConfig {
  port?: number;
  host?: string;
}

// 首次启动提示
const GREETING_PROMPT =
  '一位新的客人到来了。请按照你的方法论开始接待。简单直接地向客人打招呼，请他们把生辰时间、性别和出生地发给你。不要搞仪式感，像真师傅一样随意自然。';

// 空响应兜底消息
const EMPTY_RESPONSE_FALLBACK = '嗯，请继续说...';

export class KarmaServer {
  private config: ReturnType<typeof getConfig>;
  private storage: StorageService;
  private sessionManager: SessionManager;
  private runner: AgentRunner;
  private personaService: PersonaService;
  private logger: Logger;
  private server?: http.Server;
  private httpAdapter: HttpAdapter;
  private telegramAdapter?: TelegramAdapter;
  private typingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(serverConfig?: ServerConfig) {
    // 初始化 Logger
    const logger = createLogger({
      program: {
        level: 'info',
        outputs: [{ type: 'console', colorize: true }],
      },
    });
    setLogger(logger);
    this.logger = logger.child({ module: 'api-server' });

    // 加载配置
    this.config = getConfig();

    // 确保目录存在
    const dbDir = dirname(this.config.storage.path);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    // 初始化组件
    this.storage = new StorageService(this.config.storage.path);
    this.sessionManager = new SessionManager(this.storage);
    this.personaService = new PersonaService({
      soulPath: join(process.cwd(), 'SOUL.md'),
      storage: this.storage,
    });

    // 初始化 HTTP 适配器
    this.httpAdapter = new HttpAdapter();

    // Runner 稍后在 async init 中创建（因为需要加载 skills）
    this.runner = null as any;
  }

  /**
   * 异步初始化（加载 skills 等）
   */
  async init(): Promise<void> {
    const skillDirs = this.config.skills.dirs.filter(existsSync);
    const { skills, errors } = await loadSkills({
      globalDir: skillDirs[0],
      projectDir: skillDirs[1] || undefined,
    });

    if (errors.length > 0) {
      for (const err of errors) {
        this.logger.warn('Skill 加载失败', {
          operation: 'skill_error',
          metadata: { path: err.filePath, error: err.error },
        });
      }
    }

    this.logger.info('Skills 加载完成', {
      operation: 'skills_loaded',
      metadata: { count: skills.length, names: skills.map((s) => s.name) },
    });

    this.runner = new AgentRunner({
      storage: this.storage,
      sessionManager: this.sessionManager,
      skills,
      personaService: this.personaService,
      model: this.config.ai.model,
      baseUrl: this.config.ai.baseUrl,
      authToken: this.config.ai.authToken,
      timeout: this.config.ai.timeout,
    });

    // 初始化 Telegram 适配器（如果配置了）
    if (this.config.telegram?.botToken && this.config.telegram?.enabled !== false) {
      this.telegramAdapter = new TelegramAdapter({
        botToken: this.config.telegram.botToken,
        enabled: this.config.telegram.enabled ?? true,
        maxMessageLength: this.config.telegram.maxMessageLength,
        apiRetryAttempts: this.config.telegram.apiRetryAttempts,
        apiRetryDelay: this.config.telegram.apiRetryDelay,
      });

      // 注册消息处理器
      this.telegramAdapter.onMessage(async (message) => {
        await this.handleTelegramMessage(message);
      });

      await this.telegramAdapter.start();

      this.logger.info('Telegram 适配器已初始化', {
        operation: 'telegram_init',
        metadata: { enabled: true },
      });
    }
  }

  /**
   * 启动服务器
   */
  start(options: ServerConfig = {}): Promise<void> {
    // 优先级：options > config > 默认值
    const port = options.port ?? this.config.server.port;
    const host = options.host ?? this.config.server.host;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', reject);

      this.server.listen(port, host, () => {
        this.logger.info('HTTP 服务器启动', {
          operation: 'server_start',
          metadata: { host, port },
        });
        console.log(`Karma API Server running at http://${host}:${port}`);
        resolve();
      });
    });
  }

  /**
   * 停止服务器
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      // 清理所有打字指示器
      for (const chatId of this.typingIntervals.keys()) {
        this.stopTypingIndicator(chatId);
      }

      // 停止 Telegram 适配器
      if (this.telegramAdapter) {
        this.telegramAdapter.stop().catch(() => {
          // 忽略错误
        });
      }

      if (this.server) {
        this.server.close(() => {
          this.storage.close();
          this.logger.info('HTTP 服务器关闭', { operation: 'server_stop' });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 处理 HTTP 请求
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = req.url || '/';
    const method = req.method || 'GET';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // 路由
      if (url === '/api/session' && method === 'POST') {
        await this.handleCreateSession(req, res);
      } else if (url === '/api/chat' && method === 'POST') {
        await this.handleChat(req, res);
      } else if (url.startsWith('/api/history/') && method === 'GET') {
        await this.handleGetHistory(req, res, url);
      } else if (url === '/health' || url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'karma-api' }));
      } else {
        this.sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
      }
    } catch (err: any) {
      this.logger.error('请求处理错误', err, { operation: 'request_error' });
      this.sendError(res, 500, 'INTERNAL_ERROR', err.message);
    }
  }

  /**
   * POST /api/session - 创建新会话
   */
  private async handleCreateSession(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const body = await this.readBody(req);
    const request: CreateSessionRequest = body ? JSON.parse(body) : {};

    const platform = 'http';  // HTTP API 固定使用 http 平台
    const externalChatId = request.userId || `http-${Date.now()}`;

    const session = await this.sessionManager.getOrCreateSession({
      platform: platform as any,
      externalChatId,
    });

    const response: CreateSessionResponse = {
      sessionId: session.id,
      createdAt: new Date().toISOString(),
    };

    this.logger.info('创建会话', {
      operation: 'session_create',
      sessionId: session.id,
      metadata: { platform, externalChatId },
    });

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  /**
   * POST /api/chat - 发送消息 (SSE 流式响应)
   */
  private async handleChat(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await this.readBody(req);
    if (!body) {
      this.sendError(res, 400, 'BAD_REQUEST', 'Request body required');
      return;
    }

    const request: ChatRequest = JSON.parse(body);

    if (!request.sessionId || !request.message) {
      this.sendError(res, 400, 'BAD_REQUEST', 'sessionId and message are required');
      return;
    }

    // 使用无状态会话策略获取会话
    let session: ActiveSession;
    try {
      session = await this.sessionManager.getOrCreateSession({
        platform: 'http',
        sessionId: request.sessionId,
        externalChatId: request.sessionId,
      });
    } catch (err: any) {
      if (err.message?.includes('Session not found')) {
        this.sendError(res, 404, 'NOT_FOUND', 'Session not found');
        return;
      }
      throw err;
    }

    // 设置 SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const sendSSE = (msg: SSEMessage) => {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    };

    try {
      // 如果是首次对话，先发送问候
      if (!session.sdkSessionId && !request.message.trim()) {
        // 空消息触发问候
        for await (const text of this.runner.runText({
          userInput: GREETING_PROMPT,
          session,
        })) {
          sendSSE({ type: 'text', content: text });
        }
        sendSSE({ type: 'done' });
        res.end();
        return;
      }

      // 正常对话
      let hasContent = false;
      for await (const msg of this.runner.run({ userInput: request.message, session })) {
        if (msg.type === 'text') {
          hasContent = true;
          sendSSE({ type: 'text', content: msg.content });
        }
        // 移除 tool_use 的发送，不暴露给用户
      }

      // 空响应处理（修复 P1 问题）
      if (!hasContent) {
        sendSSE({ type: 'text', content: EMPTY_RESPONSE_FALLBACK });
        this.logger.warn('空响应', {
          operation: 'empty_response',
          sessionId: session.id,
          metadata: { userInput: request.message.substring(0, 50) },
        });
      }

      sendSSE({ type: 'done' });
      res.end();
    } catch (err: any) {
      this.logger.error('Chat 错误', err, { operation: 'chat_error', sessionId: session.id });
      sendSSE({ type: 'error', error: err.message });
      res.end();
    }
  }

  /**
   * GET /api/history/:sessionId - 获取会话历史
   */
  private async handleGetHistory(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: string
  ): Promise<void> {
    const sessionId = url.replace('/api/history/', '');

    const dbSession = await this.storage.getSession(sessionId);
    if (!dbSession) {
      this.sendError(res, 404, 'NOT_FOUND', 'Session not found');
      return;
    }

    const messages = await this.storage.getSessionMessages(sessionId, 100);

    // 反转顺序（从旧到新）
    messages.reverse();

    const response: GetHistoryResponse = {
      sessionId,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.createdAt,
      })),
    };

    // 如果有关联客户，添加提取的信息
    if (dbSession.clientId) {
      const client = await this.storage.getClient(dbSession.clientId);
      if (client) {
        response.extractedInfo = {
          name: client.name ?? undefined,
          birthDate: client.birthDate ?? undefined,
          birthPlace: client.birthPlace ?? undefined,
        };
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  /**
   * 读取请求体
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  /**
   * 发送错误响应
   */
  private sendError(
    res: http.ServerResponse,
    status: number,
    code: string,
    message: string
  ): void {
    const error: APIError = { error: message, code };
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(error));
  }

  /**
   * 处理 Telegram 消息
   */
  private async handleTelegramMessage(message: { id: string; chatId: string; text?: string; userId?: string }): Promise<void> {
    if (!message.text) {
      return;
    }

    const chatId = message.chatId;

    // 启动打字指示器
    this.startTypingIndicator(chatId);

    try {
      // 获取或创建会话
      const session = await this.sessionManager.getOrCreateSession({
        platform: 'telegram',
        externalChatId: chatId,
      });

      // 运行 Agent
      let fullResponse = '';
      for await (const msg of this.runner.run({ userInput: message.text, session })) {
        if (msg.type === 'text') {
          fullResponse += msg.content;
        }
      }

      // 发送响应
      if (fullResponse && this.telegramAdapter) {
        await this.telegramAdapter.sendMessage(chatId, fullResponse);
      }
    } catch (err: any) {
      this.logger.error('Telegram 消息处理错误', err, {
        operation: 'telegram_message_error',
        metadata: { chatId },
      });

      // 发送错误提示
      if (this.telegramAdapter) {
        await this.telegramAdapter.sendMessage(chatId, '抱歉，处理您的消息时出现错误。请稍后再试。');
      }
    } finally {
      // 停止打字指示器
      this.stopTypingIndicator(chatId);
    }
  }

  /**
   * 启动打字指示器（每 5 秒发送一次）
   */
  private startTypingIndicator(chatId: string): void {
    // 先清除已有的
    this.stopTypingIndicator(chatId);

    // 立即发送一次
    if (this.telegramAdapter) {
      this.telegramAdapter.sendTypingIndicator(chatId).catch((err) => {
        this.logger.warn('发送打字指示器失败', { operation: 'typing_indicator', metadata: { error: err.message } });
      });
    }

    // 设置定时器，每 5 秒发送一次
    const interval = setInterval(() => {
      if (this.telegramAdapter) {
        this.telegramAdapter.sendTypingIndicator(chatId).catch(() => {
          // 忽略错误
        });
      }
    }, 5000);

    this.typingIntervals.set(chatId, interval);
  }

  /**
   * 停止打字指示器
   */
  private stopTypingIndicator(chatId: string): void {
    const interval = this.typingIntervals.get(chatId);
    if (interval) {
      clearInterval(interval);
      this.typingIntervals.delete(chatId);
    }
  }
}

/**
 * 启动服务器（CLI 入口）
 */
export async function startServer(options: ServerConfig = {}): Promise<KarmaServer> {
  const server = new KarmaServer(options);
  await server.init();
  await server.start(options);
  return server;
}
