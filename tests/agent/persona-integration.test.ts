// Persona 集成测试
// 验证 PersonaService 正确注入到 System Prompt

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentRunner, type AgentRunnerConfig } from '@/agent/runner';
import { StorageService } from '@/storage/service';
import { SessionManager } from '@/session/manager';
import { PersonaService } from '@/persona/service';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';

describe('Persona Integration', () => {
  let storage: StorageService;
  let sessionManager: SessionManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `karma-persona-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    storage = new StorageService(join(tempDir, 'test.db'));
    sessionManager = new SessionManager(storage);
    vi.clearAllMocks();
  });

  afterEach(() => {
    storage.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should include persona from PersonaService in system prompt', async () => {
    // Given: 自定义 SOUL.md
    const soulPath = join(tempDir, 'SOUL.md');
    writeFileSync(soulPath, `---
name: Test Fortune Teller
---

# Your Identity

You are a test fortune teller with special powers.
`);

    const personaService = new PersonaService({
      soulPath,
      storage,
    });

    const config: AgentRunnerConfig = {
      storage,
      sessionManager,
      skills: [],
      personaService,
      model: 'claude-sonnet-4-5-20250929',
    };
    const runner = new AgentRunner(config);

    const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

    const mockQuery = vi.mocked(query);
    let capturedPrompt = '';
    mockQuery.mockImplementation(async function* (args: any) {
      capturedPrompt = args.options.systemPrompt;
      yield { type: 'result' };
    });

    for await (const _ of runner.run({ userInput: 'test', session })) {
      // consume
    }

    // Then: system prompt 应包含自定义人设
    expect(capturedPrompt).toContain('You are a test fortune teller');
  });

  it('should include client profile when session has clientId', async () => {
    // Given: 有客户档案的会话
    const clientId = await storage.createClient({
      name: '测试客户',
      gender: 'male',
      birthDate: '1990-05-15T06:00:00',
      birthPlace: '北京',
    });

    const session = await sessionManager.getOrCreateSession({
      platform: 'cli',
      clientId,
    });

    const soulPath = join(tempDir, 'SOUL.md');
    writeFileSync(soulPath, '# Test Persona');

    const personaService = new PersonaService({
      soulPath,
      storage,
    });

    const config: AgentRunnerConfig = {
      storage,
      sessionManager,
      skills: [],
      personaService,
      model: 'claude-sonnet-4-5-20250929',
    };
    const runner = new AgentRunner(config);

    const mockQuery = vi.mocked(query);
    let capturedPrompt = '';
    mockQuery.mockImplementation(async function* (args: any) {
      capturedPrompt = args.options.systemPrompt;
      yield { type: 'result' };
    });

    for await (const _ of runner.run({ userInput: 'test', session })) {
      // consume
    }

    // Then: system prompt 应包含客户档案
    expect(capturedPrompt).toContain('姓名: 测试客户');
    expect(capturedPrompt).toContain('性别: 男');
  });

  it('should fall back to default persona when SOUL.md not found', async () => {
    // Given: 不存在的 SOUL.md
    const personaService = new PersonaService({
      soulPath: join(tempDir, 'nonexistent-SOUL.md'),
      storage,
    });

    const config: AgentRunnerConfig = {
      storage,
      sessionManager,
      skills: [],
      personaService,
      model: 'claude-sonnet-4-5-20250929',
    };
    const runner = new AgentRunner(config);

    const session = await sessionManager.getOrCreateSession({ platform: 'cli' });

    const mockQuery = vi.mocked(query);
    let capturedPrompt = '';
    mockQuery.mockImplementation(async function* (args: any) {
      capturedPrompt = args.options.systemPrompt;
      yield { type: 'result' };
    });

    for await (const _ of runner.run({ userInput: 'test', session })) {
      // consume
    }

    // Then: system prompt 应包含默认人设
    expect(capturedPrompt).toContain('三十年经验的命理师');
  });
});
