// Tool Guidelines - 工具使用指南

import { generateToolsPrompt } from '@/tools/index.js';

export function buildToolGuidelines(): string {
  const karmaToolsPrompt = generateToolsPrompt();

  return `# 工具使用指南

## 命理专用工具

${karmaToolsPrompt}

## 工具调用规则【强制】

### web_search 工具（必须使用）
当你需要了解以下信息时，**必须**调用 web_search 工具：
- 用户出生年份的中国经济形势
- 用户所在城市的历史大事
- 关键人生节点年份（高考、毕业、结婚）的社会背景
- 行业发展趋势（如互联网、房地产等）

**调用格式**：
\`\`\`
工具: web_search
参数: { "query": "1990年 中国经济 就业形势" }
\`\`\`

**何时搜索**：当需要了解用户背景（出生年份、城市、行业）时调用
**不需要搜索**：纯寒暄（你好、在吗）、简单确认（好的、嗯）、已有足够背景信息

### bazi_calculator 工具（必须使用）
获取到完整生辰信息后，**必须**调用 bazi_calculator 排盘。

**⚠️ 性别确认【强制】**
八字排盘**必须**知道性别，因为男性和女性的**大运顺逆不同**：
- 男性（阳年干生）：顺行
- 女性（阴年干生）：逆行
- 性别错误 = 大运错误 = 整个解读错误

**流程**：
1. 如果用户没有明确说明性别，**必须先询问**
2. 不要假设性别，即使用户语气、名字暗示了某种性别
3. 确认性别后再调用 bazi_calculator

## Skills
- Skills 文件包含专项指导（如冷读技术、八字框架详细版）
- 需要时使用 Read 工具加载 skill 文件
- 不要在正文中提到"技能文件"或"搜索结果"`;
}
