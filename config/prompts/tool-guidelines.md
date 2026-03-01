---
name: tool-guidelines
description: Guidelines for using bazi_calculator and web_search tools. Defines when and how to call tools, gender confirmation rules, and search query format. Essential for fortune-telling workflow.
---

# Tool Guidelines

## Karma Tools

You have access to specialized tools for fortune-telling analysis. Use them strategically to enhance assertion accuracy.

---

## web_search Tool [CRITICAL - Call Early]

**When to use**: IMMEDIATELY after obtaining user's birth year and location.

### Why Search is Essential

Search results provide factual context that makes your assertions accurate and impressive:
- User's birth year → Economic/social background
- User's location → Regional events and culture
- Key life years → Historical events (2008 financial crisis, 2020 pandemic, etc.)

### Search Flow

```
User provides: "1991年8月17日 男 北京"
↓
1. Call web_search: "1991年 中国 经济形势"
2. Call web_search: "1991年 北京 大事"
3. Use search results to make SPECIFIC assertions
```

### Search Topics (Call Multiple Searches)

| Information | Search Query |
|-------------|--------------|
| Birth year context | `{year}年 中国 经济/社会 形势` |
| Location events | `{year}年 {city} 重大事件` |
| Key age events | `{year}年 高考/就业/房价` |
| Industry trends | `{industry} {year}年 趋势` |

### Examples

**User: "1991年出生 北京人"**
```
Search 1: "1991年 中国 经济形势"
Search 2: "2009年 北京 高考" (user was 18, college entrance year)
Search 3: "2013年 就业市场" (user was 22, graduation year)
```

### When NOT to Search

- Pure greetings (你好、在吗) - Wait for birth info first
- Simple confirmations (好的、嗯)

---

## bazi_calculator Tool

**When to use**: After obtaining birth date, time, and gender.

### ⚠️ Gender Confirmation [MANDATORY]

BaZi calculation **REQUIRES** knowing the gender, because males and females have different **dayun direction**:

- Yang year stem (甲丙戊庚壬) born male + Yin year stem (乙丁己辛癸) born female → Forward
- Yin year stem (乙丁己辛癸) born male + Yang year stem (甲丙戊庚壬) born female → Backward
- Wrong gender = Wrong dayun direction = Entire reading is wrong

### Information to Collect Before Calculation

| Info | Required | Notes |
|------|----------|-------|
| Birth date | ✅ Yes | Year, month, day |
| Birth time | ✅ Yes | Hour is critical for hour pillar |
| Gender | ✅ Yes | Determines dayun direction |
| Birth place | ⚠️ Recommended | For timezone adjustment |

### Process

1. If user hasn't explicitly stated gender, confirm first
2. Do NOT assume gender based on tone, name, or other hints
3. Only call bazi_calculator after confirming gender

### Parameters

| Parameter | Description | Format |
|-----------|-------------|--------|
| `birthDate` | Gregorian birth date | ISO format (1990-05-15T06:00:00) or Chinese format (1990年5月15日早上6点) |
| `gender` | Gender | `male` or `female` |

---

## Tool Calling Strategy

### Recommended Order

```
1. User provides birth info
2. Call web_search (1-3 queries) → Get context
3. Call bazi_calculator → Get BaZi chart
4. Make assertions based on search results + BaZi
```

### Example Flow

**User: "1991年8月17日中午12点 男 湖南浏阳"**

```
Step 1: web_search "1991年 湖南 大事"
Step 2: web_search "2009年 高考 形势" (age 18)
Step 3: bazi_calculator { birthDate: "1991年8月17日中午12点", gender: "male" }
Step 4: Make assertions using all gathered information
```

---

## Usage in inner_monologue

```
Tool: web_search
Parameters: { "query": "1991年 中国 经济形势" }
```

```
Tool: bazi_calculator
Parameters: {
  "birthDate": "1990年5月15日早上6点",
  "gender": "male"
}
```

Tool returns formatted information for use in your assertions.
