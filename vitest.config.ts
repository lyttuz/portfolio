import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['testes/unidade/**/*.test.{ts,mjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'saida/cobertura',
      // Os pisos valem só para a trava e para o conteúdo: o resto (scripts de
      // build, componentes .astro, scripts de interação no navegador) não
      // roda dentro do vitest, então não teria como cobrir aqui.
      thresholds: {
        'scripts/trava/**': { lines: 90, branches: 85 },
        'src/conteudo/**': { lines: 90, branches: 85 },
      },
    },
  },
})
