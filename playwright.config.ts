import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'testes/e2e',
  use: { baseURL: 'http://localhost:4329/portfolio/' },
  webServer: [
    { command: 'node scripts/servir.mjs 4329', url: 'http://localhost:4329/portfolio/', reuseExistingServer: !process.env.CI },
    // Segunda build, com DSN falsa do Sentry (ver build-sentry-teste.mjs), só
    // para o e2e de testes/e2e/observabilidade.spec.ts exercitar o caminho
    // "Sentry ligado" sem tocar numa DSN de verdade.
    { command: 'node scripts/servir.mjs 4333 dist-sentry-teste', url: 'http://localhost:4333/portfolio/', reuseExistingServer: !process.env.CI },
  ],
})
