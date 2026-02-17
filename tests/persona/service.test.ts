// Persona Service Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { PersonaService } from '@/persona/service.js';
import { HistoryExtractor } from '@/persona/history-extractor.js';
import { StorageService } from '@/storage/service.js';
import type { Client } from '@/storage/schema.js';

describe('PersonaService', () => {
  let storage: StorageService;
  let service: PersonaService;
  let testDir: string;
  let soulPath: string;

  beforeEach(async () => {
    storage = new StorageService(':memory:');
    testDir = join(process.cwd(), 'tests', 'fixtures', 'persona-test');
    soulPath = join(testDir, 'SOUL.md');
    await mkdir(testDir, { recursive: true });
    service = new PersonaService({ soulPath, storage });
  });

  afterEach(async () => {
    storage.close();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('loadSoul', () => {
    it('should load SOUL.md as base persona', async () => {
      await writeFile(soulPath, `---
name: test-persona
---

# 你的身份

你是一位测试命理师。
`);

      const persona = await service.getPersona();
      expect(persona).toContain('你是一位测试命理师');
    });

    it('should fallback to default if SOUL.md not found', async () => {
      const persona = await service.getPersona();
      expect(persona).toContain('三十年经验的命理师');
    });

    it('should strip frontmatter from content', async () => {
      await writeFile(soulPath, `---
name: test
version: 1.0.0
---

# 正文内容
`);

      const persona = await service.getPersona();
      expect(persona).not.toContain('name: test');
      expect(persona).toContain('正文内容');
    });
  });

  describe('user tuning', () => {
    it('should append user tuning when clientId provided', async () => {
      await writeFile(soulPath, `# 基础人设`);

      const clientId = await storage.createClient({
        name: '张先生',
        gender: 'male',
      });

      const persona = await service.getPersona(clientId);

      expect(persona).toContain('基础人设');
      expect(persona).toContain('张先生');
    });

    it('should not append tuning for new clients', async () => {
      await writeFile(soulPath, `# 基础人设`);

      const clientId = await storage.createClient({});

      const persona = await service.getPersona(clientId);

      // 新客户没有姓名、性别、历史话题等，所以只有基础人设
      expect(persona.trim()).toBe('# 基础人设');
    });

    it('should include sessionCount in tuning', async () => {
      await writeFile(soulPath, `# 基础人设`);

      const clientId = await storage.createClient({
        name: '老客户',
        sessionCount: 3,
      });

      // 需要更新 storage 中的 sessionCount
      await storage.updateClient(clientId, { sessionCount: 3 });

      const persona = await service.getPersona(clientId);

      expect(persona).toContain('第 3 次');
      expect(persona).toContain('老客户');
    });

    it('should include gender in tuning', async () => {
      await writeFile(soulPath, `# 基础人设`);

      const clientId = await storage.createClient({
        name: '李女士',
        gender: 'female',
      });

      const persona = await service.getPersona(clientId);

      expect(persona).toContain('女性');
    });
  });

  describe('caching', () => {
    it('should cache SOUL.md content', async () => {
      await writeFile(soulPath, `# 版本1`);

      await service.getPersona(); // Load and cache

      // Modify file
      await writeFile(soulPath, `# 版本2`);

      const persona = await service.getPersona();
      expect(persona).toContain('版本1'); // Still cached
    });

    it('should clear cache', async () => {
      await writeFile(soulPath, `# 版本1`);

      await service.getPersona(); // Load and cache
      service.clearCache();

      // Modify file
      await writeFile(soulPath, `# 版本2`);

      const persona = await service.getPersona();
      expect(persona).toContain('版本2'); // Cache cleared, reloads
    });
  });
});

describe('HistoryExtractor', () => {
  let storage: StorageService;
  let extractor: HistoryExtractor;

  beforeEach(() => {
    storage = new StorageService(':memory:');
    extractor = new HistoryExtractor(storage);
  });

  afterEach(() => {
    storage.close();
  });

  describe('extract', () => {
    it('should extract top topics from facts', async () => {
      const clientId = await storage.createClient({ name: '测试' });
      const sessionId = await storage.createSession({ clientId, platform: 'cli' });

      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '事业方面的事情',
        category: 'career',
        confirmed: true,
      });
      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '感情方面的事情',
        category: 'relationship',
        confirmed: true,
      });
      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '又一件事业的事',
        category: 'career',
        confirmed: true,
      });

      const features = await extractor.extract(clientId);

      expect(features.topTopics).toContain('career');
      expect(features.topTopics[0]).toBe('career'); // Most frequent
    });

    it('should calculate confirmedFactRate', async () => {
      const clientId = await storage.createClient({ name: '测试' });
      const sessionId = await storage.createSession({ clientId, platform: 'cli' });

      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '事实1',
        confirmed: true,
      });
      await storage.addConfirmedFact({
        clientId,
        sessionId,
        fact: '事实2',
        confirmed: false,
      });

      const features = await extractor.extract(clientId);

      expect(features.confirmedFactRate).toBe(0.5);
    });

    it('should return empty features for new client', async () => {
      const clientId = await storage.createClient({ name: '新客户' });

      const features = await extractor.extract(clientId);

      expect(features.topTopics).toEqual([]);
      expect(features.confirmedFactRate).toBe(0);
      expect(features.totalSessions).toBe(0);
    });
  });

  describe('generateTuning', () => {
    it('should generate tuning with client name', () => {
      const client = { name: '张先生', sessionCount: 1 } as Client;
      const history = { topTopics: [], confirmedFactRate: 0, totalSessions: 1 };

      const tuning = extractor.generateTuning(client, history);

      expect(tuning).toContain('张先生');
    });

    it('should indicate returning client', () => {
      const client = { name: '老客户', sessionCount: 3 } as Client;
      const history = { topTopics: [], confirmedFactRate: 0, totalSessions: 3 };

      const tuning = extractor.generateTuning(client, history);

      expect(tuning).toContain('第 3 次');
      expect(tuning).toContain('老客户');
    });

    it('should include top topics', () => {
      const client = { sessionCount: 1 } as Client;
      const history = { topTopics: ['事业', '财运'], confirmedFactRate: 0, totalSessions: 1 };

      const tuning = extractor.generateTuning(client, history);

      expect(tuning).toContain('事业');
      expect(tuning).toContain('财运');
    });

    it('should warn about low hit rate', () => {
      const client = { sessionCount: 1 } as Client;
      const history = { topTopics: [], confirmedFactRate: 0.3, totalSessions: 1 };

      const tuning = extractor.generateTuning(client, history);

      expect(tuning).toContain('命中率较低');
    });

    it('should return empty string for new client with no info', () => {
      const client = { sessionCount: 1 } as Client;
      const history = { topTopics: [], confirmedFactRate: 0, totalSessions: 1 };

      const tuning = extractor.generateTuning(client, history);

      expect(tuning).toBe('');
    });
  });
});
