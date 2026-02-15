// Integration Tests - Complete Workflows
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { StorageService } from '@/storage/service';
import { loadSkills, formatSkillsForPrompt } from '@/skills/index';

describe('Integration: Skills + Storage Workflow', () => {
  const testDir = join(process.cwd(), 'tests', 'fixtures', 'integration-test');
  const skillsDir = join(testDir, 'skills');
  let storage: StorageService;

  beforeEach(async () => {
    // 创建测试 Skills 目录
    await mkdir(join(skillsDir, 'cold-reading'), { recursive: true });
    await mkdir(join(skillsDir, 'bazi'), { recursive: true });

    await writeFile(
      join(skillsDir, 'cold-reading', 'SKILL.md'),
      `---
name: cold-reading
description: 心理冷读技术 - 根据年龄阶段进行高命中率推断
---
# 心理冷读技能

## 12 阶段断言速查表
| 年龄段 | 阶段 | 高命中断言 |
|-------|------|----------|
| 25-28 | 婚恋压力 | 你谈过一段认真的感情，但没走到最后 |`
    );

    await writeFile(
      join(skillsDir, 'bazi', 'SKILL.md'),
      `---
name: bazi
description: 八字框架核心方法论
---
# 八字框架

## 大运节奏
- 用 10 年为单位给大框架`
    );

    storage = new StorageService(':memory:');
  });

  afterEach(async () => {
    storage.close();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Skills + Storage Integration', () => {
    it('should load skills and generate client profile together', async () => {
      // 1. 加载 Skills
      const result = await loadSkills({ globalDir: skillsDir });
      expect(result.skills.length).toBe(2);
      expect(result.errors.length).toBe(0);

      // 2. 创建客户档案
      const clientId = await storage.createClient({
        name: '张三',
        gender: 'male',
        birthDate: '1990-05-15',
        birthPlace: '上海',
      });

      // 3. 生成客户档案 Prompt
      const profilePrompt = await storage.generateClientProfilePrompt(clientId);
      const skillsPrompt = formatSkillsForPrompt(result.skills);

      // 4. 验证组合结果
      expect(profilePrompt).toContain('张三');
      expect(profilePrompt).toContain('1990-05-15');
      expect(skillsPrompt).toContain('<available_skills>');
      expect(skillsPrompt).toContain('cold-reading');
      expect(skillsPrompt).toContain('bazi');
    });

    it('should combine skills prompt with client profile for complete system prompt', async () => {
      // 1. 加载 Skills
      const { skills } = await loadSkills({ globalDir: skillsDir });

      // 2. 创建客户
      const clientId = await storage.createClient({
        name: '李四',
        gender: 'female',
        birthDate: '1995-08-20',
        currentCity: '深圳',
      });

      // 3. 模拟完整 System Prompt 构建
      const parts: string[] = [];

      // 时间锚点
      parts.push(`【系统时间】${new Date().toLocaleDateString('zh-CN')}`);

      // Skills 索引
      parts.push(formatSkillsForPrompt(skills));

      // 客户档案
      parts.push(await storage.generateClientProfilePrompt(clientId));

      const systemPrompt = parts.join('\n\n');

      // 验证
      expect(systemPrompt).toContain('【系统时间】');
      expect(systemPrompt).toContain('<available_skills>');
      expect(systemPrompt).toContain('cold-reading');
      expect(systemPrompt).toContain('李四');
      expect(systemPrompt).toContain('1995-08-20');
      expect(systemPrompt).toContain('深圳');
    });
  });

  describe('Complete Fortune Telling Workflow', () => {
    it('should support complete fortune telling workflow', async () => {
      // 1. 加载 Skills
      const { skills } = await loadSkills({ globalDir: skillsDir });
      const coldReadingSkill = skills.find(s => s.name === 'cold-reading');
      expect(coldReadingSkill).toBeDefined();
      expect(coldReadingSkill?.body).toContain('12 阶段');

      // 2. 创建客户
      const clientId = await storage.createClient({
        name: '测试客户',
        gender: 'male',
        birthDate: '1990-05-15',
        birthPlace: '上海',
        currentCity: '北京',
      });

      // 3. 创建会话
      const sessionId = await storage.createSession({
        clientId,
        platform: 'cli',
      });

      // 4. 模拟 Agent 做出预测
      await storage.addPrediction({
        clientId,
        sessionId,
        prediction: '28年会有一个风口',
        targetYear: 2028,
        category: 'career',
      });

      // 5. 模拟用户确认事实
      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '2022年换工作了',
        category: 'career',
        confirmed: true,
      });

      // 6. 模拟用户否认事实 + 转义
      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '2018年结婚了',
        confirmed: false,
        originalPrediction: '2018年动姻缘',
        clientResponse: '没结，2021年才结',
        reframe: '婚象在2021年应验',
      });

      // 7. 生成下次对话的客户档案 (应包含所有历史)
      const profile = await storage.generateClientProfilePrompt(clientId);

      expect(profile).toContain('测试客户');
      expect(profile).toContain('1990-05-15');
      expect(profile).toContain('上海');
      expect(profile).toContain('北京');
      expect(profile).toContain('已确认的事实');
      expect(profile).toContain('2022年换工作了');
      expect(profile).toContain('已做出的预测');
      expect(profile).toContain('28年会有一个风口');
      expect(profile).toContain('2028年');
    });

    it('should support multi-session workflow with SDK resume', async () => {
      // 1. 第一轮会话
      const clientId = await storage.createClient({
        name: '多轮客户',
        birthDate: '1988-03-10',
      });

      const sessionId1 = await storage.createSession({
        clientId,
        platform: 'cli',
      });

      // 模拟 SDK 返回 session_id
      await storage.updateSdkSessionId(sessionId1, 'sdk_session_001');

      // 添加第一轮的事实
      await storage.addConfirmedFact({
        clientId,
        sessionId: sessionId1,
        fact: '2020年买房了',
        confirmed: true,
      });

      // 结束第一轮会话
      await storage.endSession(sessionId1, '完成了初步解读');

      // 2. 模拟程序重启 - 通过 SDK session_id 恢复
      const session = await storage.getSessionBySdkId('sdk_session_001');
      expect(session).not.toBeNull();
      expect(session?.status).toBe('completed');

      // 3. 创建新会话继续对话
      const sessionId2 = await storage.createSession({
        clientId,
        platform: 'cli',
      });

      // 新会话应该能访问之前的客户档案
      const profile = await storage.generateClientProfilePrompt(clientId);
      expect(profile).toContain('多轮客户');
      expect(profile).toContain('2020年买房了');  // 第一轮的事实

      // 4. 验证客户的会话计数
      const client = await storage.getClient(clientId);
      expect(client?.sessionCount).toBe(1);  // 初始是 1
    });

    it('should filter disabled skills from prompt', async () => {
      // 创建一个禁用的 skill
      await mkdir(join(skillsDir, 'internal-skill'), { recursive: true });
      await writeFile(
        join(skillsDir, 'internal-skill', 'SKILL.md'),
        `---
name: internal-skill
description: 仅内部使用
disable-model-invocation: true
---
内部指导`
      );

      // 加载 Skills
      const { skills } = await loadSkills({ globalDir: skillsDir });

      // 生成 Prompt
      const prompt = formatSkillsForPrompt(skills);

      // 验证：应该包含启用的，不包含禁用的
      expect(prompt).toContain('cold-reading');
      expect(prompt).toContain('bazi');
      expect(prompt).not.toContain('internal-skill');
    });
  });

  describe('Platform-Specific Workflows', () => {
    it('should support Feishu platform workflow', async () => {
      // 1. 创建 Feishu 会话
      const sessionId = await storage.createSession({
        platform: 'feishu',
        externalChatId: 'oc_feishu_12345',
      });

      // 2. 更新 SDK session_id
      await storage.updateSdkSessionId(sessionId, 'sdk_feishu_001');

      // 3. 通过 external_chat_id 查找会话
      const found = await storage.getSessionByExternalChatId('feishu', 'oc_feishu_12345');
      expect(found).not.toBeNull();
      expect(found?.sdkSessionId).toBe('sdk_feishu_001');

      // 4. 添加消息记录
      await storage.addMessage(sessionId, 'user', '帮我算一下事业');
      await storage.addMessage(
        sessionId,
        'assistant',
        '好的，请提供你的生辰...',
        '<inner_monologue>用户询问事业</inner_monologue>好的，请提供...'
      );

      // 5. 验证消息
      const messages = await storage.getSessionMessages(sessionId);
      expect(messages.length).toBe(2);
      // rawContent 可能为 null，检查第二条消息（assistant）
      const assistantMsg = messages.find(m => m.role === 'assistant');
      expect(assistantMsg?.rawContent ?? '').toContain('inner_monologue');
    });

    it('should support CLI platform workflow', async () => {
      // 1. 创建 CLI 会话 (无 external_chat_id)
      const sessionId = await storage.createSession({
        platform: 'cli',
      });

      // 2. 后续关联客户
      const clientId = await storage.createClient({
        name: 'CLI用户',
        birthDate: '1992-07-15',
      });

      // 3. 验证无 external_chat_id 的会话
      const session = await storage.getSession(sessionId);
      expect(session?.externalChatId).toBeNull();
      expect(session?.platform).toBe('cli');
    });
  });
});
