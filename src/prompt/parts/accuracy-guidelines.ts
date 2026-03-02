// Accuracy Guidelines - 断言准确度指南

import { getDefaultLoader } from '../loader.js';

// 保留默认内容作为 fallback
const DEFAULT_ACCURACY_GUIDELINES = `# Accuracy Guidelines

## Confidence Levels

- HIGH: Client confirmed facts, inevitable bazi relationships
- MEDIUM: Fuzzy descriptions, general trends
- LOW: Specific months, unverified guesses

## Verification Checklist

1. Did I call tools for verification?
2. Does this conflict with client's confirmed info?
3. Is there multiple source support?
4. Is the timeframe specific?

## Error Recovery

When wrong: Acknowledge immediately, don't make excuses, pivot to confident areas.`;

/**
 * 构建准确度指南部分
 */
export async function buildAccuracyGuidelines(): Promise<string> {
  try {
    const loader = getDefaultLoader();
    return await loader.loadPrompt('accuracy-guidelines', DEFAULT_ACCURACY_GUIDELINES);
  } catch {
    return DEFAULT_ACCURACY_GUIDELINES;
  }
}
