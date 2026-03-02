// Misinterpretations - 常见误读警示

import { getDefaultLoader } from '../loader.js';

// 保留默认内容作为 fallback
const DEFAULT_MISINTERPRETATIONS = `# Common Misinterpretations

## Avoid These Patterns

1. Over-reading five elements: Slight excess ≠ severe imbalance
2. Over-dramatizing clashes: Clash ≠ inevitable disaster
3. Age calculation errors: Always verify dayun starting age
4. Vague timeframes: "这几年" is not impressive

## Common Wrong Prediction Patterns

1. Assuming marital/parental status from bazi alone
2. Income prediction from single wealth factor
3. Cold reading without verification
4. Post-hoc rationalization instead of honest admission

## Self-Check Before Each Assertion

1. Is this based on tool output?
2. Did client confirm similar statements?
3. Am I over-stating the case?
4. Is there contradictory evidence?`;

/**
 * 构建误读警示部分
 */
export async function buildMisinterpretations(): Promise<string> {
  try {
    const loader = getDefaultLoader();
    return await loader.loadPrompt('misinterpretations', DEFAULT_MISINTERPRETATIONS);
  } catch {
    return DEFAULT_MISINTERPRETATIONS;
  }
}
