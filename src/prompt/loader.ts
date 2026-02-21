// Prompt Loader - 从文件系统加载 prompt
import { readFile, readdir, access } from 'fs/promises';
import { join, extname, basename } from 'path';
import { constants } from 'fs';

/**
 * Prompt 加载器接口
 */
export interface PromptLoader {
  loadPrompt(name: string, fallback?: string, reload?: boolean): Promise<string>;
  loadPlatformRules(platform: string): Promise<string>;
  listAvailablePrompts(): Promise<string[]>;
  hasPrompt(name: string): Promise<boolean>;
}

/**
 * 文件系统 Prompt 加载器
 */
export class FilePromptLoader implements PromptLoader {
  private basePath: string;
  private cache: Map<string, string> = new Map();

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  /**
   * 加载指定名称的 prompt
   * @param name prompt 名称（不含扩展名）
   * @param fallback 文件不存在时的回退内容
   * @param reload 是否强制重新加载（绕过缓存）
   */
  async loadPrompt(name: string, fallback?: string, reload = false): Promise<string> {
    // 检查缓存
    if (!reload && this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    const filePath = join(this.basePath, `${name}.md`);

    try {
      const content = await readFile(filePath, 'utf-8');
      const trimmed = content.trim();

      // 缓存结果
      this.cache.set(name, trimmed);

      return trimmed;
    } catch (error) {
      // 文件不存在
      if (fallback !== undefined) {
        return fallback;
      }
      throw new Error(`Prompt file not found: ${filePath}`);
    }
  }

  /**
   * 加载平台规则
   * @param platform 平台名称 (cli | feishu | wechat)
   */
  async loadPlatformRules(platform: string): Promise<string> {
    const validPlatforms = ['cli', 'feishu', 'wechat'];

    if (!validPlatforms.includes(platform)) {
      return '';
    }

    const filePath = join(this.basePath, 'platforms', `${platform}.md`);

    try {
      const content = await readFile(filePath, 'utf-8');
      return content.trim();
    } catch {
      // 平台规则文件不存在，返回空
      return '';
    }
  }

  /**
   * 列出所有可用的 prompt 名称
   */
  async listAvailablePrompts(): Promise<string[]> {
    try {
      const files = await readdir(this.basePath, { withFileTypes: true });

      return files
        .filter(dirent => dirent.isFile() && extname(dirent.name) === '.md')
        .map(dirent => basename(dirent.name, '.md'));
    } catch {
      return [];
    }
  }

  /**
   * 检查 prompt 是否存在
   */
  async hasPrompt(name: string): Promise<boolean> {
    const filePath = join(this.basePath, `${name}.md`);

    try {
      await access(filePath, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * 全局默认加载器实例
 * 使用 config/prompts 目录
 */
let defaultLoader: FilePromptLoader | null = null;

export function getDefaultLoader(): FilePromptLoader {
  if (!defaultLoader) {
    const configPath = join(process.cwd(), 'config', 'prompts');
    defaultLoader = new FilePromptLoader(configPath);
  }
  return defaultLoader;
}

/**
 * 重置默认加载器（用于测试）
 */
export function resetDefaultLoader(): void {
  defaultLoader = null;
}
