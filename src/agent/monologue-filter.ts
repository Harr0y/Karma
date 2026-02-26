// Monologue Filter - 过滤内部标签

/**
 * 需要从用户输出中过滤的标签列表
 * 这些标签用于系统提取信息，用户不应看到
 */
const FILTER_TAGS = [
  'inner_monologue',
  'client_info',
  'confirmed_fact',
  'prediction',
] as const;

/**
 * 需要完全过滤的标签（内容也过滤）
 */
const FULL_FILTER_TAGS = [
  'client_info',
  'confirmed_fact',
  'prediction',
] as const;

/**
 * 匹配开始标签的正则表达式
 * 支持 <tag> 和 <tag attr="value"> 两种格式
 */
const START_TAG_REGEX = new RegExp(
  `<(${FILTER_TAGS.join('|')})(?:\\s+[^>]*)?>`,
  'g'
);

/**
 * MonologueFilter 选项
 */
export interface MonologueFilterOptions {
  /**
   * 是否保留 inner_monologue 的内容（去掉标签）
   * 默认 false（完全过滤）
   * 设为 true 时，inner_monologue 内容会输出但标签会被移除
   */
  keepInnerMonologue?: boolean;
}

/**
 * 过滤器 - 过滤流式文本中的内部标签
 * 用户看不到这些标签内的内容：
 * - <inner_monologue> - AI 思考过程
 * - <client_info> - 客户信息
 * - <confirmed_fact> - 确认的事实（支持 category 属性）
 * - <prediction> - 预测（支持 year 属性）
 */
export class MonologueFilter {
  private buffer = '';
  private insideTag: string | null = null;
  private hasOutput = false;
  private keepInnerMonologue: boolean;

  constructor(options: MonologueFilterOptions = {}) {
    this.keepInnerMonologue = options.keepInnerMonologue ?? false;
  }

  /**
   * 处理一段文本，过滤所有内部标签
   * @param text 输入文本
   * @returns 过滤后的文本（可能为空）
   */
  process(text: string): string {
    this.buffer += text;
    const output: string[] = [];

    while (this.buffer.length > 0) {
      if (this.insideTag) {
        // 在标签内部，查找结束标签
        const endTag = `</${this.insideTag}>`;
        const endIdx = this.buffer.indexOf(endTag);

        if (endIdx !== -1) {
          // 如果是 inner_monologue 且 keepInnerMonologue 为 true，输出内容
          if (this.insideTag === 'inner_monologue' && this.keepInnerMonologue) {
            const content = this.buffer.slice(0, endIdx);
            output.push(content);
          }
          // 其他情况：完全过滤（不输出内容）
          this.buffer = this.buffer.slice(endIdx + endTag.length);
          this.insideTag = null;
        } else {
          // 结束标签可能还没到
          // 如果是 inner_monologue 且 keepInnerMonologue 为 true，可以输出安全部分
          if (this.insideTag === 'inner_monologue' && this.keepInnerMonologue) {
            // 保留尾部（可能是部分结束标签）
            const keepLen = endTag.length;
            if (this.buffer.length > keepLen) {
              const safeContent = this.buffer.slice(0, -keepLen);
              output.push(safeContent);
              this.buffer = this.buffer.slice(-keepLen);
            }
          } else {
            // 完全过滤：保留尾部（可能是部分标签）
            const keepLen = endTag.length;
            if (this.buffer.length > keepLen) {
              this.buffer = this.buffer.slice(-keepLen);
            }
          }
          break;
        }
      } else {
        // 在标签外部，查找最近的开始标签
        const result = this.findEarliestStartTag();

        if (result.idx !== -1 && result.tag) {
          // 输出标签前的内容
          const before = this.buffer.slice(0, result.idx);
          if (before.length > 0) {
            output.push(before);
          }
          // 跳过整个开始标签（包括属性）
          this.buffer = this.buffer.slice(result.idx + result.fullMatch.length);
          this.insideTag = result.tag;
        } else {
          // 没有找到开始标签，检查尾部是否有部分标签
          const potentialTagStart = this.buffer.lastIndexOf('<');
          if (potentialTagStart !== -1) {
            // 检查尾部是否可能是某个标签的开始
            const tail = this.buffer.slice(potentialTagStart);
            const couldBeTagStart = this.couldBeStartTag(tail);

            if (couldBeTagStart) {
              // 安全输出确定不是标签的部分
              const safe = this.buffer.slice(0, potentialTagStart);
              if (safe.length > 0) {
                output.push(safe);
              }
              this.buffer = tail;
              break;
            }
          }
          // 全部安全
          output.push(this.buffer);
          this.buffer = '';
        }
      }
    }

    const result = output.join('');
    if (result.length > 0) {
      this.hasOutput = true;
    }
    return result;
  }

  /**
   * 检查字符串是否可能是某个开始标签的前缀
   */
  private couldBeStartTag(str: string): boolean {
    if (!str.startsWith('<')) return false;

    for (const tag of FILTER_TAGS) {
      const fullTag = `<${tag}`;
      if (fullTag.startsWith(str) && str.length < fullTag.length + 20) {
        // 允许一定的属性长度
        return true;
      }
    }
    return false;
  }

  /**
   * 查找 buffer 中最早的开始标签
   * 返回标签名、位置和完整匹配
   */
  private findEarliestStartTag(): { idx: number; tag: string | null; fullMatch: string } {
    let earliestIdx = -1;
    let earliestTag: string | null = null;
    let fullMatch = '';

    // 重置正则表达式的 lastIndex
    START_TAG_REGEX.lastIndex = 0;

    let match;
    while ((match = START_TAG_REGEX.exec(this.buffer)) !== null) {
      if (earliestIdx === -1 || match.index < earliestIdx) {
        earliestIdx = match.index;
        earliestTag = match[1];
        fullMatch = match[0];
      }
    }

    return { idx: earliestIdx, tag: earliestTag, fullMatch };
  }

  /**
   * 刷新剩余内容
   * 流结束时调用，处理可能被截断的内容
   */
  flush(): string {
    let result = '';

    if (this.buffer.length > 0) {
      if (this.insideTag) {
        // 如果还在标签内部，说明被截断了
        // 清除开始标签残余后输出
        const tagPattern = new RegExp(`<${this.insideTag}(?:\\s+[^>]*)?>?`, 'g');
        const cleaned = this.buffer.replace(tagPattern, '');
        result = cleaned;
      } else {
        result = this.buffer;
      }
      this.buffer = '';
    }

    if (result.length > 0) {
      this.hasOutput = true;
    }
    return result;
  }

  /**
   * 是否有输出
   */
  get hadOutput(): boolean {
    return this.hasOutput;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.buffer = '';
    this.insideTag = null;
    this.hasOutput = false;
  }
}
