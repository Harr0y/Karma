// History Extractor - 从客户历史提取特征

import type { StorageService } from '@/storage/service.js';
import type { HistoryFeatures, Client } from './types.js';

export class HistoryExtractor {
  private storage: StorageService;

  constructor(storage: StorageService) {
    this.storage = storage;
  }

  /**
   * 从客户历史提取特征
   */
  async extract(clientId: string): Promise<HistoryFeatures> {
    // 获取客户的所有事实
    const facts = await this.storage.getClientFacts(clientId);

    // 获取客户的所有会话
    const sessions = await this.storage.getClientSessions?.(clientId) ?? [];

    // 计算话题分布
    const topicCounts: Record<string, number> = {};
    for (const fact of facts) {
      if (fact.category) {
        topicCounts[fact.category] = (topicCounts[fact.category] ?? 0) + 1;
      }
    }

    // 取前 3 个高频话题
    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic]) => topic);

    // 计算断言命中率
    const confirmedCount = facts.filter(f => f.confirmed === true).length;
    const totalAssertions = facts.length;
    const confirmedFactRate = totalAssertions > 0 ? confirmedCount / totalAssertions : 0;

    // 最近会话时间
    const lastSessionDate = sessions.length > 0 ? sessions[0].startedAt : undefined;

    return {
      topTopics,
      confirmedFactRate,
      totalSessions: sessions.length,
      lastSessionDate,
    };
  }

  /**
   * 生成用户微调片段
   */
  generateTuning(client: Client | null, history: HistoryFeatures): string {
    const parts: string[] = [];

    // 老客户
    const sessionCount = client?.sessionCount ?? 0;
    if (client && sessionCount >= 3) {
      parts.push(`这是第 ${sessionCount} 次来咨询的老客户，可以更直接、更深入。`);
    } else if (client && sessionCount >= 2) {
      parts.push(`这是第 ${sessionCount} 次来咨询。`);
    }

    // 姓名已知
    if (client?.name) {
      parts.push(`客户叫 ${client.name}。`);
    }

    // 性别
    if (client?.gender) {
      parts.push(`客户是${client.gender === 'male' ? '男' : '女'}性。`);
    }

    // 历史话题
    if (history.topTopics.length > 0) {
      parts.push(`客户最关心的话题：${history.topTopics.join('、')}。`);
    }

    // 命中率调整
    if (history.confirmedFactRate > 0 && history.confirmedFactRate < 0.5) {
      parts.push(`注意：之前的断言命中率较低，需要更谨慎。`);
    }

    return parts.join('\n');
  }
}
