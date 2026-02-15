// Agent-vs-Agent 全自动测试 - 内联版本
// 我扮演用户人设，与 Karma Agent 进行多轮对话

import { StorageService } from '@/storage/service.js';
import { loadSkills } from '@/skills/loader.js';
import { SessionManager } from '@/session/manager.js';
import { AgentRunner } from '@/agent/runner.js';

// ============== 人设配置 ==============

interface Persona {
  name: string;
  gender: 'male' | 'female';
  birthDate: string;
  birthPlace: string;
  currentCity?: string;
  occupation?: string;
  concerns: string[];
}

// 李婷人设
const LI_TING: Persona = {
  name: '李婷',
  gender: 'female',
  birthDate: '1997年农历三月初八 早上6点多',
  birthPlace: '武汉',
  currentCity: '武汉',
  occupation: '教师',
  concerns: ['婚恋', '家庭压力'],
};

// 张伟人设
const ZHANG_WEI: Persona = {
  name: '张伟',
  gender: 'male',
  birthDate: '1991年公历8月17日中午12点',
  birthPlace: '湖南浏阳',
  currentCity: '深圳',
  occupation: '程序员',
  concerns: ['事业', '转型'],
};

// ============== 用户 Agent ==============

class UserAgent {
  private persona: Persona;
  private round: number = 0;
  private confirmedFacts: string[] = [];
  private masterOutputs: string[] = [];

  constructor(persona: Persona) {
    this.persona = persona;
  }

  // 获取下一轮输入
  getNextInput(masterOutput: string): string | null {
    this.round++;
    this.masterOutputs.push(masterOutput);

    console.log(`\n${'='.repeat(50)}`);
    console.log(`第 ${this.round} 轮`);
    console.log(`${'='.repeat(50)}`);
    console.log(`\n师傅说:\n${masterOutput}`);
    console.log(`\n---`);

    // 根据轮次和内容决定回应
    const response = this.generateResponse(masterOutput);

    if (response === 'EXIT') {
      return null;
    }

    console.log(`\n${this.persona.name}回应:\n${response}`);
    return response;
  }

  private generateResponse(masterOutput: string): string {
    const p = this.persona;
    const round = this.round;

    // 第一轮：提供基本信息
    if (round === 1) {
      return `${p.birthDate} ${p.gender === 'female' ? '女' : '男'} ${p.birthPlace}${p.currentCity ? ` 现在还在${p.currentCity}` : ''}${p.occupation ? ` 当${p.occupation}` : ''}`;
    }

    // 分析师傅的输出
    const hasAskedQuestion = /？|\?/.test(masterOutput);
    const hasMentionedMarriage = /婚|姻|感情|对象|男朋友|老公|催/.test(masterOutput);
    const hasMentionedCareer = /工作|事业|职业|做/.test(masterOutput);
    const hasPrediction = /(\d{2,4})年/.test(masterOutput);

    // 李婷的婚恋焦虑
    if (p.name === '李婷') {
      if (round === 2 && hasMentionedMarriage) {
        return '对对对，家里一直在催，但我一直没遇到合适的，感觉周围的人都结婚了就我没有';
      }
      if (round === 3) {
        return '那我什么时候能遇到？会是什么样的？';
      }
      if (round === 4) {
        return '好的我知道了，谢谢师傅';
      }
      if (round >= 5) {
        return 'EXIT';
      }
    }

    // 张伟的事业关注
    if (p.name === '张伟') {
      if (round === 2) {
        return '对，你说的这些都对。我是做技术工作的';
      }
      if (round === 3) {
        return '那28年的风口具体是什么？';
      }
      if (round === 4) {
        return '好的我知道了';
      }
      if (round >= 5) {
        return 'EXIT';
      }
    }

    // 默认：3轮后结束
    if (round >= 3) {
      return 'EXIT';
    }

    return '嗯，您继续说';
  }
}

// ============== 测试运行器 ==============

async function runTest(persona: Persona, maxRounds: number = 5) {
  console.log('\n' + '█'.repeat(60));
  console.log('  Agent-vs-Agent 全自动测试');
  console.log(`  人设: ${persona.name} (${persona.occupation || '未知职业'})`);
  console.log('█'.repeat(60) + '\n');

  // 1. 初始化
  const storage = new StorageService(':memory:');
  const sessionManager = new SessionManager(storage);

  // 加载 Skills
  const { skills } = await loadSkills({
    projectDir: process.cwd() + '/skills',
  });

  console.log(`已加载 ${skills.length} 个 Skills\n`);

  // 创建 Runner
  const runner = new AgentRunner({
    storage,
    sessionManager,
    skills,
    model: process.env.ANTHROPIC_MODEL || 'glm-5',
    baseUrl: process.env.ANTHROPIC_BASE_URL,
    authToken: process.env.ANTHROPIC_AUTH_TOKEN,
  });

  // 创建会话
  const session = await sessionManager.getOrCreateSession({
    platform: 'cli',
  });

  // 首次启动提示
  const GREETING_PROMPT = '一位新的客人到来了。请按照你的方法论开始接待。简单直接地向客人打招呼，请他们把生辰时间、性别和出生地发给你。';

  // 用户 Agent
  const userAgent = new UserAgent(persona);

  // 开始对话
  let userInput: string | null = GREETING_PROMPT;
  let round = 0;

  while (userInput !== null && round < maxRounds) {
    round++;

    // 收集师傅输出
    let masterOutput = '';
    try {
      for await (const text of runner.runText({
        userInput: userInput!,
        session,
      })) {
        masterOutput += text;
      }
    } catch (err: any) {
      console.error(`\n[错误] ${err.message}`);
      break;
    }

    // 获取用户回应
    userInput = userAgent.getNextInput(masterOutput);
  }

  // 测试结束
  console.log('\n' + '█'.repeat(60));
  console.log('  测试完成');
  console.log(`  共 ${round} 轮对话`);
  console.log('█'.repeat(60) + '\n');

  storage.close();
}

// ============== 运行 ==============

// 选择人设
const persona = process.argv[2] === 'zhangwei' ? ZHANG_WEI : LI_TING;
const maxRounds = parseInt(process.argv[3] || '5', 10);

runTest(persona, maxRounds).catch(console.error);
