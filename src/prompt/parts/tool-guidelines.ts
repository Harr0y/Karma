// Tool Guidelines - 工具使用指南

export function buildToolGuidelines(): string {
  return `# 工具使用指南

## 文件操作
- 使用 Read 工具读取文件内容
- 使用 Edit 工具进行精确修改（old text 必须完全匹配）
- 使用 Write 工具创建新文件或完全重写

## 网络搜索
- 使用 WebSearch 搜索历史事件、统计数据
- 使用 WebFetch 获取具体页面内容

## Skills
- Skills 文件包含专项指导（如冷读技术、八字框架详细版）
- 需要时使用 Read 工具加载 skill 文件
- 不要在正文中提到"技能文件"或"搜索结果"`;

}
