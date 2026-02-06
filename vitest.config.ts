import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      // NOTE: Vitest 4 + Node 24 on Windows has a known issue where
      // V8 coverage reports 0%. Track: https://github.com/vitest-dev/vitest/issues/9457
      // Istanbul provider also crashes with 'include' patterns on Windows.
      // Coverage thresholds temporarily disabled until this is resolved.
    },
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build', '.claude', 'docs', 'skills', 'functions'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@components': path.resolve(__dirname, './components'),
      '@hooks': path.resolve(__dirname, './hooks'),
      '@utils': path.resolve(__dirname, './utils'),
      '@types': path.resolve(__dirname, './types'),
    },
  },
});
