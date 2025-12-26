import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['js/**/*.js'],
      exclude: [
        'js/main.js',
        'js/input.js',
        'js/renderer.js',
        'js/sounds.js',
        'js/haptics.js',
        'js/effects/**',
        'js/config/**',
        '**/node_modules/**',
        '**/tests/**'
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
});
