import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Where the Vite dev server forwards /api. Not VITE_-prefixed on purpose: only variables with that
// prefix can reach the browser bundle, and this one is a development-tooling detail.
const DEV_PROXY_TARGET = process.env.DEV_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  server: {
    proxy: { '/api': { target: DEV_PROXY_TARGET, changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'test/unit/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      // Unimported files count too, so untested logic cannot hide from the thresholds.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/vite-env.d.ts',
        // Vendored shadcn/ui primitives: generated code, exercised through the app's own components.
        'src/components/ui/**',
      ],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 80, branches: 70 },
    },
  },
});
