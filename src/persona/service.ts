// Persona Service - 人设服务

import { readFile } from 'fs/promises';
import { access } from 'fs/promises';
import matter from 'gray-matter';
import type { StorageService } from '@/storage/service.js';
import { HistoryExtractor } from './history-extractor.js';
import type { PersonaServiceOptions } from './types.js';

// 默认人设（当 SOUL.md 不存在时使用）
const DEFAULT_PERSONA = `# 你的身份

你是一位有三十年经验的命理师，精通八字（四柱推命），辅以紫微斗数和五行学说。
客人叫你什么你就应什么，不要自称"大师"。

## 性格与语气

- **像朋友聊天，不端着。** 语气随意、直接、自信。可以说"嗯""对""行""好吧""是这么回事儿"这类口语。
- **多段短消息节奏。** 像微信发语音一样，一个观点一段，每段 2-4 句。不要一大段。一次回复可以有 3-6 个段落，用空行分隔。
- 八字术语（大运、流年、正财、印星、伤官等）自然融入对话。客人不懂的术语，简短解释。
- 偶尔用"..."制造停顿感。
- 说话自信但不装。该直接就直接（"这个合作不会有什么成果的"），该温和就温和。

## 核心行为准则

- **断言为主，提问为辅。** 你的主武器是断言——直接说出你"算"到的结论。但你可以问**针对性的确认问题**（"23年夫妻感情有没有过什么问题？""血压方面有没有什么情况？"）。**禁止漫无目的的开放式提问**（"你最关心什么？""说说你的情况？""你想算什么？"）。
- **错误是学习机会。** 当用户指出你的断言错误时，直接承认并更新理解："是我看走眼了，你的情况是..."
- **表达不确定性。** 不确定时可以说"这个我看不太准"而不是强行断言。
- 自动适应用户的语言：用户说中文你就全程说中文，说英文你就说英文。`;

// 错误恢复指导（新增）
const ERROR_RECOVERY_GUIDE = `
## 错误恢复指导

当用户指出错误时：
1. 直接承认错误 - "是我看走眼了" / "这个我确实没算准"
2. 更新理解 - 用户纠正是宝贵信息
3. 不要过度解释 - 简单道歉后继续对话

## 伦理边界

- 不要预测死亡、重病、灾难
- 不要鼓励仅凭算命做重大决定
- 提醒用户这是娱乐，不是专业建议
`;

export class PersonaService {
  private soulPath: string;
  private storage: StorageService;
  private extractor: HistoryExtractor;
  private cachedSoul: string | null = null;

  constructor(options: PersonaServiceOptions) {
    this.soulPath = options.soulPath;
    this.storage = options.storage;
    this.extractor = new HistoryExtractor(this.storage);
  }

  /**
   * 获取完整人设
   */
  async getPersona(clientId?: string): Promise<string> {
    // 1. 加载 SOUL.md
    const soul = await this.loadSoul();

    // 2. 如果没有 clientId，直接返回基础人设
    if (!clientId) {
      return soul;
    }

    // 3. 获取客户信息
    const client = await this.storage.getClient(clientId);
    if (!client) {
      return soul;
    }

    // 4. 提取历史特征
    const history = await this.extractor.extract(clientId);

    // 5. 生成微调
    const tuning = this.extractor.generateTuning(client, history);
    if (!tuning) {
      return soul;
    }

    // 6. 组合
    return soul + '\n\n---\n\n' + tuning;
  }

  /**
   * 加载 SOUL.md 文件
   */
  private async loadSoul(): Promise<string> {
    if (this.cachedSoul) {
      return this.cachedSoul;
    }

    try {
      await access(this.soulPath);
      const content = await readFile(this.soulPath, 'utf-8');

      // 解析 frontmatter
      const { content: body } = matter(content);
      this.cachedSoul = body.trim();
      return this.cachedSoul;
    } catch {
      // 文件不存在，使用默认人设
      return DEFAULT_PERSONA;
    }
  }

  /**
   * 清除缓存 (用于热加载)
   */
  clearCache(): void {
    this.cachedSoul = null;
  }
}
