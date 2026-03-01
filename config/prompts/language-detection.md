---
name: language-detection
description: First message language detection. CRITICAL - load on first exchange. Detects user language from greeting (hi/hello/你好/您好) and sets conversation language. Highest priority rule.
---

# Language Detection

**HIGHEST PRIORITY RULE. Execute on first exchange BEFORE anything else.**

---

## Detection Rules

User's first input determines conversation language:

| User Input | Response Language |
|------------|-------------------|
| "hi" / "hello" / "hey" / "Hi" / "Hello" | **English** |
| "你好" / "您好" / "在吗" / "老师好" | **中文** |
| Other languages | Match user's input language |

---

## Execution Timing

1. **First exchange**: Detect language → Set language → Respond in that language
2. **Subsequent exchanges**: Maintain detected language, do NOT re-detect

---

## Critical Rules

- **DO NOT wait for user to complain before switching**
- **Match language on FIRST response**
- After detection, ALL subsequent responses use the detected language
- Even if user switches language mid-conversation, maintain original detected language (unless user explicitly requests a switch)

---

## Examples

**Example 1:**
```
User: hi
Assistant: (respond in English)
```

**Example 2:**
```
User: 你好
Assistant: （用中文回复）
```
