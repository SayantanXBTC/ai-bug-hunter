import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'apps/api/**/*.test.ts',
      'packages/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    setupFiles: ['./tests/setup/vitestSetup.ts'],
    testTimeout: 90_000,
    hookTimeout: 90_000,
  },
});
