import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // If you want to keep running your existing tests in Node.js, uncomment the next line.
  // 'vite.config.ts',
  {
    extends: 'vite.config.ts',
    // optimizeDeps: { include: ['fake-indexeddb/auto'] },
    test: {
      // setupFiles: ['./src/tests/setup.ts'],
      browser: {
        //headless: true,
        enabled: true,
        provider: 'playwright',
        // https://vitest.dev/guide/browser/playwright
        instances: [
          // { browser: 'chromium' },
          { browser: 'firefox' },
        ]
      },
    },
  },
])
