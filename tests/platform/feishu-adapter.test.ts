// FeishuAdapter Tests

import { describe, it, expect, vi } from 'vitest';
import { FeishuAdapter } from '@/platform/adapters/feishu/index.js';

describe('FeishuAdapter', () => {
  const createAdapter = () => {
    return new FeishuAdapter({
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      enabled: false, // Disabled for tests
    });
  };

  describe('constructor', () => {
    it('should create adapter with config', () => {
      const adapter = createAdapter();
      expect(adapter.platform).toBe('feishu');
    });
  });

  describe('isRunning', () => {
    it('should return false before start', () => {
      const adapter = createAdapter();
      expect(adapter.isRunning()).toBe(false);
    });
  });

  describe('start/stop', () => {
    it('should not start when disabled', async () => {
      const adapter = createAdapter();
      await adapter.start();
      expect(adapter.isRunning()).toBe(false);
    });
  });

  describe('onMessage', () => {
    it('should register message handler', () => {
      const adapter = createAdapter();
      const handler = vi.fn();
      adapter.onMessage(handler);
      // Handler is registered (no public getter to verify)
    });
  });
});
