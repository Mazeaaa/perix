import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // 某些沙箱环境里并行 worker 会被网络策略打断，导致测试文件被随机跳过。
    // 这个项目的测试总量很小，串行反而更稳定。
    fileParallelism: false,
  },
});
