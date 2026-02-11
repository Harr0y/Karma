import { query } from '@anthropic-ai/claude-agent-sdk';
import { createInterface } from 'readline/promises';
import { buildSystemPrompt } from './prompt.js';

// ---------------------------------------------------------------------------
// 戏剧感 Spinner
// ---------------------------------------------------------------------------
const MYSTICAL_MESSAGES = [
  '正在排盘...',
  '感应流年气场...',
  '紫微星动，推演小限...',
  '五行能量校准中...',
  '天干地支交汇，解读命局...',
  '星象流转，捕捉关键节点...',
  '掐指一算...',
  '查阅万年历...',
  '感应命宫能量...',
  '推演大运流年...',
];

const SPINNER_CHARS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function clearLine() {
  process.stdout.write('\r\x1b[K');
}

function showMysticalSpinner(): ReturnType<typeof setInterval> {
  const msg = MYSTICAL_MESSAGES[Math.floor(Math.random() * MYSTICAL_MESSAGES.length)];
  let i = 0;
  return setInterval(() => {
    process.stdout.write(`\r  \x1b[33m${SPINNER_CHARS[i++ % SPINNER_CHARS.length]} ${msg}\x1b[0m`);
  }, 100);
}

// ---------------------------------------------------------------------------
// <inner_monologue> 流式过滤器
// ---------------------------------------------------------------------------
class MonologueFilter {
  private buffer = '';
  private insideMonologue = false;
  private hasOutput = false;

  /** 处理一段文本，只输出 inner_monologue 标签外的内容 */
  process(text: string): void {
    this.buffer += text;

    while (this.buffer.length > 0) {
      if (this.insideMonologue) {
        // 在 monologue 内部，查找结束标签
        const endIdx = this.buffer.indexOf('</inner_monologue>');
        if (endIdx !== -1) {
          this.buffer = this.buffer.slice(endIdx + '</inner_monologue>'.length);
          this.insideMonologue = false;
        } else {
          // 结束标签可能还没到，保留尾部（可能是部分标签）
          const keepLen = '</inner_monologue>'.length;
          if (this.buffer.length > keepLen) {
            this.buffer = this.buffer.slice(-keepLen);
          }
          break;
        }
      } else {
        // 在 monologue 外部，查找开始标签
        const startIdx = this.buffer.indexOf('<inner_monologue>');
        if (startIdx !== -1) {
          // 输出标签前的内容
          const before = this.buffer.slice(0, startIdx);
          if (before.length > 0) {
            this.emit(before);
          }
          this.buffer = this.buffer.slice(startIdx + '<inner_monologue>'.length);
          this.insideMonologue = true;
        } else {
          // 没有开始标签，但可能有部分标签在尾部
          const potentialTagStart = this.buffer.lastIndexOf('<');
          if (potentialTagStart !== -1 && potentialTagStart > this.buffer.length - '<inner_monologue>'.length) {
            // 安全输出确定不是标签的部分
            const safe = this.buffer.slice(0, potentialTagStart);
            if (safe.length > 0) {
              this.emit(safe);
            }
            this.buffer = this.buffer.slice(potentialTagStart);
            break;
          } else {
            // 全部安全
            this.emit(this.buffer);
            this.buffer = '';
          }
        }
      }
    }
  }

  /** 刷新剩余内容 */
  flush(): void {
    if (!this.insideMonologue && this.buffer.length > 0) {
      this.emit(this.buffer);
      this.buffer = '';
    }
  }

  get hadOutput(): boolean {
    return this.hasOutput;
  }

  private emit(text: string) {
    // 跳过纯空白
    const trimmed = text.trim();
    if (trimmed.length === 0 && !this.hasOutput) return;

    process.stdout.write(text);
    this.hasOutput = true;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let sessionId: string | undefined;

  // 注入当前精确时间的 system prompt
  const systemPrompt = buildSystemPrompt(new Date());

  console.log('\n  \x1b[33m✦ Karma 大师 ✦\x1b[0m\n');

  const baseOptions = {
    systemPrompt,
    tools: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit'] as string[],
    permissionMode: 'bypassPermissions' as const,
    allowDangerouslySkipPermissions: true,
    maxTurns: 50,
    cwd: '/tmp',
    env: { ...process.env },
  };

  // --- 处理一轮 Agent 输出 ---
  async function processAgentTurn(q: AsyncIterable<any>) {
    const filter = new MonologueFilter();
    let spinner: ReturnType<typeof setInterval> | null = null;
    let spinnerActive = false;

    for await (const msg of q) {
      // 捕获 session_id
      if (msg.type === 'system' && msg.subtype === 'init') {
        sessionId = msg.session_id;
      }

      // 工具调用/工具进度 → 显示 spinner
      if ((msg.type === 'tool_progress' || msg.type === 'tool_use_summary') && !spinnerActive) {
        spinner = showMysticalSpinner();
        spinnerActive = true;
      }

      if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'tool_use' && !spinnerActive) {
            spinner = showMysticalSpinner();
            spinnerActive = true;
          }
          if (block.type === 'text') {
            // 有文本输出，停止 spinner
            if (spinnerActive && spinner) {
              clearInterval(spinner);
              spinner = null;
              spinnerActive = false;
              clearLine();
            }
            filter.process(block.text);
          }
        }
      }

      // result 消息：Agent 本轮结束
      if (msg.type === 'result') {
        if (spinnerActive && spinner) {
          clearInterval(spinner);
          spinner = null;
          spinnerActive = false;
          clearLine();
        }
      }
    }

    filter.flush();
    if (filter.hadOutput) {
      console.log(); // 换行
    }
  }

  // --- 第一轮：Agent 主动开场 ---
  try {
    await processAgentTurn(
      query({
        prompt: '一位新的客人到来了。请按照你的方法论开始接待。用温和有仪式感的方式向客人打招呼，并收集他们的基本信息。',
        options: baseOptions,
      }),
    );
  } catch (err: any) {
    console.error(`\n\x1b[31m启动失败: ${err.message}\x1b[0m`);
    rl.close();
    return;
  }

  // --- 多轮对话循环 ---
  while (true) {
    let userInput: string;
    try {
      userInput = await rl.question('\n\x1b[36m你: \x1b[0m');
    } catch {
      break; // EOF or SIGINT
    }

    if (userInput.trim().toLowerCase() === 'exit' || userInput.trim() === '退出') {
      console.log('\n  \x1b[33m✦ Karma 大师已退出 ✦\x1b[0m\n');
      break;
    }

    if (userInput.trim().length === 0) continue;

    try {
      await processAgentTurn(
        query({
          prompt: userInput,
          options: {
            ...baseOptions,
            resume: sessionId,
          },
        }),
      );
    } catch (err: any) {
      console.error(`\n\x1b[31m出错了: ${err.message}\x1b[0m`);
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error(`致命错误: ${err.message}`);
  process.exit(1);
});
