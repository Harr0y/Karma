#!/usr/bin/env node
// Karma CLI Entry Point

import * as readline from 'readline';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { StorageService } from './storage/index.js';
import { loadSkills } from './skills/index.js';
import { SessionManager } from './session/index.js';
import { AgentRunner } from './agent/index.js';
import { getConfig } from './config/index.js';

// 首次启动提示
const GREETING_PROMPT = '一位新的客人到来了。请按照你的方法论开始接待。简单直接地向客人打招呼，请他们把生辰时间、性别和出生地发给你。不要搞仪式感，像真师傅一样随意自然。';

async function main() {
  console.log('\n  \x1b[33m✦ Karma 命理师 ✦\x1b[0m\n');
  console.log('[Main] 开始初始化...');

  // 加载配置
  console.log('[Main] 加载配置...');
  const config = getConfig();
  console.log(`模型: ${config.ai.model}`);
  console.log(`API: ${config.ai.baseUrl}`);
  console.log(`authToken: ${config.ai.authToken ? config.ai.authToken.substring(0, 10) + '...' : '(未设置)'}`);
  console.log();

  // 确保目录存在
  const dbDir = dirname(config.storage.path);
  if (!existsSync(dbDir)) {
    console.log('[Main] 创建数据库目录:', dbDir);
    mkdirSync(dbDir, { recursive: true });
  }

  // 1. 初始化组件
  console.log('[Main] 初始化 Storage...');
  const storage = new StorageService(config.storage.path);
  console.log('[Main] 初始化 SessionManager...');
  const sessionManager = new SessionManager(storage);

  // 2. 加载 Skills
  console.log('[Main] 加载 Skills...');
  const skillDirs = config.skills.dirs.filter(existsSync);
  console.log('[Main] Skills 目录:', skillDirs);

  const { skills, errors } = await loadSkills({
    globalDir: skillDirs[0],
    projectDir: skillDirs[1] || undefined,
  });

  if (errors.length > 0) {
    console.log('\x1b[33mSkills 加载警告:\x1b[0m');
    for (const err of errors) {
      console.log(`  - ${err.filePath}: ${err.error}`);
    }
    console.log();
  }

  console.log(`已加载 ${skills.length} 个 Skills:`, skills.map(s => s.name).join(', '));
  console.log();

  // 3. 创建 Runner
  console.log('[Main] 创建 AgentRunner...');
  const runner = new AgentRunner({
    storage,
    sessionManager,
    skills,
    model: config.ai.model,
    baseUrl: config.ai.baseUrl,
    authToken: config.ai.authToken,
  });

  // 4. 获取/创建会话
  console.log('[Main] 获取/创建会话...');
  const session = await sessionManager.getOrCreateSession({
    platform: 'cli',
  });
  console.log('[Main] 会话 ID:', session.id);
  console.log('[Main] SDK 会话 ID:', session.sdkSessionId || '(无)');

  // 5. 首次启动 - Agent 主动开场
  if (!session.sdkSessionId) {
    console.log('[Main] 首次启动，Agent 主动开场...');
    console.log('\x1b[36m师傅:\x1b[0m');

    try {
      for await (const text of runner.runText({
        userInput: GREETING_PROMPT,
        session,
      })) {
        process.stdout.write(text);
      }
      console.log('\n');
      console.log('[Main] Agent 响应完成');
    } catch (err: any) {
      console.error('\n[Main] Agent 响应出错:', err.message);
      console.error('[Main] 堆栈:', err.stack);
    }
  } else {
    console.log('已恢复之前的会话\n');
  }

  // 6. REPL 循环
  console.log('[Main] 进入 REPL 循环...');
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
      console.error(`\n\x1b[31m出错了: ${err.message}\x1b[0m\n`);
    }
  }

  // 清理
  rl.close();
  storage.close();
}

main().catch((err) => {
  console.error(`致命错误: ${err.message}`);
  console.error(`堆栈: ${err.stack}`);
  process.exit(1);
});
