// Skills Parser - Parse and validate SKILL.md files

import matter from 'gray-matter';
import type { Skill, SkillFrontmatter } from './types.js';

export interface ParseResult {
  skill: Skill | null;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  data?: SkillFrontmatter;
  error?: string;
}

/**
 * Validate skill name format
 * Rules: lowercase a-z, 0-9, hyphens only; no leading/trailing hyphens; no consecutive hyphens
 */
function isValidName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.length > 64) return false;
  if (!/^[a-z0-9-]+$/.test(name)) return false;
  if (name.startsWith('-') || name.endsWith('-')) return false;
  if (name.includes('--')) return false;
  return true;
}

/**
 * Validate frontmatter fields
 */
export function validateFrontmatter(frontmatter: unknown): ValidationResult {
  if (!frontmatter || typeof frontmatter !== 'object') {
    return { valid: false, error: 'Frontmatter must be an object' };
  }

  const fm = frontmatter as Record<string, unknown>;

  // Check required fields
  if (!fm.name) {
    return { valid: false, error: 'Missing required field: name' };
  }

  if (typeof fm.name !== 'string') {
    return { valid: false, error: 'Field "name" must be a string' };
  }

  if (!isValidName(fm.name)) {
    return { valid: false, error: 'Invalid name format (must be lowercase a-z, 0-9, hyphens; no leading/trailing/consecutive hyphens)' };
  }

  if (!fm.description) {
    return { valid: false, error: 'Missing required field: description' };
  }

  if (typeof fm.description !== 'string') {
    return { valid: false, error: 'Field "description" must be a string' };
  }

  if (fm.description.length > 1024) {
    return { valid: false, error: 'Description exceeds 1024 characters' };
  }

  const data: SkillFrontmatter = {
    name: fm.name,
    description: fm.description,
  };

  if (fm['disable-model-invocation'] !== undefined) {
    data['disable-model-invocation'] = Boolean(fm['disable-model-invocation']);
  }

  return { valid: true, data };
}

/**
 * Parse a SKILL.md file content
 */
export function parseSkillFile(
  content: string,
  filePath: string,
  source: Skill['source']
): ParseResult {
  if (!content || content.trim().length === 0) {
    return { skill: null, error: 'Empty file' };
  }

  let parsed;
  try {
    parsed = matter(content);
  } catch (e) {
    return { skill: null, error: `Failed to parse frontmatter: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }

  // Check if frontmatter exists
  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    return { skill: null, error: 'No frontmatter found. Skills require YAML frontmatter with name and description.' };
  }

  // Validate frontmatter
  const validation = validateFrontmatter(parsed.data);
  if (!validation.valid) {
    return { skill: null, error: validation.error };
  }

  const fm = validation.data!;

  const skill: Skill = {
    name: fm.name,
    description: fm.description,
    filePath,
    content,
    body: parsed.content.trim(),
    disableModelInvocation: fm['disable-model-invocation'] ?? false,
    source,
  };

  return { skill };
}
