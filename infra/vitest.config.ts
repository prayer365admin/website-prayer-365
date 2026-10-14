import { defineConfig } from 'vitest/config'

/*
 * Pin the CDK app's test config: without this file vitest walks up and loads the
 * Next.js app's vitest.config.ts (React plugin, jsdom), which cannot be loaded
 * from this Node-only package.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
