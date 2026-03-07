import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/shared/adapters/db/pool.ts',
        'src/account/adapters/UserRepositoryPg.ts',
        'src/shared/adapters/auth/ClerkAuthAdapter.ts',
        'src/account/ports/UserRepository.ts',
        'src/shared/ports/AuthPort.ts',
        '**/*.test.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
      },
    },
  },
});
