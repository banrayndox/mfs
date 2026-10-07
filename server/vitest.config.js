import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    maxConcurrency: 1,
    include: ['server/tests/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/._*', '**/.*/**'],
  },
});
