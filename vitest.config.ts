import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // Context providers must resolve to one module instance even when an
    // alternate package-manager tree is present in a developer workspace.
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  test: {
    environment: 'jsdom',
    // jsdom interaction tests slow down under full-suite worker contention;
    // 15s tripped on files that pass in ~2s in isolation.
    testTimeout: 30000,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
