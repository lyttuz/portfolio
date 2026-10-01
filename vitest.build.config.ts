import { defineConfig } from 'vitest/config'

// Testes sobre o site já montado (dist/ e dist-sentry-teste/). Ficam fora do
// vitest.config.ts porque os testes de unidade rodam antes do build.
export default defineConfig({
  test: {
    include: ['testes/build/**/*.test.ts'],
  },
})
