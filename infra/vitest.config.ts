import { defineConfig } from 'vitest/config'

/*
 * Pin the CDK app's test config: without this file vitest walks up and loads the
 * Next.js app's vitest.config.ts (React plugin, jsdom), which cannot be loaded
 * from this Node-only package.
 */
export default defineConfig({
  // Object form = inline plugins, so Vite never searches for a PostCSS config.
  // Without this Vite walks up to the repo-root postcss.config.mjs and tries to
  // load `tailwindcss`, which is not installed in this package (CI installs only
  // infra/ deps) -> "Failed to load PostCSS config: Cannot find module 'tailwindcss'".
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
