import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// O Vite escreve no bundle o valor de toda import.meta.env.PUBLIC_* que o
// código cita. Então a regra "o único valor de ambiente que chega ao navegador
// é a DSN do Sentry" se confere no código-fonte: fora as constantes do próprio
// Astro, a única variável citada é PUBLIC_SENTRY_DSN. Uma PUBLIC_ nova
// precisa passar por aqui, de propósito.
const PERMITIDAS = new Set(['PUBLIC_SENTRY_DSN', 'BASE_URL', 'SITE', 'DEV', 'PROD', 'MODE', 'SSR'])

function fontes(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(astro|ts|mjs|js)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name))
}

describe('variáveis de ambiente no código do site', () => {
  it('só PUBLIC_SENTRY_DSN e as constantes do Astro, e nenhum acesso ao objeto inteiro', () => {
    const citadas = new Set<string>()
    for (const f of fontes('src')) {
      const texto = readFileSync(f, 'utf8')
      for (const m of texto.matchAll(/import\.meta\.env\.([A-Z_]+)/g)) citadas.add(m[1])
      // import.meta.env sozinho (ou com colchete) entregaria tudo o que é PUBLIC_.
      expect(texto, f).not.toMatch(/import\.meta\.env(?![.\w])/)
      expect(texto, f).not.toMatch(/process\.env/)
    }
    expect(citadas.has('PUBLIC_SENTRY_DSN')).toBe(true)
    expect([...citadas].filter((n) => !PERMITIDAS.has(n))).toEqual([])
  })
})
