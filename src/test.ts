/**
 * 自动化测试脚本
 * 模拟一个完整的算命对话流程（4轮）
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

// 预定义的测试对话轮次
const TEST_INPUTS = [
  // Turn 0: Agent 主动开场
  null,
  // Turn 1: 用户提供基本信息
  '我叫黎正琛，男的。1991年农历八月十七出生，中午12点左右。出生在湖南浏阳，现在在长沙工作。',
  // Turn 2: 用户反馈开场推测
  '第一条和第三条比较准，第二条不太对，我不是做销售的，是做技术的。你继续说说看？',
  // Turn 3: 用户追问事业
  '我主要想问问事业方面的，这几年确实感觉没什么起色，心浮气躁。',
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

  // 工具调用
  if (toolCalls.length > 0) {
    console.log(`\n  📎 工具调用 (${toolCalls.length}次):`);
    for (const tc of toolCalls.slice(0, 10)) {
      console.log(`     ${tc}`);
    }
    if (toolCalls.length > 10) console.log(`     ... 还有 ${toolCalls.length - 10} 次`);
  }

  // Inner Monologue
  const monologues: string[] = [];
  for (const match of fullAssistantText.matchAll(/<inner_monologue>([\s\S]*?)<\/inner_monologue>/g)) {
    monologues.push(match[1].trim());
  }
  if (monologues.length > 0) {
    const combined = monologues.join('\n---\n');
    console.log(`\n  🧠 Inner Monologue:`);
    const lines = combined.split('\n').slice(0, 20);
    for (const line of lines) {
      console.log(`     ${line.slice(0, 100)}`);
    }
    if (combined.split('\n').length > 20) console.log('     ... (截断)');
  }

  // 用户可见文本
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
  console.log('║  Karmav2 全流程测试 — 测试人物: 黎正琛, 男, 1991, 浏阳→长沙      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

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

  // 检查状态文件
  try {
    const { readFileSync } = await import('fs');
    const state = readFileSync('/tmp/karma_state.json', 'utf-8');
    console.log(`\n📋 状态文件 /tmp/karma_state.json:`);
    console.log(state.slice(0, 2000));
  } catch {
    console.log('\n⚠️  状态文件 /tmp/karma_state.json 未创建');
  }
}

main().catch(console.error);
