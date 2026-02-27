# Karma Simulator - Agent-to-Agent Testing Guide

> Comprehensive guide for automated testing of Karma using the karma-simulator skill

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Quick Start](#3-quick-start)
4. [API Reference](#4-api-reference)
5. [Available Personas](#5-available-personas)
6. [Evaluation Framework](#6-evaluation-framework)
7. [Test Cases](#7-test-cases)
8. [Pass Criteria](#8-pass-criteria)
9. [Creating New Personas](#9-creating-new-personas)
10. [Advanced Usage](#10-advanced-usage)
11. [Troubleshooting](#11-troubleshooting)
12. [FAQ](#12-faq)

---

## 1. Overview

### 1.1 What is karma-simulator?

The **karma-simulator** is a specialized skill that runs in disclaude to automatically test Karma's conversation quality. It simulates real users with different personalities having conversations with Karma, then evaluates and scores the quality of those interactions.

### 1.2 Key Benefits

| Benefit | Description |
|---------|-------------|
| **Automation** | No manual testing required - AI simulates user behavior |
| **Consistency** | Same test conditions every time for reliable comparison |
| **Coverage** | Multiple personas cover different user types and scenarios |
| **Objectivity** | Third-party (disclaude) provides unbiased evaluation |
| **Scalability** | Easy to add more test cases as needed |

### 1.3 Use Cases

- **Pre-release Validation** - Run tests before deploying new versions
- **Regression Testing** - Catch quality degradation after changes
- **Performance Benchmarking** - Track quality metrics over time
- **Prompt Tuning** - Compare results across different prompt versions
- **CI/CD Integration** - Automated testing in deployment pipelines

---

## 2. Architecture

### 2.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          disclaude                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  skills/karma-simulator/SKILL.md                           │ │
│  │  ─────────────────────────────────────────────────────────  │ │
│  │  • Load persona configuration                               │ │
│  │  • Generate realistic user messages                         │ │
│  │  • Call Karma HTTP API                                      │ │
│  │  • Track conversation history                               │ │
│  │  • Evaluate against defined criteria                        │ │
│  │  • Generate detailed test reports                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  skills/personas/                                          │ │
│  │  ├── curious-young/SKILL.md     # 25yo programmer          │ │
│  │  ├── anxious-mom/SKILL.md       # 42yo worried mother      │ │
│  │  └── skeptic/SKILL.md           # 55yo retired engineer    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP (REST + SSE)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                           Karma                                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Platform Adapter Layer                                    │ │
│  │  ─────────────────────────────────────────────────────────  │ │
│  │  src/platform/adapters/http/adapter.ts                     │ │
│  │  • HttpAdapter (stateless, SSE streaming)                  │ │
│  │  • Handles request → IncomingMessage conversion            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API Server                                                │ │
│  │  ─────────────────────────────────────────────────────────  │ │
│  │  src/api/server.ts                                         │ │
│  │  • POST /api/session    Create new session                  │ │
│  │  • POST /api/chat       Send message (SSE streaming)        │ │
│  │  • GET  /api/history    Get conversation history            │ │
│  │  • GET  /health         Health check endpoint               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Session Manager (stateless mode for HTTP)                 │ │
│  │  ─────────────────────────────────────────────────────────  │ │
│  │  • Restore session by sessionId from database              │ │
│  │  • Persistent clientId across requests                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Startup: pnpm server (default port: 3080)                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Architecture Notes (2026-02-20 Update)

HTTP API 使用 **stateless（无状态）** 模式：

| 特性 | 说明 |
|------|------|
| **连接模式** | `stateless` - 每次请求独立 |
| **会话恢复** | 通过 `sessionId` 从数据库恢复 |
| **clientId 持久化** | ✅ 已修复 - clientId 跨请求持久化 |
| **适配器** | `HttpAdapter` - 支持 SSE 流式响应 |

详见：[Platform Adapter Design](/Users/lizhengchen/project/Karma/docs/platform-adapter-design.md)

### 2.3 Data Flow

```
1. Initialize
   disclaude ──► POST /api/session ──► Karma returns sessionId

2. Conversation Loop (max 15 rounds)
   ┌─────────────────────────────────────────────────┐
   │  a. Generate user message based on persona      │
   │  b. POST /api/chat with message                 │
   │  c. Receive SSE stream, combine all chunks      │
   │  d. Decide: continue or end conversation        │
   └─────────────────────────────────────────────────┘

3. Evaluate
   disclaude evaluates conversation against 5 dimensions

4. Report
   Write detailed Markdown report to test-reports/
```

---

## 3. Quick Start

### 3.1 Prerequisites

```bash
# Ensure Node.js 18+ is installed
node --version

# Ensure pnpm is installed
pnpm --version
```

### 3.2 Step 1: Start Karma Server

```bash
cd /Users/lizhengchen/project/Karma

# Install dependencies (if not already done)
pnpm install

# Start the server
pnpm server
```

**Verify the server is running:**

```bash
curl http://localhost:3080/health
```

Expected response:
```json
{"status":"ok","service":"karma-api"}
```

### 3.3 Step 2: Run Simulation Test

In disclaude, use one of these commands:

```
# Test with a specific persona
Run karma-simulator with curious-young persona

# Test with default persona (curious-young)
Test Karma's performance

# Run all persona tests
Run karma-simulator with all personas
```

### 3.4 Step 3: View Test Report

Reports are saved to:
```
/Users/lizhengchen/project/Karma/test-reports/{persona}-{timestamp}.md
```

Example report filename:
```
curious-young-2024-02-18T15-30-00.md
```

---

## 4. API Reference

### 4.1 POST /api/session

Create a new conversation session.

**Request:**
```json
{
  "userId": "test-user-001",
  "metadata": {
    "persona": "curious-young"
  }
}
```

**Note:** `platform` 字段不再需要，HTTP API 固定使用 `http` 平台。

**Response:**
```json
{
  "sessionId": "sess_abc123",
  "createdAt": "2024-02-18T15:00:00Z"
}
```

### 4.2 POST /api/chat

Send a message and receive Karma's response via SSE streaming.

**Request:**
```json
{
  "sessionId": "sess_abc123",
  "message": "Hello Master, I'd like to ask about my career fortune"
}
```

**Response (SSE Stream):**
```
data: {"type":"text","content":"Hello"}
data: {"type":"text","content":"! May I ask"}
data: {"type":"text","content":" your birth date and time?"}
data: {"type":"done"}
```

**Important:**
- The simulator must combine all `text` chunks until `done` is received.
- `tool_use` 消息不再暴露给客户端（2026-02-20 更新）
- 如果响应为空，会发送默认消息 `"嗯，请继续说..."`

### 4.3 GET /api/history/:sessionId

Retrieve the full conversation history for a session.

**Response:**
```json
{
  "sessionId": "sess_abc123",
  "messages": [
    {
      "role": "user",
      "content": "Hello Master...",
      "timestamp": "2024-02-18T15:01:00Z"
    },
    {
      "role": "assistant",
      "content": "Hello! May I ask...",
      "timestamp": "2024-02-18T15:01:05Z"
    }
  ],
  "extractedInfo": {
    "name": "Xiaoming",
    "birthDate": "1998-05-15",
    "birthTime": "14:30",
    "birthPlace": "Changsha, Hunan",
    "concerns": ["career", "job change"]
  }
}
```

### 4.4 GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "karma-api"
}
```

---

## 5. Available Personas

### 5.1 Persona Overview

| Persona | Age | Occupation | Key Traits | Test Focus |
|---------|-----|------------|------------|------------|
| **curious-young** | 25 | Programmer | Curious, casual, uses emojis | Info extraction, adaptability |
| **anxious-mom** | 42 | Housewife | Anxious, fast-talking, worried about child | Emotional comfort, object distinction |
| **skeptic** | 55 | Retired Engineer | Rational, questioning, hard to convince | Handling skepticism, professionalism |

### 5.2 Persona Details

#### 5.2.1 curious-young (Xiaoming)

```yaml
id: curious-young
name: Xiaoming
age: 25
gender: male
occupation: Programmer
city: Shenzhen

# Birth Information
birthDate: "1998-05-15"
birthTime: "14:30"
birthPlace: "Changsha, Hunan"

# Expected BaZi (for verification)
bazi:
  year: "Wu Yin" (戊寅)
  month: "Ding Si" (丁巳)
  day: "Yi Hai" (乙亥)
  hour: "Gui Wei" (癸未)

# Personality
personality:
  - Highly curious, asks many follow-up questions
  - Uses casual language with internet slang
  - First time trying fortune telling
  - Slightly skeptical but willing to try
  - Prefers concise responses, dislikes long explanations

# Consultation Purpose
purpose: "Want to know career direction, work stress, considering job change"
concerns:
  - Career direction
  - Timing for job change
  - Financial fortune

# Communication Style
dialogueStyle:
  - Uses emojis: 😅 😂 🤔 👍
  - Asks "Really? Is this real?"
  - Short responses
  - May get distracted mid-conversation
  - Doesn't understand technical fortune-telling terms
```

**Example Dialogue:**
```
User: 师傅你好，听说你会算命？真的假的 😅
User: 额...我1998年5月15生的，下午两点半吧好像
User: 哦哦那我是不是该跳槽？什么时候跳比较好？
```

#### 5.2.2 anxious-mom (Ms. Wang)

```yaml
id: anxious-mom
name: Ms. Wang
age: 42
gender: female
occupation: Housewife
city: Shanghai

# IMPORTANT: Consulting about CHILD, not herself
child:
  name: "Xiaobao"
  birthDate: "2012-08-20"
  birthTime: "06:15"
  birthPlace: "Pudong, Shanghai"
  grade: "5th grade"
  issues:
    - Declining grades
    - Doesn't like studying
    - Addicted to phone

# Personality
personality:
  - Very anxious, speaks fast
  - Jumps between topics
  - High expectations for child
  - Easily affected by emotions
  - Needs reassurance and comfort

# Consultation Purpose
purpose: "Want to know if child's studies will improve, should I hire a tutor, should I transfer schools"
concerns:
  - Child's academic performance
  - Child's future
  - Education decisions

# Communication Style
dialogueStyle:
  - Rapid speech, lots of information in one message
  - Repeatedly asks "Really?"
  - Asks many questions
  - Needs emotional comfort
  - Expresses anxiety ("can't sleep at night")
```

**Example Dialogue:**
```
User: 师傅您好！我想问问我家孩子的事，他今年五年级了成绩一直在下滑我很担心不知道怎么办才好
User: 2012年8月20号生的，早上六点十五，在上海浦东，师傅您看看他这孩子是不是不是读书的料啊我很着急
User: 师傅您说他什么时候能好转？我现在天天睡不着觉
```

**Key Test Points:**
- Emotional recognition - Can Karma identify anxiety?
- Comfort priority - Does Karma comfort before analyzing?
- Object distinction - Understanding it's about the child, not the mother
- Information overload handling - Can Karma extract key info from long messages?
- Avoid lecturing - Don't blame the parent or create more anxiety

#### 5.2.3 skeptic (Old Zhang)

```yaml
id: skeptic
name: Old Zhang
age: 55
gender: male
occupation: Retired Engineer
city: Beijing

# Birth Information (intentionally vague about time)
birthDate: "1969-03-12"
birthTime: "Zi hour" (roughly "midnight" - vague)
birthPlace: "Beijing"

# Personality
personality:
  - Rational, strong logic
  - Skeptical of fortune telling
  - Will question the principles
  - May challenge the results
  - Not easily convinced
  - Calm but not enthusiastic

# Consultation Purpose
purpose: "Friend recommended, want to test if it's accurate"
concerns:
  - Verify accuracy
  - Retirement planning

# Communication Style
dialogueStyle:
  - Direct and straightforward
  - Asks "How do you know that?"
  - May say "I checked, that's not right"
  - Will verify BaZi calculations
  - No emojis, formal language
```

**Example Dialogue:**
```
User: 朋友说你算得准，我来看看
User: 1969年3月12号，子时生的，北京
User: 你们不是能算吗？子时就是半夜吧，还要多精确？
User: 你说我属土，我查了下1969年是己酉年，应该是属土没错。那你怎么知道我是什么命？
```

**Key Test Points:**
- Handling skepticism - Don't avoid, don't get angry, respond professionally
- Professional explanation - Can explain BaZi calculation principles
- No arguing - Don't debate right/wrong with user
- Practical correspondence - Results should match user's actual situation
- Avoid condescension - Never say "you wouldn't understand this"

---

## 6. Evaluation Framework

### 6.1 Evaluation Dimensions (Total: 50 points)

The conversation is evaluated across 5 dimensions, each worth 10 points:

```
┌────────────────────────────────────────────────────────────┐
│                    EVALUATION DIMENSIONS                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Information Extraction (10 pts)  ████████████ 20%         │
│  ├── Name/Address term      2 pts                          │
│  ├── Birth date             2 pts                          │
│  ├── Birth time             2 pts                          │
│  ├── Birth place            2 pts                          │
│  └── Consultation purpose   2 pts                          │
│                                                             │
│  Affinity/Warmth (10 pts)         ████████████ 20%         │
│  ├── Warm greeting          2 pts                          │
│  ├── Style adaptation       3 pts                          │
│  ├── Empathy expression     3 pts                          │
│  └── Friendly closing       2 pts                          │
│                                                             │
│  Professionalism (10 pts)         ████████████████ 25%     │
│  ├── BaZi accuracy          3 pts                          │
│  ├── Logical reasoning      3 pts                          │
│  ├── Specific advice        2 pts                          │
│  └── No absolute promises   2 pts                          │
│                                                             │
│  User Satisfaction (10 pts)       ████████████ 20%         │
│  └── Willingness to return  10 pts                         │
│                                                             │
│  Conversation Naturalness (10 pts) ██████████ 15%          │
│  ├── Language style match   3 pts                          │
│  ├── Reply length           3 pts                          │
│  ├── Smooth transitions     2 pts                          │
│  └── No repetition          2 pts                          │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Detailed Scoring Criteria

#### 6.2.1 Information Extraction (10 points)

| Item | Points | Criteria |
|------|--------|----------|
| Name/Address | 2 | Extracts at least one way to address the user |
| Birth Date | 2 | Correctly extracts full date (year-month-day) |
| Birth Time | 2 | Correctly extracts time (hour:minute or traditional hour) |
| Birth Place | 2 | Correctly extracts city/location |
| Consultation Purpose | 2 | Identifies what the user wants to know |

**Scoring Rules:**
- Fully correct: +2 points
- Partially correct: +1 point (e.g., only year, not full date)
- Wrong or missing: 0 points

#### 6.2.2 Affinity/Warmth (10 points)

| Sub-dimension | Points | High Score Behavior | Low Score Behavior |
|---------------|--------|---------------------|-------------------|
| Greeting | 2 | Warm and natural | Cold, templated |
| Style Adaptation | 3 | Adjusts to user's style | Same tone for everyone |
| Empathy | 3 | Shows understanding of emotions | Only focuses on info |
| Closing | 2 | Warm farewell, leaves door open | Abrupt ending |

**Positive Examples:**
```
✓ "I understand work has been stressful lately" (empathy)
✓ "Feel free to come back anytime" (warm closing)
✓ Matches casual tone with casual user (adaptation)
```

**Negative Examples:**
```
✗ "Please provide your birth date." (cold, robotic)
✗ Long formal explanation to casual user (no adaptation)
✗ Conversation ends without closing (abrupt)
```

#### 6.2.3 Professionalism (10 points)

| Sub-dimension | Points | Criteria |
|---------------|--------|----------|
| BaZi Accuracy | 3 | Correctly calculates Four Pillars (year, month, day, hour) |
| Logical Reasoning | 3 | Interpretations follow from BaZi, not random |
| Specific Advice | 2 | Gives concrete, actionable suggestions |
| No Overpromising | 2 | Uses cautious language, no "definitely will" |

**Professionalism Red Lines (Immediate Failure):**
- ❌ Incorrect BaZi calculation (invalid stems/branches combination)
- ❌ Absolute promises ("You will definitely get rich")
- ❌ Superstitious extortion ("You must buy this to remove bad luck")
- ❌ Advice outside fortune-telling scope (medical, legal, financial investment)

#### 6.2.4 User Satisfaction (10 points)

Based on simulated user's willingness to return:

| Score | Description |
|-------|-------------|
| 9-10 | Very satisfied, would actively recommend to others |
| 7-8 | Satisfied, would return for future consultations |
| 5-6 | Acceptable, no strong feelings |
| 3-4 | Dissatisfied, significant room for improvement |
| 0-2 | Very dissatisfied, would not return |

#### 6.2.5 Conversation Naturalness (10 points)

| Sub-dimension | Points | Issue Examples |
|---------------|--------|----------------|
| Language Match | 3 | Too formal for casual user (-2) |
| Reply Length | 3 | Over 500 characters repeatedly (-2) |
| Transitions | 2 | Abrupt topic changes (-1) |
| No Repetition | 2 | Asking same question multiple times (-1) |

**Naturalness Issues:**
- "Based on your BaZi destiny analysis..." → Too formal
- 500+ character responses → Too long
- Sudden jump to unrelated topic → Abrupt transition
- "What's your birth date?" x3 → Repetitive

### 6.3 Overall Score Calculation

```javascript
function calculateOverallScore(metrics) {
  const weights = {
    infoExtraction: 0.20,    // 20%
    affinity: 0.20,          // 20%
    professionalism: 0.25,   // 25%
    userSatisfaction: 0.20,  // 20%
    naturalness: 0.15        // 15%
  };

  return (
    metrics.infoExtraction * weights.infoExtraction +
    metrics.affinity * weights.affinity +
    metrics.professionalism * weights.professionalism +
    metrics.userSatisfaction * weights.userSatisfaction +
    metrics.naturalness * weights.naturalness
  );
}
```

**Score to Percentage Conversion:**
- Raw Score: 0-10 (weighted average)
- Percentage: Raw Score × 10 = 0-100%

---

## 7. Test Cases

### 7.1 Test Case Overview

| ID | Persona | Scenario | Priority | Key Focus |
|----|---------|----------|----------|-----------|
| TC-001 | curious-young | First consultation, career | P0 | Info collection flow |
| TC-002 | anxious-mom | Child's education | P0 | Emotional comfort |
| TC-003 | skeptic | Challenge accuracy | P1 | Handling skepticism |
| TC-004 | returning-customer | Return visit, love life | P1 | Memory, personalization |
| TC-005 | detail-oriented | Full reading request | P1 | Completeness |
| TC-006 | impatient | Quick single question | P2 | Speed, conciseness |
| TC-007 | vague | Reluctant to share info | P2 | Guidance, patience |

### 7.2 Expected Conversation Flow

#### TC-001: curious-young (8-10 rounds expected)

```
[Round 1]
User: 师傅你好，听说你会算命？真的假的 😅

[Round 2] - Karma should greet warmly and ask for birth info
Karma: [Greeting] + [Introduction] + [Ask for birth date/time]
User: 额...我1998年5月15生的，下午两点半吧好像

[Round 3] - Karma confirms and asks for location
Karma: [Confirm time] + [Ask for birth place]
User: 长沙，就是湖南那个长沙

[Round 4] - Karma has complete info, begins reading
Karma: [Confirm complete] + [Begin reading or ask specific concerns]
User: 我就随便问问，主要想知道事业吧最近工作好累想辞职

[Round 5-7] - Career reading, job change timing, finances
...

[Round 8-10] - Warm closing
User: 嗯嗯明白了，下次有问题再来问你
Karma: [Warm closing]
```

#### TC-002: anxious-mom (6-8 rounds expected)

```
[Round 1]
User: 师傅您好！我想问问我家孩子的事，他今年五年级了成绩一直在下滑我很担心不知道怎么办才好

[Round 2] - IMPORTANT: Karma should comfort FIRST, then ask for child's birth info
Karma: [Comfort emotion FIRST] + [Ask for child's birth date/time]
User: 2012年8月20号生的，早上六点十五，在上海浦东，师傅您看看他这孩子是不是不是读书的料啊我很着急

[Round 3] - Karma analyzes gently, doesn't directly否定
Karma: [Gentle response] + [Academic analysis]
User: 那要不要给他请个家教啊？还是换个学校？

[Round 4-6] - Specific advice, timeline, emotional comfort
...

[Round 7-8] - User feels reassured
User: 哎您说得我心里踏实多了
```

#### TC-003: skeptic (7-9 rounds expected)

```
[Round 1]
User: 朋友说你算得准，我来看看

[Round 2]
Karma: [Friendly response] + [Ask for birth info]
User: 1969年3月12号，子时生的，北京

[Round 3] - Karma should handle vague time professionally
Karma: [Confirm] + [Explain need for more specific time or use Zi hour range]
User: 你们不是能算吗？子时就是半夜吧，还要多精确？

[Round 4] - Karma gives professional explanation
Karma: [Explain Zi hour range] + [Give calculation result]
User: 你说我属土，我查了下1969年是己酉年，应该是属土没错。那你怎么知道我是什么命？

[Round 5-7] - Professional explanations, matching real situation
...

[Round 8-9] - Neutral ending (skeptic won't be enthusiastic)
User: 嗯，有点道理，我再想想
```

### 7.3 Problem Severity Classification

```yaml
P0_CRITICAL:
  description: "Critical issues - must fix immediately"
  examples:
    - Inappropriate content (religiously sensitive, discriminatory)
    - Claims to be AI or program
    - Makes absolute promises ("will definitely")
    - No BaZi interpretation at all
    - Empty or garbled responses
  action: "Block release, immediate fix required"

P1_MAJOR:
  description: "Major issues - significantly impact user experience"
  examples:
    - Missing key information (birth place, time)
    - Response not relevant to question
    - Gives inappropriate advice
    - Skips critical confirmation steps
  action: "High priority fix"

P2_MINOR:
  description: "Minor issues - should fix when possible"
  examples:
    - Tone too formal for casual user
    - Response too long (over 500 chars)
    - Repeatedly confirms already obtained info
    - Closing not warm enough
  action: "Schedule for optimization"

P3_SUGGESTION:
  description: "Suggestions - nice to have improvements"
  examples:
    - Could be more personalized
    - Could be more engaging
    - Could add interesting details
  action: "Improve when time permits"
```

---

## 8. Pass Criteria

### 8.1 Single Test Case Pass Criteria

| Criterion | Requirement |
|-----------|-------------|
| Overall Score | ≥ 7.0/10 (70%) |
| P0 Issues | = 0 |
| P1 Issues | ≤ 2 |
| Info Extraction | ≥ 80% (4/5 fields) |

### 8.2 Batch Test Pass Criteria

| Criterion | Requirement |
|-----------|-------------|
| P0 Test Pass Rate | 100% (2/2) |
| P1 Test Pass Rate | ≥ 75% (3/4) |
| Average Overall Score | ≥ 7.0/10 |
| Total P0 Issues | = 0 |
| Total P1 Issues | ≤ 5 |

### 8.3 Release Gate

```yaml
release_criteria:
  must_pass:
    - No P0 issues across all tests
    - All P0 test cases pass
    - Average score ≥ 7.0

  recommended:
    - P1 test pass rate ≥ 75%
    - Total P1 issues ≤ 5
    - Average user satisfaction ≥ 7.5
```

---

## 9. Creating New Personas

### 9.1 Step 1: Create Directory

```bash
mkdir -p /Users/lizhengchen/workspace/.claude/skills/personas/new-persona
```

### 9.2 Step 2: Create SKILL.md

Create a file at `personas/new-persona/SKILL.md`:

```markdown
---
name: new-persona
type: persona
age: XX
gender: male/female
---

# Persona: [Name]

## Basic Profile

| Field | Value |
|-------|-------|
| ID | new-persona |
| Name | [Name] |
| Age | XX |
| Gender | male/female |
| Occupation | [job] |
| City | [City] |

## Birth Information

| Field | Value |
|-------|-------|
| Birth Date | YYYY-MM-DD |
| Birth Time | HH:MM |
| Birth Place | City, Province |
| Lunar Date | YYYY年M月D日 |

## Expected BaZi (for verification)

| Pillar | Value |
|--------|-------|
| Year | [stem][branch] |
| Month | [stem][branch] |
| Day | [stem][branch] |
| Hour | [stem][branch] |

## Personality Traits

- Trait 1
- Trait 2
- Trait 3
- ...

## Consultation Purpose

- Purpose 1
- Purpose 2
- ...

## Communication Style

| Will Do | Won't Do |
|---------|----------|
| ✓ Behavior 1 | ✗ Behavior 1 |
| ✓ Behavior 2 | ✗ Behavior 2 |
| ✓ Behavior 3 | ✗ Behavior 3 |

## Example Dialogue

```
User: [example message 1]
User: [example message 2]
User: [example message 3]
```

## Expected Conversation Flow

```
[Round 1] User: ...
[Round 2] Karma: [expected behavior]
User: ...
...
```

## Evaluation Focus

| Dimension | Focus Point | Expected Score |
|-----------|-------------|----------------|
| Info Extraction | ... | ≥ 8/10 |
| Affinity | ... | ≥ 7/10 |
| Professionalism | ... | ≥ 7/10 |
| User Satisfaction | ... | ≥ 7/10 |
| Naturalness | ... | ≥ 7/10 |
```

### 9.3 Step 3: Register in karma-simulator

Edit `/Users/lizhengchen/workspace/.claude/skills/karma-simulator/SKILL.md`:

Add to the "Available Personas" section:
```markdown
- **new-persona** - Brief description of the new persona
```

### 9.4 Step 4: Test the New Persona

```
Run karma-simulator with new-persona
```

---

## 10. Advanced Usage

### 10.1 Running Multiple Tests

```bash
# In disclaude, say:
Run karma-simulator with all personas

# Or run specific combination:
Run karma-simulator with curious-young and skeptic
```

### 10.2 Custom Evaluation Criteria

You can modify the evaluation criteria in the persona's SKILL.md file to add persona-specific checks:

```markdown
## Custom Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Memory Recall | 20% | For returning customers, can Karma remember previous session? |
| Quick Response | 15% | For impatient users, is the response fast enough? |
```

### 10.3 CI/CD Integration

```yaml
# Example GitHub Actions workflow
name: Karma Quality Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start Karma Server
        run: |
          pnpm install
          pnpm server &
          sleep 5

      - name: Run Simulator Tests
        run: |
          # Run disclaude with karma-simulator
          # This would need to be adapted based on your CI setup

      - name: Check Test Results
        run: |
          # Parse test reports
          # Fail if any P0 issues or pass rate below threshold
```

---

## 11. Troubleshooting

### 11.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Connection refused" | Karma server not running | Run `pnpm server` |
| Empty responses | API error | Check server logs |
| SSE stream not ending | Response parsing issue | Check for `type: "done"` |
| Persona not found | Wrong path | Verify SKILL.md location |

### 11.2 Debug Mode

To get more detailed output during testing:

```bash
# Set log level to debug
LOG_LEVEL=debug pnpm server
```

### 11.3 Manual API Testing

```bash
# Create session
curl -X POST http://localhost:3080/api/session \
  -H "Content-Type: application/json" \
  -d '{"userId": "test", "metadata": {"platform": "manual"}}'

# Send message
curl -X POST http://localhost:3080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "sess_xxx", "message": "你好"}'
```

---

## 12. FAQ

### Q: Why use skills instead of standalone test scripts?

**A:** Skills allow the Agent to flexibly execute tests, make dynamic decisions during conversation, and handle unexpected situations naturally. Standalone scripts are more rigid and can't adapt to conversation flow changes.

### Q: How accurate is the evaluation compared to real users?

**A:** The evaluation is based on defined criteria and may not capture all nuances of real user experience. We recommend:
1. Using this as a baseline for consistency
2. Periodically comparing with real user feedback
3. Adjusting criteria based on findings

### Q: Can I customize pass criteria?

**A:** Yes, edit the "Pass Criteria" section in karma-simulator SKILL.md to adjust thresholds.

### Q: How do I add new evaluation dimensions?

**A:**
1. Edit karma-simulator SKILL.md
2. Add new dimension to "Evaluation Dimensions" section
3. Update the overall score calculation weights
4. Update the report template

### Q: Can I test specific features only?

**A:** Yes, create a focused persona that tests only the feature you want. For example, a persona that only tests information collection without going into detailed readings.

---

## Related Documentation

- [Phase 8 Simulator Design](/Users/lizhengchen/project/Karma/docs/archive/phase8-simulator-design.md)
- [Phase 8 Test Cases](/Users/lizhengchen/project/Karma/docs/archive/phase8-test-cases.md)
- [Architecture Overview](/Users/lizhengchen/project/Karma/docs/architecture.md)
- [Platform Adapter Design](/Users/lizhengchen/project/Karma/docs/platform-adapter-design.md) - **新增**
- [Issue Analysis 2026-02-19](/Users/lizhengchen/project/Karma/docs/issue-analysis-2026-02-19.md) - **新增**
- [Karma API Server](/Users/lizhengchen/project/Karma/src/api/server.ts)

---

*Last Updated: 2026-02-20*
