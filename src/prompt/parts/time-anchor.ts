// Time Anchor - 注入精确的日期时间

/**
 * 构建时间锚点，作为 System Prompt 的第一部分
 * 使用 zh-CN 格式
 */
export function buildTimeAnchor(now: Date): string {
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const year = now.getFullYear();

  return `【系统时间锚点】今天是 ${dateStr}。当前年份是 ${year} 年。
请以此为绝对基准计算客人的年龄和流年运势。所有年龄计算都以此为准。`;
}
