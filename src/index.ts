#!/usr/bin/env node
// Karma CLI Entry Point

import * as readline from 'readline';
import { mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { StorageService } from './storage/index.js';
import { loadSkills } from './skills/index.js';
import { SessionManager } from './session/index.js';
import { PiAgentRunner } from './agent/index.js';
import { createBaziTool } from './tools/pi-tools.js';
import { getConfig } from './config/index.js';
import { getLogger, setLogger, createLogger } from './logger/index.js';
import { startServer } from './api/index.js';

// 首次启动提示
const GREETING_PROMPT = '一位新的客人到来了。请按照你的方法论开始接待。简单直接地向客人打招呼，请他们把生辰时间、性别和出生地发给你。不要搞仪式感，像真师傅一样随意自然。';

function printUsage() {
  console.log(`
  \x1b[33m✦ Karma 命理师 ✦\x1b[0m

  用法:
    karma              启动交互式 REPL
    karma server       启动 HTTP API 服务器
    karma --help       显示帮助信息

  服务器选项:
    --port <number>    指定端口 (默认: 配置文件 server.port 或 3080)
    --host <string>    指定主机 (默认: 配置文件 server.host 或 0.0.0.0)

  配置文件:
    ~/.karma/config.yaml 或 ./config.yaml
`);
}

async function main() {
  const args = process.argv.slice(2);

  // 解析参数
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // server 子命令
  if (args[0] === 'server') {
    const config = getConfig();
    const portIndex = args.indexOf('--port');
    const hostIndex = args.indexOf('--host');

    // 优先级：命令行参数 > 环境变量 > 配置文件 > 默认值
    const port = portIndex !== -1 ? parseInt(args[portIndex + 1], 10) : config.server.port;
    const host = hostIndex !== -1 ? args[hostIndex + 1] : config.server.host;

    console.log('\n  \x1b[33m✦ Karma API Server ✦\x1b[0m\n');
    console.log(`启动中... (端口: ${port})\n`);

    await startServer({ port, host });

    // 保持进程运行
    process.on('SIGINT', async () => {
      console.log('\n正在关闭...');
      process.exit(0);
    });

    return;
  }

  // 默认：启动 REPL
  // CLI 欢迎信息（保留，这是用户可见的输出）
  console.log('\n  \x1b[33m✦ Karma 命理师 ✦\x1b[0m\n');

  // 初始化 Logger
  const logger = createLogger({
    program: {
      level: 'debug',
      outputs: [{ type: 'console', colorize: true }],
    },
  });
  setLogger(logger);

  const mainLogger = logger.child({ module: 'system' });
  const getDuration = mainLogger.startTimer('startup');

  mainLogger.info('开始初始化', { operation: 'startup' });

  // 加载配置
  const config = getConfig();
  mainLogger.debug('配置加载完成', {
    operation: 'config_load',
    metadata: {
      model: config.ai.model,
      baseUrl: config.ai.baseUrl,
      hasAuthToken: !!config.ai.authToken,
    },
  });

  // 显示配置信息（CLI 用户可见）
  console.log(`模型: ${config.ai.model}`);
  console.log(`API: ${config.ai.baseUrl}`);
  console.log();

  // 确保目录存在
  const dbDir = dirname(config.storage.path);
  if (!existsSync(dbDir)) {
    mainLogger.debug('创建数据库目录', { operation: 'mkdir', metadata: { path: dbDir } });
    mkdirSync(dbDir, { recursive: true });
  }

  // 1. 初始化组件
  mainLogger.debug('初始化 Storage', { operation: 'storage_init' });
  const storage = new StorageService(config.storage.path);

  mainLogger.debug('初始化 SessionManager', { operation: 'session_init' });
  const sessionManager = new SessionManager(storage);

  // 2. 加载 Skills
  mainLogger.debug('加载 Skills', { operation: 'skills_load' });
  const skillDirs = config.skills.dirs.filter(existsSync);

  const { skills, errors } = await loadSkills({
    globalDir: skillDirs[0],
    projectDir: skillDirs[1] || undefined,
  });

  if (errors.length > 0) {
    console.log('\x1b[33mSkills 加载警告:\x1b[0m');
    for (const err of errors) {
      console.log(`  - ${err.filePath}: ${err.error}`);
      mainLogger.warn('Skill 加载失败', {
        operation: 'skill_error',
        metadata: { path: err.filePath, error: err.error },
      });
    }
    console.log();
  }

  mainLogger.info('Skills 加载完成', {
    operation: 'skills_loaded',
    metadata: { count: skills.length, names: skills.map(s => s.name) },
  });
  console.log(`已加载 ${skills.length} 个 Skills:`, skills.map(s => s.name).join(', '));
  console.log();

  // 4. 创建 PiAgentRunner
  mainLogger.info('初始化 PiAgentRunner', { operation: 'runner_init' });
  const runner = new PiAgentRunner({
    storage,
    sessionManager,
    skills,
    model: config.ai.model,
    baseUrl: config.ai.baseUrl,
    authToken: config.ai.authToken,
    timeout: config.ai.timeout,
    tools: [createBaziTool()],
  });

  // 5. 获取/创建会话
  mainLogger.debug('获取/创建会话', { operation: 'session_get' });
  const session = await sessionManager.getOrCreateSession({
    platform: 'cli',
  });

  mainLogger.info('会话就绪', {
    operation: 'session_ready',
    sessionId: session.id,
    metadata: { hasSdkSession: !!session.sdkSessionId },
  });

  // 6. 首次启动 - Agent 主动开场
  if (!session.sdkSessionId) {
    mainLogger.info('首次启动，Agent 主动开场', { operation: 'greeting' });
    console.log('\x1b[36m师傅:\x1b[0m');

    try {
      for await (const text of runner.runText({
        userInput: GREETING_PROMPT,
        session,
      })) {
        process.stdout.write(text);
      }
      console.log('\n');
      mainLogger.debug('Agent 响应完成', { operation: 'greeting_complete' });
    } catch (err: any) {
      mainLogger.error('Agent 响应出错', err, { operation: 'greeting_error' });
    }
  } else {
    console.log('已恢复之前的会话\n');
  }

  // 7. REPL 循环
  mainLogger.debug('进入 REPL 循环', { operation: 'repl_start' });
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  while (true) {
    let userInput: string;
    try {
      userInput = await question('\x1b[36m你: \x1b[0m');
    } catch {
      break;
    }

    // 退出
    if (userInput.trim().toLowerCase() === 'exit' || userInput.trim() === '退出') {
      console.log('\n  \x1b[33m✦ 师傅已退出 ✦\x1b[0m\n');
      mainLogger.info('用户退出', { operation: 'exit' });
      break;
    }

    if (userInput.trim().length === 0) continue;

    // 运行 Agent
    console.log('\n\x1b[36m师傅:\x1b[0m');
    try {
      for await (const text of runner.runText({
        userInput,
        session,
      })) {
        process.stdout.write(text);
      }
      console.log('\n');
    } catch (err: any) {
      mainLogger.error('Agent 运行出错', err, { operation: 'run_error' });
      console.error(`\n\x1b[31m出错了: ${err.message}\x1b[0m\n`);
    }
  }

  // 清理
  rl.close();
  storage.close();

  const duration = getDuration();
  mainLogger.info('程序退出', { operation: 'shutdown', duration });
}

main().catch((err) => {
  console.error(`致命错误: ${err.message}`);
  process.exit(1);
});
