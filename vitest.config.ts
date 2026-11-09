import { defineConfig } from 'vitest/config';

/*
 * The suite covers the decision-making layer, which is plain TypeScript with no native
 * modules behind it: reading a return link, choosing a presentation, classifying a
 * navigation and building the web view settings. Those are the parts that decide whether a
 * payment is reported correctly, and they run in Node with nothing mocked.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/core/**/*.ts',
        'src/webview/**/*.ts',
        'src/sessions/**/*.ts',
        'src/checkout.ts',
        'src/nativeIntent.ts',
        'src/errors.ts',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 100,
        branches: 95,
        functions: 100,
        lines: 100,
      },
    },
  },
});
