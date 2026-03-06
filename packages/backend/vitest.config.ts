import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      MOCK_AUTH: 'true',
      NODE_ENV: 'test',
    },
  },
});
