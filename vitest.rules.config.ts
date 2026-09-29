import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: [
      'src/features/academic/firestore.rules.emulator.ts',
      'src/features/learning-materials/learning-materials.rules.emulator.ts',
    ],
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
