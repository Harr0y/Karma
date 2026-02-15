// Skills Loader - Load skills from directories

import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from 'os';
import { glob } from 'glob';
import type { Skill, LoadSkillsOptions, LoadSkillsResult, SkillLoadError } from './types.js';
import { parseSkillFile } from './parser.js';

/**
 * Discover SKILL.md files in a directory
 * - SKILL.md in subdirectories
 * - *.md in root directory
 */
export async function discoverSkillFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Check for SKILL.md in subdirectory
        const skillFile = join(fullPath, 'SKILL.md');
        try {
          const s = await stat(skillFile);
          if (s.isFile()) {
            files.push(skillFile);
          }
        } catch {
          // SKILL.md doesn't exist, skip
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Root-level .md files
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return files;
}

/**
 * Load skills from a single directory
 */
async function loadSkillsFromDir(
  dir: string,
  source: Skill['source']
): Promise<{ skills: Skill[]; errors: SkillLoadError[] }> {
  const skills: Skill[] = [];
  const errors: SkillLoadError[] = [];

  const files = await discoverSkillFiles(dir);

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const result = parseSkillFile(content, filePath, source);

      if (result.skill) {
        skills.push(result.skill);
      } else if (result.error) {
        errors.push({ filePath, error: result.error });
      }
    } catch (e) {
      errors.push({
        filePath,
        error: `Failed to read file: ${e instanceof Error ? e.message : 'Unknown error'}`,
      });
    }
  }

  return { skills, errors };
}

/**
 * Load all skills from configured directories
 */
export async function loadSkills(options: LoadSkillsOptions = {}): Promise<LoadSkillsResult> {
  const { cwd = process.cwd() } = options;

  const globalDir = options.globalDir ?? join(homedir(), '.karmav2', 'skills');
  const projectDir = options.projectDir ?? join(cwd, '.karma', 'skills');

  const allSkills: Skill[] = [];
  const allErrors: SkillLoadError[] = [];
  const seenNames = new Set<string>();

  // Load from global directory
  const globalResult = await loadSkillsFromDir(globalDir, 'global');
  for (const skill of globalResult.skills) {
    if (!seenNames.has(skill.name)) {
      seenNames.add(skill.name);
      allSkills.push(skill);
    }
  }
  allErrors.push(...globalResult.errors);

  // Load from project directory
  const projectResult = await loadSkillsFromDir(projectDir, 'project');
  for (const skill of projectResult.skills) {
    if (!seenNames.has(skill.name)) {
      seenNames.add(skill.name);
      allSkills.push(skill);
    } else {
      // Project skill overwrites global skill with same name
      const index = allSkills.findIndex(s => s.name === skill.name);
      if (index !== -1) {
        allSkills[index] = skill;
      }
    }
  }
  allErrors.push(...projectResult.errors);

  return { skills: allSkills, errors: allErrors };
}
