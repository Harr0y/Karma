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
    '# Available Skills',
    '',
    'The following skills provide specialized instructions. When you need a skill:',
    '1. Find the skill by name in the list below',
    '2. Use the Read tool with the EXACT <location> path provided',
    '3. DO NOT guess or hallucinate skill paths - only use the locations shown below',
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
  lines.push('');
  lines.push('Example: To load a skill, use Read tool with file_path = the <location> value from above');

  return lines.join('\n');
}
