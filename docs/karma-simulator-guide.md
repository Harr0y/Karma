# Karma Simulator - Agent-to-Agent Testing Guide

> Use disclaude's karma-simulator skill to automatically test Karma's conversation quality

---

## Overview

**What is karma-simulator?**

It's a skill that runs in disclaude, simulating real users having conversations with Karma, then evaluating and scoring the quality.

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                      disclaude                          │
│                                                         │
│  skills/karma-simulator/SKILL.md                        │
│  - Main simulator logic                                 │
│  - Calls Karma API                                      │
│  - Evaluates and scores                                 │
│  - Generates test reports                               │
│                                                         │
│  skills/personas/                                       │
│  ├── curious-young/SKILL.md    # 25yo programmer        │
│  ├── anxious-mom/SKILL.md      # 38yo worried mother    │
│  └── skeptical-pro/SKILL.md    # 35yo engineer skeptic  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP API
                          ▼
┌─────────────────────────────────────────────────────────┐
│                       Karma                             │
│                                                         │
│  src/api/server.ts                                      │
│  - POST /api/session   Create session                   │
│  - POST /api/chat      Send message (SSE streaming)     │
│  - GET  /api/history   Get history                      │
│  - GET  /health        Health check                     │
│                                                         │
│  CLI: npm run server                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Step 1: Start Karma Server

```bash
cd /Users/lizhengchen/project/karma
npm run server
```

Verify it's running:
```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","service":"karma-api"}
```

### Step 2: Run Test in disclaude

In disclaude, say:
```
Run karma-simulator with curious-young persona
```

Or simply:
```
Test Karma's performance
```

The simulator will automatically:
1. Check Karma server status
2. Select a persona (default: curious-young)
3. Execute conversation simulation (max 15 rounds)
4. Evaluate and score
5. Generate test report

### Step 3: View Report

Reports are saved to:
```
/Users/lizhengchen/project/karma/test-reports/{persona}-{timestamp}.md
```

---

## Available Personas

| Persona | Description | Test Focus |
|---------|-------------|------------|
| **curious-young** | 25yo programmer, first time trying fortune telling, casual speech | Information extraction, affinity |
| **anxious-mom** | 38yo housewife, worried about child's studies | Emotional comfort, advice quality |
| **skeptical-pro** | 35yo engineer, strong logic, challenges accuracy | Handling skepticism, professionalism |

---

## Evaluation Dimensions (50 points total)

### 1. Information Extraction (10 points)
- Name or address term
- Birth date
- Birth time
- Birth place
- Consultation purpose

### 2. Affinity (10 points)
- Warm and natural greeting
- Adapts to user's communication style
- Shows empathy and understanding
- Friendly closing

### 3. Professionalism (10 points)
- Accurate BaZi interpretation
- Clear and logical reasoning
- Specific and actionable advice
- No absolute promises

### 4. Conversation Naturalness (10 points)
- Language style matches user
- Appropriate reply length
- Smooth topic transitions
- No repetitive content

### 5. Assertion Quality (10 points)
- Makes specific assertions, not just questions
- Reasonable assertion hit rate
- No vague predictions

---

## Pass Criteria

- ✅ Total score ≥ 35/50 (70%)
- ✅ No P0 issues (serious errors, inappropriate content)
- ✅ Information extraction ≥ 6/10

### P0 Issues (Immediate Fail)
- Inappropriate content (religiously sensitive, discriminatory, etc.)
- Claims to be AI or program
- Makes absolute promises ("will definitely")
- No BaZi interpretation at all

---

## Creating New Personas

### Step 1: Create Directory

```bash
mkdir -p /Users/lizhengchen/project/disclaude/skills/personas/new-persona
```

### Step 2: Create SKILL.md

```markdown
---
name: new-persona
description: Brief description of the persona
disable-model-invocation: true
---

# Persona: Name

## Basic Profile

```yaml
id: new-persona
name: Name
age: XX
gender: male/female
occupation: job
city: City
```

## Birth Information

```yaml
birthDate: "YYYY-MM-DD"
birthTime: "HH:MM"
birthPlace: "City, Province"
```

## Personality Traits

- Trait 1
- Trait 2
- ...

## Consultation Purpose

- Purpose 1
- Purpose 2

## Communication Style

- Style characteristic 1
- Style characteristic 2

## Expected Conversation Flow

\`\`\`
[Round 1] User: ...

[Round 2] User: ...

...
\`\`\`

## Evaluation Focus

### Dimension Name (10 points)

| Item | Expected | Points |
|------|----------|--------|
| Item 1 | ... | 2 |
| Item 2 | ... | 2 |
```

### Step 3: Register in karma-simulator

Edit `/Users/lizhengchen/project/disclaude/skills/karma-simulator/SKILL.md`, add to "Available Personas" section:

```markdown
- **new-persona** - Description of the new persona
```

---

## File Structure

```
disclaude/
└── skills/
    ├── karma-simulator/
    │   └── SKILL.md          # Main simulator logic
    └── personas/
        ├── curious-young/
        │   └── SKILL.md      # Persona definition + evaluation
        ├── anxious-mom/
        │   └── SKILL.md
        └── skeptical-pro/
            └── SKILL.md

karma/
├── src/api/
│   └── server.ts             # HTTP API server
└── test-reports/             # Generated test reports
    └── {persona}-{timestamp}.md
```

---

## FAQ

### Q: Why use skills instead of standalone scripts?

A: Skills allow the Agent to flexibly execute tests, make dynamic decisions, and handle unexpected situations. Standalone scripts are more rigid.

### Q: How to run multiple persona tests at once?

A: In disclaude, say:
```
Run karma-simulator with all personas
```

### Q: How to add new evaluation dimensions?

A: Edit the karma-simulator SKILL.md, add new dimensions to the "Evaluate Conversation" section, and update the report template.

### Q: Can I customize pass criteria?

A: Yes, edit the "Pass Conditions" section in karma-simulator SKILL.md.

---

## Related Documentation

- [Phase 8 Simulator Design](/Users/lizhengchen/project/karma/docs/archive/phase8-simulator-design.md)
- [Phase 8 Test Cases](/Users/lizhengchen/project/karma/docs/archive/phase8-test-cases.md)
- [Karma API Server](/Users/lizhengchen/project/karma/src/api/server.ts)
