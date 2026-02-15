// Skills Formatter - Format skills for system prompt

import type { Skill } from './types.js';

/**
 * Filter out skills with disableModelInvocation=true
 */
export function getVisibleSkills(skills: Skill[]): Skill[] {
  return skills.filter(skill => !skill.disableModelInvocation);
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format skills as XML index for system prompt
 * The model should use the Read tool to load the full skill content
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  const visibleSkills = getVisibleSkills(skills);

  if (visibleSkills.length === 0) {
    return '';
  }

  const lines: string[] = [
    '',
    'The following skills provide specialized instructions for specific tasks.',
    'Use the Read tool to load a skill\'s file when the task matches its description.',
    'When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path).',
    '',
    '<available_skills>',
  ];

  for (const skill of visibleSkills) {
    lines.push('  <skill>');
    lines.push(`    <name>${escapeXml(skill.name)}</name>`);
    lines.push(`    <description>${escapeXml(skill.description)}</description>`);
    lines.push(`    <location>${escapeXml(skill.filePath)}</location>`);
    lines.push('  </skill>');
  }

  lines.push('</available_skills>');

  return lines.join('\n');
}
