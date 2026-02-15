// Prompt module exports
export { buildSystemPrompt } from './builder.js';
export { buildTimeAnchor } from './parts/time-anchor.js';
export { buildPersona, loadPersonaFromFile } from './parts/persona.js';
export { buildBaziFramework } from './parts/bazi.js';
export { buildColdReadingEngine } from './parts/cold-reading.js';
export { buildPlatformRules } from './parts/platform-rules.js';
export { buildToolGuidelines } from './parts/tool-guidelines.js';
export { buildOutputRules } from './parts/output-rules.js';
export type { Platform, PersonaConfig, SystemPromptContext, BuildPromptOptions } from './types.js';
