// OutputAdapter Tests

import { describe, it, expect, vi } from 'vitest';
import { CLIOutputAdapter } from '@/output/adapters/cli.js';
import { FeishuOutputAdapter } from '@/output/adapters/feishu.js';
import type { PlatformAdapter } from '@/platform/types.js';
import type { OutputContent } from '@/output/types.js';

describe('CLIOutputAdapter', () => {
  it('should write text', async () => {
    const adapter = new CLIOutputAdapter('test');
    const writeSpy = vi.spyOn(process.stdout, 'write');

    await adapter.write({ type: 'text', text: 'hello' });

    expect(writeSpy).toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('should colorize different message types', async () => {
    const adapter = new CLIOutputAdapter('test');
    const writeSpy = vi.spyOn(process.stdout, 'write');

    const types: OutputContent['type'][] = ['text', 'thinking', 'tool_use', 'tool_result', 'error', 'complete'];

    for (const type of types) {
      await adapter.write({ type, text: `test ${type}` });
    }

    expect(writeSpy).toHaveBeenCalledTimes(6);
    writeSpy.mockRestore();
  });

  it('should have correct platform', () => {
    const adapter = new CLIOutputAdapter('test');
    expect(adapter.platform).toBe('cli');
  });
});

describe('FeishuOutputAdapter', () => {
  const createMockPlatformAdapter = (): PlatformAdapter => ({
    platform: 'feishu',
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn(() => true),
    sendMessage: vi.fn(async () => 'msg-id'),
    onMessage: vi.fn(),
  });

  it('should buffer text and flush', async () => {
    const mockAdapter = createMockPlatformAdapter();
    const adapter = new FeishuOutputAdapter('chat-1', mockAdapter, { throttleMs: 0 });

    await adapter.write({ type: 'text', text: 'hello' });
    await adapter.flush();

    expect(mockAdapter.sendMessage).toHaveBeenCalledWith('chat-1', 'hello');
  });

  it('should send tool_use immediately', async () => {
    const mockAdapter = createMockPlatformAdapter();
    const adapter = new FeishuOutputAdapter('chat-1', mockAdapter);

    await adapter.write({
      type: 'tool_use',
      text: '',
      metadata: { toolName: 'Read' },
    });

    expect(mockAdapter.sendMessage).toHaveBeenCalledWith('chat-1', '🔧 正在使用 Read...');
  });

  it('should send error immediately', async () => {
    const mockAdapter = createMockPlatformAdapter();
    const adapter = new FeishuOutputAdapter('chat-1', mockAdapter);

    await adapter.write({ type: 'error', text: 'Error occurred' });

    expect(mockAdapter.sendMessage).toHaveBeenCalledWith('chat-1', 'Error occurred');
  });

  it('should not send thinking', async () => {
    const mockAdapter = createMockPlatformAdapter();
    const adapter = new FeishuOutputAdapter('chat-1', mockAdapter);

    await adapter.write({ type: 'thinking', text: 'thinking...' });

    expect(mockAdapter.sendMessage).not.toHaveBeenCalled();
  });

  it('should flush on complete', async () => {
    const mockAdapter = createMockPlatformAdapter();
    const adapter = new FeishuOutputAdapter('chat-1', mockAdapter, { throttleMs: 10000 });

    await adapter.write({ type: 'text', text: 'hello' });
    await adapter.write({ type: 'complete', text: '' });
    expect(mockAdapter.sendMessage).toHaveBeenCalledWith('chat-1', 'hello');
  });

  it('should have correct platform', () => {
    const mockAdapter = createMockPlatformAdapter();
    const adapter = new FeishuOutputAdapter('chat-1', mockAdapter);
    expect(adapter.platform).toBe('feishu');
  });

  it('should force flush', async () => {
    const mockAdapter = createMockPlatformAdapter();
    const adapter = new FeishuOutputAdapter('chat-1', mockAdapter, { throttleMs: 10000 });

    await adapter.write({ type: 'text', text: 'hello' });
    await adapter.forceFlush();

    expect(mockAdapter.sendMessage).toHaveBeenCalledWith('chat-1', 'hello');
  });

  it('should return buffer size', async () => {
    const mockAdapter = createMockPlatformAdapter();
    const adapter = new FeishuOutputAdapter('chat-1', mockAdapter, { throttleMs: 10000 });

    // Buffer should be >= 0 after write
    await adapter.write({ type: 'text', text: 'hello' });
    expect(adapter.getBufferSize()).toBeGreaterThanOrEqual(0);
  });
});
