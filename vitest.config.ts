import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

// 手动加载 .env.test 文件
const envTestPath = resolve(__dirname, '.env.test');
if (existsSync(envTestPath)) {
  const envContent = readFileSync(envTestPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      // 只设置未定义的环境变量
      if (process.env[key.trim()] === undefined) {
        process.env[key.trim()] = value;
      }
    }
  });
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
    // 集成测试需要更长的超时时间
    testTimeout: 120000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
