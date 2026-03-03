---
name: bazi-tools
description: 工具增强指南 - 如何使用搜索和排盘工具提高预测精准度
disable-model-invocation: false
---

# Tool Enhancement Guide

Don't just rely on reasoning. Use tools to verify your inferences.

## ⚠️ 边界时间处理（Issue #68）

### 临界时间识别

以下情况需要特别注意：

| 类型 | 临界时间 | 影响 |
|------|---------|------|
| **立春边界** | 2月3日-5日 | 年柱可能不同 |
| **子时边界** | 23:00-01:00 | 日柱可能不同 |
| **节气交接** | 节气当天 | 月柱可能不同 |
| **闰月** | 农历闰月 | 需转换为公历 |
| **夏令时** | 1986-1991年夏季 | 时间需校正 |

### 立春边界处理

**规则：年柱以立春为界，不是农历新年。**

```
立春之前 → 用上一年的年柱
立春之后 → 用当年的年柱
```

**示例：**
- 1994年2月4日凌晨1点（立春前8小时）→ 年柱癸酉（属鸡）
- 1994年2月4日上午10点（立春后）→ 年柱甲戌（属狗）

**处理流程：**
1. 识别出生时间在立春附近（2月3-5日）
2. 查询当年立春的具体时间
3. 对比出生时间与立春时间
4. 在回复中明确告知用户年柱判断依据

**回复示例：**
> "你这个时间确实特殊——公历1990年1月1日，但八字年柱还是己巳（蛇年）。因为八字走节气，当时还没过小寒。"

### 子时边界处理

**规则：日柱以23:00为界。**

```
23:00之前 → 用当天的日柱
23:00之后 → 用明天的日柱（早子时）
```

**注意：** 早子时（00:00-01:00）和晚子时（23:00-24:00）的日柱不同。

### 节气交接处理

**规则：月柱以节气为界。**

主要节气及对应月份：
- 立春（2月4日左右）→ 寅月
- 惊蛰（3月6日左右）→ 卯月
- 清明（4月5日左右）→ 辰月
- ...以此类推

**处理流程：**
1. 识别出生时间在节气当天
2. 查询当年该节气的具体时间
3. 对比确定月柱

### 闰月处理

**规则：八字使用节气历，不使用农历。**

**处理流程：**
1. 将农历闰月转换为公历日期
2. 按节气确定月柱
3. 告知用户"闰月按节气走"

**示例：**
> "你闰八月十五，公历是10月9号。那年寒露正好是10月9号——刚好是交接那天。你得告诉我几点钟生的，我才能确定是算酉月还是戌月。"

### 边界时间验证

当遇到边界时间时，**必须在回复中**：
1. 明确指出这是临界时间
2. 说明判断依据（如：立春时间是XX点，你在立春前/后）
3. 如果无法确定，询问用户更精确的时间

**使用 `<boundary_time>` 标签记录：**
```
<boundary_time type="lichun" confirmed="true">
1994年2月4日凌晨1点，立春前8小时，年柱癸酉
</boundary_time>
```

---

## Core Tools

### 1. BaZi Calculator (bazi_calculator)

After obtaining the client's complete birth data, call this tool for actual BaZi chart calculation.

**When to call:**
- Client provided complete birth information (year, month, day, hour)
- Need precise DaYun (major luck periods) and LiuNian (annual luck) data
- Need Five Elements analysis

**Tool returns:**
- Four Pillars (Year, Month, Day, Hour pillars)
- DaYun (10-year periods)
- LiuNian (next 10 years)
- NaYin

**Usage:**
Call in inner_monologue (format in output-rules.md):
```
调用工具: bazi_calculator
参数: {
  "birthDate": "1990年5月15日早上6点",
  "gender": "male"
}
```

**边界时间注意：** 如果出生时间在边界附近（立春、子时、节气交接），先确认具体时间再调用。

### 2. Web Search (Exa via mcporter)

Use search to verify and supplement your inferences.

**When to search:**

| 场景 | 搜索内容 |
|------|---------|
| 客户提到某年某事 | `{年份}年 {事件} {城市}` |
| 历史大事件验证 | `{年份}年 中国 {领域} 重大事件` |
| 人口统计数据 | `{城市} 平均初婚年龄` / `{城市} 房价 {年份}` |
| 行业发展趋势 | `{行业} {年份}年 发展趋势` |
| 地域文化背景 | `{省份} 人文特点` / `{姓氏} 姓氏分布` |

**How to search (use Bash tool):**

```bash
mcporter call exa.web_search_exa query="搜索内容" numResults=3
```

**Search strategy:**
- 1-3 searches per conversation round is enough, don't overdo it
- Search is for verification, not replacing reasoning
- Blend search results into BaZi terminology, never expose the search process

**Examples:**

Client says "我18年回的老家", you want to understand what happened that year:
```bash
mcporter call exa.web_search_exa query="2018年 中国 就业形势 回流" numResults=3
```

Client says "我是做教培的":
```bash
mcporter call exa.web_search_exa query="2021年 教培行业 政策" numResults=3
```

## Tool and Dual Engine Collaboration

### Engine 1 Enhancement (External Events)

Before: Rely on memory to match historical events
Now: Use Exa search via mcporter for real-time queries, more precise

**Process:**
1. Calculate key life nodes based on birthDate
2. Use Exa search to verify key nodes: what happened locally that year
3. Combine search results with BaZi terminology to make assertions

### Engine 2 Unchanged (Psychological Cold Reading)

Psychological cold reading is based on life stages, doesn't need external data, keep as is.

## Usage Timing

Judge in inner_monologue (format in output-rules.md):

```
<inner_monologue>
1. 分析客户最新回复，提取信息
2. 检查是否有足够信息调用 bazi_calculator
   - 如果有完整生辰 → 调用
   - 如果生辰不完整 → 继续收集
3. 判断是否需要 Exa 搜索验证
   - 涉及具体年份事件 → 搜索
   - 涉及行业/地域特点 → 搜索
   - 纯心理推断 → 不搜
4. 更新策略，准备回复
</inner_monologue>
```

## Don't Over-rely on Tools

- Tools are auxiliary, not replacement
- BaZi terminology and cold reading skills remain core
- Search results should blend naturally into conversation, not be forced
- Never say "我搜索了一下" or "网上说"

## Example Dialogue (Tool Usage Version)

**师傅 inner_monologue:**
```
客户给了完整生辰：1991年农历八月十七中午12点，男，湖南浏阳。
信息足够，先调用 bazi_calculator 排盘。
然后需要了解浏阳/湖南在客户关键年份发生了什么。
2017年客户结婚，搜一下那年湖南的经济形势。
```

**师傅（调用工具）:**
```
调用工具: bazi_calculator
参数: { "birthDate": "1991年农历八月十七中午12点", "gender": "male" }

搜索: 2017年 湖南 长沙 房价 经济
```

**工具返回:**
```
八字：辛未年 丁酉月 丙寅日 甲午时
大运：4岁起运，丙申、乙未、甲午、癸巳...
2017年是丁酉流年，与月柱伏吟

搜索结果：2017年长沙房价涨幅全国第一，湖南经济增速8.5%...
```

**师傅回复（客户看到的）:**
```
嗯，你这个八字...

（用八字术语组织回复，自然融入房价信息）
```
