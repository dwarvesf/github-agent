import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {},
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['apps/**/*.test.?(m)ts?(x)', 'packages/**/*.test.?(m)ts?(x)'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.config.ts',
      '**/*.setup.ts',
      '**/*.d.ts',
    ],
  },
})
