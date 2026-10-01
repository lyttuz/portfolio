import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'

// Avisa na hora do build quando não há DSN do Sentry: a página não carrega o
// SDK nesse caso (ver src/scripts/observabilidade.ts), e sem esta linha a
// ausência passaria em silêncio.
function avisoSentry() {
  return {
    name: 'aviso-sentry',
    hooks: {
      'astro:config:setup'({ command }) {
        if (command !== 'build') return
        const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), 'PUBLIC_')
        const dsn = process.env.PUBLIC_SENTRY_DSN || env.PUBLIC_SENTRY_DSN
        if (!dsn) console.log('Sentry desligado: PUBLIC_SENTRY_DSN ausente')
      },
    },
  }
}

export default defineConfig({
  site: 'https://lyttuz.github.io',
  base: '/portfolio',
  // Nada inline no HTML: a CSP tem style-src e script-src só 'self', sem
  // 'unsafe-inline'. O Astro embute folha de estilo pequena num <style> por
  // padrão ('auto'), e o Vite embute arquivo pequeno como data: URI (uma fonte
  // assim cairia no font-src 'self'). Os dois ficam desligados, e o teste
  // testes/build/build.test.ts confere o HTML gerado.
  build: { inlineStylesheets: 'never' },
  vite: { plugins: [tailwindcss()], build: { assetsInlineLimit: 0 } },
  integrations: [avisoSentry()],
})
