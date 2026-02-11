/**
 * 简化测试 — 只跑一轮，打印所有消息用于调试
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { buildSystemPrompt } from './prompt.js';

const systemPrompt = buildSystemPrompt(new Date());

async function main() {
  console.log('=== 单轮测试 ===\n');

  const q = query({
    prompt: '一位新的客人到来了。请按照你的方法论开始接待。用温和有仪式感的方式向客人打招呼，并收集他们的基本信息。',
    options: {
      systemPrompt,
      tools: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit'] as string[],
      permissionMode: 'bypassPermissions' as const,
      allowDangerouslySkipPermissions: true,
      maxTurns: 5,
      cwd: '/tmp',
      env: { ...process.env },
    },
  });

  let msgCount = 0;
  for await (const msg of q) {
    msgCount++;
    const m = msg as any;

    // 打印每条消息的类型和关键信息
    if (m.type === 'system' && m.subtype === 'init') {
      console.log(`[${msgCount}] SYSTEM INIT | session=${m.session_id} | model=${m.model}`);
      console.log(`    tools: ${m.tools?.join(', ')}`);
    } else if (m.type === 'assistant') {
      const content = m.message?.content || [];
      for (const block of content) {
        if (block.type === 'text') {
          console.log(`[${msgCount}] ASSISTANT TEXT:`);
          // 打印完整文本（包括 inner_monologue），但截断到2000字
          const text = block.text as string;
          console.log(text.slice(0, 2000));
          if (text.length > 2000) console.log('...(截断)');
        } else if (block.type === 'tool_use') {
          console.log(`[${msgCount}] TOOL_USE: ${block.name}(${JSON.stringify(block.input).slice(0, 200)})`);
        } else if (block.type === 'thinking') {
          console.log(`[${msgCount}] THINKING: ${(block.thinking as string)?.slice(0, 500)}...`);
        } else {
          console.log(`[${msgCount}] ASSISTANT BLOCK: type=${block.type}`);
        }
      }
    } else if (m.type === 'user') {
      console.log(`[${msgCount}] USER (tool result)`);
    } else if (m.type === 'result') {
      console.log(`[${msgCount}] RESULT | subtype=${m.subtype} | turns=${m.num_turns} | cost=$${m.total_cost_usd?.toFixed(4)} | time=${(m.duration_ms / 1000).toFixed(1)}s`);
      if (m.result) {
        console.log(`    result text: ${(m.result as string).slice(0, 500)}`);
      }
      if (m.subtype !== 'success') {
        console.log(`    error: ${JSON.stringify(m)}`);
      }
    } else if (m.type === 'tool_progress') {
      // 不打印太多
    } else {
      console.log(`[${msgCount}] ${m.type} ${m.subtype || ''}`);
    }
  }

  console.log(`\n总消息数: ${msgCount}`);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  if (err.stack) console.error(err.stack);
});
