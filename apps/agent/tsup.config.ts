import { defineConfig } from 'tsup'

export default defineConfig(() => ({
  clean: true,
  splitting: false,
  target: 'es2022',
  format: ['esm'],
  outDir: 'dist',
  // Need to pre-bundled this library before running Mastra build
  noExternal: ['@prisma/client/runtime/library'],
  entry: ['src/mastra/index.ts'],
}))
