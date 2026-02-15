// Monologue Filter - 过滤 <inner_monologue> 标签

/**
 * 过滤器 - 过滤流式文本中的 <inner_monologue>...</inner_monologue> 标签
 * 用户看不到 inner_monologue 内的内容
 */
export class MonologueFilter {
  private buffer = '';
  private insideMonologue = false;
  private hasOutput = false;

  /**
   * 处理一段文本，过滤 inner_monologue 标签
   * @param text 输入文本
   * @returns 过滤后的文本（可能为空）
   */
  process(text: string): string {
    this.buffer += text;
    const output: string[] = [];

    while (this.buffer.length > 0) {
      if (this.insideMonologue) {
        // 在 monologue 内部，查找结束标签
        const endIdx = this.buffer.indexOf('</inner_monologue>');
        if (endIdx !== -1) {
          this.buffer = this.buffer.slice(endIdx + '</inner_monologue>'.length);
          this.insideMonologue = false;
        } else {
          // 结束标签可能还没到，保留尾部（可能是部分标签）
          const keepLen = '</inner_monologue>'.length;
          if (this.buffer.length > keepLen) {
            this.buffer = this.buffer.slice(-keepLen);
          }
          break;
        }
      } else {
        // 在 monologue 外部，查找开始标签
        const startIdx = this.buffer.indexOf('<inner_monologue>');
        if (startIdx !== -1) {
          // 输出标签前的内容
          const before = this.buffer.slice(0, startIdx);
          if (before.length > 0) {
            output.push(before);
          }
          this.buffer = this.buffer.slice(startIdx + '<inner_monologue>'.length);
          this.insideMonologue = true;
        } else {
          // 没有开始标签，但可能有部分标签在尾部
          const potentialTagStart = this.buffer.lastIndexOf('<');
          if (potentialTagStart !== -1 && potentialTagStart > this.buffer.length - '<inner_monologue>'.length) {
            // 安全输出确定不是标签的部分
            const safe = this.buffer.slice(0, potentialTagStart);
            if (safe.length > 0) {
              output.push(safe);
            }
            this.buffer = this.buffer.slice(potentialTagStart);
            break;
          } else {
            // 全部安全
            output.push(this.buffer);
            this.buffer = '';
          }
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
   * 刷新剩余内容
   * 流结束时调用，处理可能被截断的内容
   */
  flush(): string {
    let result = '';

    if (this.buffer.length > 0) {
      if (this.insideMonologue) {
        // 如果还在 monologue 内部，说明被截断了
        // 清除 inner_monologue 标签残余后输出
        const cleaned = this.buffer.replace(/<inner_monologue>?/g, '');
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
    this.insideMonologue = false;
    this.hasOutput = false;
  }
}
