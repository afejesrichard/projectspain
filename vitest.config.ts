import { defineConfig } from 'vitest/config'

// jsdom environment so the validator's DOMParser exists in Node tests.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
