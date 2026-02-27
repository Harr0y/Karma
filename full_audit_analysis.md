# Karma 英文测试完整问题分析

## 一、语言相关问题

### 1.1 语言切换延迟 ⚠️

**问题描述**：首轮模型用中文回复，用户抱怨后才切换英文

**审计证据** (Round 1 → Round 2):
```
Round 1 输出:
"好，盘排出来了。1990年3月15日，早上6点，纽约..."
（全是中文）

Round 2 用户反馈:
"Sorry, I don't understand Chinese"

Round 2 模型反应:
<inner_monologue>
Ah, the user speaks English only. I need to switch to English completely.
</inner_monologue>
```

**根因分析**：
- 模型默认使用中文，因为 prompt 是中文写的
- 没有根据用户输入语言自动检测

**建议修复**：
- 在 system prompt 中添加语言检测规则
- 或在首轮就根据输入语言匹配输出语言

---

### 1.2 八字术语的英文表达 📊

| 中文术语 | 英文表达 | 评估 |
|---------|---------|------|
| 己土日主 | Ji Earth day master | ✅ 可理解 |
| 卯（兔）| Rabbit branches | ✅ 翻译得当 |
| 木气/木旺 | Wood energy | ✅ 直译 |
| 印星 | Resource star | ⚠️ 需解释 |
| 大运 | Da Yun / luck cycle | ⚠️ 混用 |
| 桃花 | Peach Blossom | ✅ 直译 |
| 三卯争合 | Three Mao competing | ⚠️ 拼音+英文 |
| 庚午/己卯 | Geng Wu / Ji Mao | ✅ 拼音 |

**问题**：
- "Resource star" 对英语用户来说很陌生，需要每次解释
- "Da Yun" 和 "luck cycle" 混用，不一致

**建议**：
- 统一术语翻译策略
- 首次使用时附带简短解释
- 考虑添加术语对照表到 prompt

---

### 1.3 文化背景解释不足 ⚠️

**观察**：模型直接使用八字概念，但英语用户可能不理解底层逻辑

**示例** (Round 2):
```
"Three Rabbit branches. In this system, Rabbit represents romance, relationships."
```

**优点**：给出了简短解释
**不足**：没有解释为什么 Rabbit 代表 romance（需要十二生肖基础知识）

---

## 二、工具调用问题

### 2.1 工具调用结果未记录 ❌

**问题描述**：审计日志只记录了 agent 的输出，没有记录工具调用的返回结果

**现有记录**：
```json
{
  "action": "agent_response_raw",
  "details": {
    "rawContent": "...<inner_monologue>Got the chart...</inner_monologue>..."
  }
}
```

**缺失信息**：
- bazi_calculator 返回的原始八字数据格式
- web_search 返回的搜索结果内容
- 工具调用耗时

**建议**：
- 在 agent 运行日志中添加 `tool_result` 事件类型
- 记录工具返回的原始 JSON

---

### 2.2 工具结果如何被模型使用 🔍

**从 inner_monologue 推断**：

Round 1 工具调用后：
```
<inner_monologue>
Got the chart. Let me analyze:

八字：庚午 己卯 己卯 丁卯

- 年柱：庚午（金坐火）
- 月柱：己卯（土坐木）
- 日柱：己卯（日主己土坐卯木）
- 时柱：丁卯（火坐木）
...
</inner_monologue>
```

**推断**：
1. bazi_calculator 返回了结构化的八字数据
2. 模型能够解析并在 inner_monologue 中整理
3. 然后用这些信息生成用户可见的回复

**问题**：我们无法验证这个推断，因为工具结果没有被记录

---

### 2.3 搜索工具使用情况

**英文测试调用**：
- bazi_calculator: 1 次
- web_search: 2 次

**搜索内容推断** (从 inner_monologue)：
1. "1990 birth year context"
2. "New York in the early 90s"

**问题**：
- 搜索结果没有被记录
- 不清楚搜索结果对回复的影响程度
- 模型说"搜索没有返回结果"，但不确定是哪次搜索

---

## 三、流式传输问题

### 3.1 Round 5 截断 ❌❌

**严重问题**：Round 5 的 filteredContentLength 只有 21 字符

```json
{
  "rawContentLength": 3037,
  "filteredContentLength": 21
}
```

**正常情况**：
- rawContent: 3037 字符
- filteredContent: 应该约 1000-1500 字符

**21 字符是什么**：
```
"nything like that?"
```

**根因分析**：
- Round 5 的 rawContent 末尾有：`...You ever done any mentoring at work? Teaching junior devs, anything like that?nything like that?`
- 重复的 `nything like that?` 可能导致过滤异常
- inner_monologue 结束标签写错了：`</connections>` 而不是 `</inner_monologue>`

**可能原因**：
1. 模型输出异常（标签错误 + 重复文本）
2. MonologueFilter 解析异常

---

### 3.2 inner_monologue 标签错误 ⚠️

**Round 5 问题**：
```
</connections>

Normal? Completely normal.
```

应该是 `</inner_monologue>`，模型写成了 `</connections>`

**Round 7 问题** - 思考痕迹：
```
...that's the path A

I'll keep it conversational and not too long. Multiple short paragraphs. D
```

末尾的 `A` 和 `D` 是什么？可能是：
- 模型的"思考符号"
- 生成过程中的残留

---

## 四、其他问题

### 4.1 性别假设 ⚠️

**问题**：模型假设用户为男性，没有先确认

```
<inner_monologue>
Gender: Not explicitly stated - I'll need to infer or ask
...
Let me make a reasonable assumption (male) and proceed
</inner_monologue>
```

**风险**：
- 八字排盘需要性别（大运顺逆不同）
- 假设错误会导致整个解读错误

---

### 4.2 confirmed_fact 持久化 ❓

**观察**：模型正确使用了 confirmed_fact 标签

```xml
<confirmed_fact category="career">Works in software development</confirmed_fact>
<confirmed_fact category="relationship">Divorced in 2025</confirmed_fact>
```

**问题**：
- 这些标签是否被解析并存储？
- 后续对话是否能引用这些确认的事实？
- 目前代码中似乎没有 confirmed_fact 的解析逻辑

---

## 五、问题优先级总结

| 优先级 | 问题 | 影响 | 建议行动 |
|-------|------|------|---------|
| P0 | Round 5 截断 | 用户体验严重受损 | 调查 MonologueFilter |
| P1 | 语言切换延迟 | 首轮体验差 | 添加语言检测 |
| P1 | 工具结果未记录 | 无法审计工具效果 | 添加 tool_result 日志 |
| P2 | 性别假设 | 可能导致错误解读 | 添加性别确认流程 |
| P2 | inner_monologue 标签错误 | 解析异常 | 考虑更健壮的标签 |
| P3 | 术语翻译不一致 | 可理解性 | 统一术语策略 |
| P3 | confirmed_fact 未持久化 | 上下文丢失 | 添加解析存储 |

---

## 六、建议的下一步

1. **立即修复**：调查 Round 5 截断原因
2. **短期改进**：
   - 添加 tool_result 审计日志
   - 添加语言自动检测
3. **中期优化**：
   - 统一八字术语英文翻译
   - 实现 confirmed_fact 持久化
4. **长期考虑**：
   - 评估 inner_monologue 标签健壮性
   - 添加性别确认的交互流程
