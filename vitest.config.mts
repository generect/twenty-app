import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// tsconfig.json excludes tests from the app build, so the `src/*` alias is declared here too.
export default defineConfig({
  resolve: {
    alias: [{ find: /^src\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }],
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
