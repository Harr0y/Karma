// Skills System Types

export interface SkillFrontmatter {
  name: string;
  description: string;
  'disable-model-invocation'?: boolean;
}

export interface Skill {
  name: string;
  description: string;
  filePath: string;
  content: string;              // 完整内容 (包括 frontmatter)
  body: string;                 // 仅 body (不含 frontmatter)
  disableModelInvocation: boolean;
  source: 'global' | 'project' | 'path';
}

export interface LoadSkillsOptions {
  globalDir?: string;    // 默认: ~/.karmav2/skills
  projectDir?: string;   // 默认: {cwd}/.karma/skills
  cwd?: string;          // 用于解析相对路径
}

export interface LoadSkillsResult {
  skills: Skill[];
  errors: SkillLoadError[];
}

export interface SkillLoadError {
  filePath: string;
  error: string;
}
