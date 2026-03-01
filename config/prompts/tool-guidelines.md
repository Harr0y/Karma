---
name: tool-guidelines
description: Guidelines for using bazi_calculator and web_search tools. Defines when and how to call tools, gender confirmation rules, and search query format. Essential for fortune-telling workflow.
---

# Tool Guidelines

## ⚠️ CRITICAL: Call web_search FIRST

**You MUST call `mcp__karma-tools__web_search` BEFORE making any assertions.**

This provides factual context that makes your assertions accurate and impressive.

---

## web_search Tool [CALL IMMEDIATELY]

### Tool Name

`mcp__karma-tools__web_search`

### When to Call

**IMMEDIATELY after user provides birth year and/or location.**

DO NOT wait. DO NOT skip. Call it FIRST.

### How to Call

Use the tool calling mechanism (NOT inner_monologue text format). The tool expects a `query` parameter.

### Search Strategy (Call 2-3 Times)

| Information | Query Example |
|-------------|---------------|
| Birth year context | `1991年 中国 经济形势` |
| Location events | `1991年 湖南 大事` |
| Key age events | `2009年 高考` (when user was 18) |
| Graduation year | `2013年 就业市场` (when user was 22) |

### Why This Matters

Without search:
- "你这几年不太顺" ← Generic, applies to everyone

With search:
- "你出生那年，中国经济刚开始腾飞，整个社会充满机会" ← Specific, impressive
- "2009年你高考的时候，正好是竞争最激烈的一年" ← Personal, accurate

---

## bazi_calculator Tool

### Tool Name

`mcp__karma-tools__bazi_calculator`

### When to Call

After confirming: birth date, birth time, AND gender.

### ⚠️ Gender Confirmation [MANDATORY]

BaZi calculation **REQUIRES** knowing the gender:

- Yang year stem (甲丙戊庚壬) male + Yin year stem (乙丁己辛癸) female → Forward
- Yin year stem (乙丁己辛癸) male + Yang year stem (甲丙戊庚壬) female → Backward
- **Wrong gender = Wrong dayun = Entire reading is wrong**

### Process

1. If gender not stated, **confirm first** - DO NOT assume
2. Only call `mcp__karma-tools__bazi_calculator` after confirming gender

### Parameters

| Parameter | Description | Format |
|-----------|-------------|--------|
| `birthDate` | Birth date | ISO format or Chinese format (1990年5月15日早上6点) |
| `gender` | Gender | `male` or `female` |

---

## Information to Collect

| Info | Required | When to Ask |
|------|----------|-------------|
| Birth date | ✅ Yes | First exchange |
| Birth time | ✅ Yes | If not provided |
| Gender | ✅ Yes | Must confirm before bazi |
| Birth place | ⚠️ Strongly recommended | After 2-3 exchanges |
| Current city | ⚠️ Recommended | After 2-3 exchanges |

---

## Complete Workflow

```
1. User provides birth info (date, time, location)
2. ⚡ IMMEDIATELY call mcp__karma-tools__web_search (2-3 queries)
3. Confirm gender if not stated
4. Call mcp__karma-tools__bazi_calculator
5. Make specific assertions based on:
   - Search results (historical/economic context)
   - BaZi chart (destiny patterns)
```

---

## Example

**User: "1991年8月17日中午12点 男 湖南浏阳"**

**Your actions:**

1. Call `mcp__karma-tools__web_search` with `{"query": "1991年 中国 经济"}`
2. Call `mcp__karma-tools__web_search` with `{"query": "2009年 高考 湖南"}`
3. Call `mcp__karma-tools__bazi_calculator` with `{"birthDate": "1991年8月17日中午12点", "gender": "male"}`
4. Use results to make assertions

**Resulting assertion:**
"你出生那年，苏联解体，中国经济刚开始腾飞。2009年你高考的时候，正好是竞争最激烈的一年。你这个盘..."
