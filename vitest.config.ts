import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    execArgv: ['--disable-warning=ExperimentalWarning'],
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      DATABASE_PATH: ':memory:',
      PUBLIC_BASE_URL: 'http://localhost:4000',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
