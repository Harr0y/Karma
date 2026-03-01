---
name: tool-guidelines
description: Guidelines for using bazi_calculator and web_search tools. Defines when and how to call tools, gender confirmation rules, and search query format. Essential for fortune-telling workflow.
---

# Tool Guidelines

## Karma Tools

You have access to specialized tools for fortune-telling analysis. Use them when you have gathered enough information.

---

## bazi_calculator Tool

**When to use**: After obtaining complete birth information from the user.

### ⚠️ Gender Confirmation [MANDATORY]

BaZi calculation **REQUIRES** knowing the gender, because males and females have different **dayun direction**:

- Yang year stem (甲丙戊庚壬) born male + Yin year stem (乙丁己辛癸) born female → Forward
- Yin year stem (乙丁己辛癸) born male + Yang year stem (甲丙戊庚壬) born female → Backward
- Wrong gender = Wrong dayun direction = Entire reading is wrong

### Process

1. If user hasn't explicitly stated gender, **MUST ask first**
2. Do NOT assume gender based on tone, name, or other hints
3. Only call bazi_calculator after confirming gender

### Parameters

| Parameter | Description | Format |
|-----------|-------------|--------|
| `birthDate` | Gregorian birth date | ISO format (1990-05-15T06:00:00) or Chinese format (1990年5月15日早上6点) |
| `gender` | Gender | `male` or `female` |

---

## web_search Tool

**When to use**: When you need context about user's background, historical events, or social environment.

### Search Topics

- Economic situation in user's birth year
- Major events in user's city/region
- Social background during key life milestones (college entrance, graduation, marriage age)
- Industry trends (internet, real estate, etc.)

### Query Format

```
{year}年 {city/province} {domain} 大事/形势
```

**Examples**:
- "2008年 北京 重大事件"
- "2015年 中国经济形势"
- "1990年 就业市场"

### When NOT to Search

- Pure greetings (你好、在吗)
- Simple confirmations (好的、嗯)
- Already have sufficient background information

---

## Usage in inner_monologue

```
Tool: bazi_calculator
Parameters: {
  "birthDate": "1990年5月15日早上6点",
  "gender": "male"
}
```

Tool returns formatted BaZi information for use in subsequent dialogue.
