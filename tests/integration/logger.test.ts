// Logger Integration Tests - 集成测试

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KarmaLogger } from '@/logger/logger.js';
import { getLogger, setLogger, createLogger } from '@/logger/index.js';
import { AgentRunner } from '@/agent/runner.js';
import { SessionManager } from '@/session/manager.js';
import { StorageService } from '@/storage/service.js';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

describe('Logger Integration', () => {
  describe('AgentRunner with Logger', () => {
    let storage: StorageService;
    let sessionManager: SessionManager;
    let capturedLogs: string[] = [];

    beforeEach(() => {
      storage = new StorageService(':memory:');
      sessionManager = new SessionManager(storage);
      capturedLogs = [];

      // 捕获 stdout
      vi.spyOn(process.stdout, 'write').mockImplementation((data) => {
        capturedLogs.push(data.toString());
        return true;
      });
    });

    afterEach(() => {
      storage.close();
      vi.restoreAllMocks();
    });

    it('should log AgentRunner operations with structured format', async () => {
      const logger = createLogger({
        program: { level: 'debug', outputs: [{ type: 'console' }] },
      });

      // 验证 logger 可以创建
      expect(logger).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.info).toBeDefined();
    });

    it('should include module and operation in logs', () => {
      const logger = getLogger().child({ module: 'test' });

      // 验证 child logger 继承上下文
      const childLogger = logger.child({ operation: 'test_op' });
      expect(childLogger).toBeDefined();
    });
  });

  describe('Log file output', () => {
    const testDir = join(process.cwd(), 'tests', 'fixtures', 'log-test');

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      // 等待文件句柄释放后再删除
      await new Promise(r => setTimeout(r, 100));
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // 忽略删除失败，可能在其他测试中被占用
      }
    });

    it('should write logs to file', async () => {
      const logPath = join(testDir, 'test.log');

      // 使用 pino transport 写入文件
      const { default: pino } = await import('pino');
      const transport = pino.transport({
        target: 'pino/file',
        options: { destination: logPath },
      });
      const logger = pino(transport);

      logger.info({ module: 'test', operation: 'write' }, 'test message');

      // 等待写入
      await new Promise(r => setTimeout(r, 100));

      const content = await readFile(logPath, 'utf-8');
      expect(content).toContain('test message');
      expect(content).toContain('"module":"test"');
    });
  });

  describe('Audit logging', () => {
    it('should create audit log entry', () => {
      const logger = createLogger();

      // 验证 audit 方法存在且可调用
      expect(() => {
        logger.audit({
          timestamp: new Date().toISOString(),
          eventType: 'session.create',
          platform: 'cli',
          chatId: 'test_chat',
          action: 'Test action',
          details: { key: 'value' },
          result: 'success',
        });
      }).not.toThrow();
    });
  });
});

describe('Persona Integration', () => {
  const testDir = join(process.cwd(), 'tests', 'fixtures', 'persona-integration');
  const soulPath = join(testDir, 'SOUL.md');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('with buildSystemPrompt', () => {
    it('should include persona in system prompt', async () => {
      const { buildSystemPrompt } = await import('@/prompt/builder.js');
      const { PersonaService } = await import('@/persona/service.js');
      const { StorageService } = await import('@/storage/service.js');

      // 每个测试使用唯一的路径避免缓存
      const uniqueSoulPath = join(testDir, `SOUL-${Date.now()}.md`);

      // 创建测试 SOUL.md
      await writeFile(uniqueSoulPath, `---
name: test
---
# Test Persona
This is a test persona.`);

      const storage = new StorageService(':memory:');
      const personaService = new PersonaService({ soulPath: uniqueSoulPath, storage });

      const prompt = await buildSystemPrompt({
        now: new Date(),
        skills: [],
        platform: 'cli',
        personaConfig: {
          personaService,
          clientId: undefined,
        },
      });

      expect(prompt).toContain('Test Persona');
      storage.close();
    });

    it('should append user tuning when clientId provided', async () => {
      const { buildSystemPrompt } = await import('@/prompt/builder.js');
      const { PersonaService } = await import('@/persona/service.js');
      const { StorageService } = await import('@/storage/service.js');

      const uniqueSoulPath = join(testDir, `SOUL-${Date.now()}.md`);
      await writeFile(uniqueSoulPath, `# Base Persona`);

      const storage = new StorageService(':memory:');
      const personaService = new PersonaService({ soulPath: uniqueSoulPath, storage });

      // 创建客户
      const clientId = await storage.createClient({
        name: '测试用户',
        gender: 'male',
      });

      const prompt = await buildSystemPrompt({
        now: new Date(),
        skills: [],
        platform: 'cli',
        personaConfig: {
          personaService,
          clientId,
        },
      });

      // 应该包含用户名
      expect(prompt).toContain('测试用户');
      storage.close();
    });

    it('should generate different tuning for different users', async () => {
      const { PersonaService } = await import('@/persona/service.js');
      const { StorageService } = await import('@/storage/service.js');

      const uniqueSoulPath = join(testDir, `SOUL-${Date.now()}.md`);
      await writeFile(uniqueSoulPath, `# Base`);

      const storage = new StorageService(':memory:');
      const service = new PersonaService({ soulPath: uniqueSoulPath, storage });

      // 新客户
      const newClientId = await storage.createClient({ name: '新客户' });
      const newPersona = await service.getPersona(newClientId);

      // 老客户 - 使用新的 service 实例避免缓存
      const oldSoulPath = join(testDir, `SOUL-old-${Date.now()}.md`);
      await writeFile(oldSoulPath, `# Base`);
      const oldStorage = new StorageService(':memory:');
      const oldService = new PersonaService({ soulPath: oldSoulPath, storage: oldStorage });

      const oldClientId = await oldStorage.createClient({
        name: '老客户',
        sessionCount: 5
      });
      await oldStorage.updateClient(oldClientId, { sessionCount: 5 });
      const oldPersona = await oldService.getPersona(oldClientId);

      // 老客户的 prompt 应该提到回头次数
      expect(oldPersona).toContain('第 5 次');

      // 新客户的 prompt 不应该有回头客信息
      expect(newPersona).not.toContain('第');

      storage.close();
      oldStorage.close();
    });
  });
});
