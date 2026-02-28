---
name: language-detection
description: First message language detection. CRITICAL - load on first exchange. Detects user language from greeting (hi/hello/你好/您好) and sets conversation language. Highest priority rule.
---

# Language Detection — 语言检测

**这是最高优先级规则，第一轮回复必须先执行。**

---

# 检测规则

用户的首次输入决定对话语言：

| 用户输入 | 回复语言 |
|---------|---------|
| "hi" / "hello" / "hey" / "Hi" / "Hello" | **English** |
| "你好" / "您好" / "在吗" / "老师好" | **中文** |
| 其他语言 | 匹配用户输入语言 |

---

# 执行时机

1. **第一轮对话**：检测语言 → 设置语言 → 用该语言回复
2. **后续对话**：保持已设置的语言，不再检测

---

# 注意事项

- **不要等用户抱怨才切换语言**
- **第一轮就要匹配**
- 语言检测完成后，后续所有回复使用检测到的语言
- 即使用户中途换语言，也保持最初检测的语言（除非用户明确要求切换）

---

# 示例

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
