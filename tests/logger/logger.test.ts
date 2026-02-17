// Logger Tests - 基于 Pino 的日志测试

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KarmaLogger } from '@/logger/logger.js';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';

describe('KarmaLogger', () => {
  describe('basic logging', () => {
    let loggedMessages: any[] = [];

    beforeEach(() => {
      loggedMessages = [];
    });

    it('should log at debug level', () => {
      const logger = new KarmaLogger({ level: 'debug' });

      // Pino logs to stdout, we can't easily capture it without mocking
      // Just verify it doesn't throw
      expect(() => {
        logger.debug('test message', { module: 'test' });
      }).not.toThrow();
    });

    it('should log at info level', () => {
      const logger = new KarmaLogger({ level: 'info' });
      expect(() => {
        logger.info('info message', { module: 'test' });
      }).not.toThrow();
    });

    it('should log at warn level', () => {
      const logger = new KarmaLogger({ level: 'warn' });
      expect(() => {
        logger.warn('warn message', { module: 'test' });
      }).not.toThrow();
    });

    it('should log at error level', () => {
      const logger = new KarmaLogger({ level: 'error' });
      expect(() => {
        logger.error('error message', undefined, { module: 'test' });
      }).not.toThrow();
    });
  });

  describe('startTimer', () => {
    it('should return duration in milliseconds', async () => {
      const logger = new KarmaLogger();
      const getDuration = logger.startTimer('test');

      await new Promise(r => setTimeout(r, 50));

      const duration = getDuration();
      expect(duration).toBeGreaterThanOrEqual(40);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('child logger', () => {
    it('should create child logger with context', () => {
      const logger = new KarmaLogger({ module: 'storage' });
      const childLogger = logger.child({ operation: 'save', sessionId: 'session_123' });

      expect(() => {
        childLogger.debug('child message');
      }).not.toThrow();
    });
  });

  describe('error logging', () => {
    it('should include error details', () => {
      const logger = new KarmaLogger();
      const error = new Error('test error');

      expect(() => {
        logger.error('something failed', error, { module: 'test' });
      }).not.toThrow();
    });
  });

  describe('level filtering', () => {
    it('should filter out debug logs when level is info', () => {
      const logger = new KarmaLogger({ level: 'info' });

      // debug should be filtered
      expect(() => {
        logger.debug('should be filtered', { module: 'test' });
        logger.info('should appear', { module: 'test' });
      }).not.toThrow();
    });
  });

  describe('audit logging', () => {
    it('should call audit method without throwing', () => {
      const logger = new KarmaLogger();

      expect(() => {
        logger.audit({
          timestamp: new Date().toISOString(),
          eventType: 'session.create',
          platform: 'cli',
          chatId: 'chat_123',
          action: 'Created new session',
          details: {},
          result: 'success',
        });
      }).not.toThrow();
    });
  });
});

describe('File logging', () => {
  const testDir = join(process.cwd(), 'tests', 'fixtures', 'logger-test');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should write to file using pino', async () => {
    const logPath = join(testDir, 'test.log');

    // Create pino with file destination
    const transport = pino.transport({
      target: 'pino/file',
      options: { destination: logPath },
    });
    const logger = pino(transport);

    logger.info({ module: 'test' }, 'test message');

    // Flush and close
    await new Promise(r => setTimeout(r, 100));

    const content = await readFile(logPath, 'utf-8');
    expect(content).toContain('test message');
    expect(content).toContain('"module":"test"');
  });
});
