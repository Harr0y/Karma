/**
 * 自动化测试脚本 #2
 * 测试人物：女性，1988年，上海外企白领，问感情和事业
 */
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { buildSystemPrompt } from './prompt.js';

const systemPrompt = buildSystemPrompt(new Date());

const baseOptions = {
  systemPrompt,
  tools: ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit'] as string[],
  permissionMode: 'bypassPermissions' as const,
  allowDangerouslySkipPermissions: true,
  maxTurns: 50,
  cwd: '/tmp',
  env: { ...process.env },
};

const TEST_INPUTS = [
  null,
  '我叫周晓薇，女，1988年5月12号出生，公历。出生在江苏南通，现在在上海生活。',
  '第一条挺准的，确实感觉被掏空了。第二条也有道理，不过2014年我没结婚，只是在谈恋爱。第三条很准，我确实想慢下来了。我想问问事业和感情。',
  '我现在跟一个朋友合伙开公司，她是主导的那个人。但最近越来越觉得合不来，她比较强势，经常改主意。我也不知道要不要继续。',
  '感情上我一直单身，之前那段恋爱分了之后就没怎么认真谈过了。有时候觉得一个人也挺好的，但偶尔还是会觉得孤独。',
];

let sessionId: string | undefined;
let turnIndex = 0;
let totalCost = 0;

function extractVisibleText(text: string): string {
  return text.replace(/<inner_monologue>[\s\S]*?<\/inner_monologue>/g, '').trim();
}

async function runTurn(prompt: string) {
  const label = turnIndex === 0 ? '🎬 开场' : `💬 用户第${turnIndex}轮`;
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${label}: ${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}`);
  console.log('═'.repeat(70));

  const q = query({
    prompt,
    options: {
      ...baseOptions,
      ...(sessionId ? { resume: sessionId } : {}),
    },
  });

  let fullAssistantText = '';
  let toolCalls: string[] = [];

  for await (const msg of q as AsyncIterable<SDKMessage>) {
    const m = msg as any;
    if (m.type === 'system' && m.subtype === 'init') {
      sessionId = m.session_id;
      if (turnIndex === 0) {
        console.log(`  [系统] Model: ${m.model} | Session: ${m.session_id.slice(0, 8)}...`);
      }
    }
    if (m.type === 'assistant' && m.message?.content) {
      for (const block of m.message.content) {
        if (block.type === 'text') fullAssistantText += block.text;
        if (block.type === 'tool_use') {
          toolCalls.push(`${block.name}(${JSON.stringify(block.input).slice(0, 120)})`);
        }
      }
    }
    if (m.type === 'result') {
      const cost = m.total_cost_usd || 0;
      totalCost += cost;
      console.log(`  [统计] 耗时: ${(m.duration_ms / 1000).toFixed(1)}s | Agent轮次: ${m.num_turns} | 费用: $${cost.toFixed(4)}`);
    }
  }

  if (toolCalls.length > 0) {
    console.log(`\n  📎 工具调用 (${toolCalls.length}次):`);
    for (const tc of toolCalls.slice(0, 10)) console.log(`     ${tc}`);
    if (toolCalls.length > 10) console.log(`     ... 还有 ${toolCalls.length - 10} 次`);
  }

  const monologues: string[] = [];
  for (const match of fullAssistantText.matchAll(/<inner_monologue>([\s\S]*?)<\/inner_monologue>/g)) {
    monologues.push(match[1].trim());
  }
  if (monologues.length > 0) {
    const combined = monologues.join('\n---\n');
    console.log(`\n  🧠 Inner Monologue:`);
    const lines = combined.split('\n').slice(0, 25);
    for (const line of lines) console.log(`     ${line.slice(0, 100)}`);
    if (combined.split('\n').length > 25) console.log('     ... (截断)');
  }

  const visibleText = extractVisibleText(fullAssistantText);
  if (visibleText) {
    console.log(`\n  🔮 大师说:`);
    for (const line of visibleText.split('\n')) {
      if (line.trim()) console.log(`     ${line.trim()}`);
    }
  }

  turnIndex++;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Karmav2 测试#2 — 周晓薇, 女, 1988, 南通→上海, 合伙创业+单身    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // 先清除上一次的状态文件
  try { (await import('fs')).unlinkSync('/tmp/karma_state.json'); } catch {}

  try {
    for (const input of TEST_INPUTS) {
      const prompt = input ?? '一位新的客人到来了。请按照你的方法论开始接待。用温和有仪式感的方式向客人打招呼，并收集他们的基本信息。';
      await runTurn(prompt);
    }
  } catch (err: any) {
    console.error(`\n❌ 测试在第 ${turnIndex + 1} 轮失败: ${err.message}`);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`✅ 测试完成 | 总轮次: ${turnIndex} | 总费用: $${totalCost.toFixed(4)}`);
  console.log('═'.repeat(70));

  try {
    const state = (await import('fs')).readFileSync('/tmp/karma_state.json', 'utf-8');
    console.log(`\n📋 状态文件 /tmp/karma_state.json:`);
    console.log(state.slice(0, 3000));
    if (state.length > 3000) console.log('...(截断)');
  } catch {
    console.log('\n⚠️  状态文件未创建');
  }
}

main().catch(console.error);
