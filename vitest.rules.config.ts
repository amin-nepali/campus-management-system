import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/features/academic/firestore.rules.emulator.ts'],
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
