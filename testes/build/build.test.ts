import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DSN_FALSA } from '../../scripts/dsn-falsa.mjs'
import { montarCsp } from '../../src/seguranca/csp'

// Lê o site já montado, como texto, e confere o que chega ao navegador. Roda
// depois do build e do build:sentry-teste (npm run teste:build), e não junto
// dos testes de unidade, porque estes rodam antes de existir build. Diretório
// ausente reprova, em vez de pular: um teste que passa sem ter o que ler é a
// falha silenciosa que este arquivo existe para evitar.

// O dist/ normal sai sem DSN. No publicar, o build final sai com a DSN real,
// e este teste roda de novo sobre ele com a mesma PUBLIC_SENTRY_DSN no
// ambiente do passo: é dela que vem a DSN esperada. Vazia conta como ausente,
// igual ao build.
const DSN_DO_DIST = process.env.PUBLIC_SENTRY_DSN || undefined

const BUILDS = [
  { dir: 'dist', dsn: DSN_DO_DIST, comando: 'npm run build' },
  { dir: 'dist-sentry-teste', dsn: DSN_FALSA, comando: 'npm run build:sentry-teste' },
] as const

function arquivos(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(html|js|css)$/.test(e.name))
    .map((e) => join(e.parentPath, e.name))
}

// Padrões de token conhecidos. O comprimento mínimo depois do prefixo evita
// falso positivo em código minificado (por exemplo, "task-" contém "sk-").
const TOKENS: [string, RegExp][] = [
  ['GitHub ghp_', /ghp_[A-Za-z0-9]{30,}/],
  ['GitHub gho_', /gho_[A-Za-z0-9]{30,}/],
  ['GitHub github_pat_', /github_pat_[A-Za-z0-9_]{30,}/],
  ['chave sk-', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['Slack xox', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['AWS AKIA', /\bAKIA[0-9A-Z]{16}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/],
]

// Exemplos montados por concatenação, para este arquivo não carregar um token
// literal (o secretlint do repositório o acusaria, e com razão).
const EXEMPLOS: Record<string, string> = {
  'GitHub ghp_': `${'gh'}p_${'a1B2'.repeat(9)}`,
  'GitHub gho_': `${'gh'}o_${'a1B2'.repeat(9)}`,
  'GitHub github_pat_': `${'github'}_pat_${'a1B2_'.repeat(8)}`,
  'chave sk-': ` ${'s'}k-${'a1B2'.repeat(8)}`,
  'Slack xox': ` ${'xo'}xb-1234567890-abcdefghij`,
  'AWS AKIA': ` ${'AK'}IA${'ABCD2345'.repeat(2)} `,
  JWT: ` ${'ey'}JhbGciOiJIUzI1NiJ9.${'eyJzdWIiOiIxIn0'}.${'c2lnbmF0dXJh'}`,
}

describe('padrões de token (controle)', () => {
  it('cada padrão pega o seu exemplo, e não pega código comum', () => {
    for (const [nome, re] of TOKENS) expect(re.test(EXEMPLOS[nome]), nome).toBe(true)
    const comum = 'const task-runner = "disk-space"; function asks-for(){}; eyJ.x.y; AKIAx'
    for (const [nome, re] of TOKENS) expect(re.test(comum), nome).toBe(false)
  })
})

for (const build of BUILDS) {
  describe(`${build.dir}/`, () => {
    it('existe e tem HTML, JS e CSS para ler', () => {
      expect(existsSync(build.dir), `${build.dir}/ ausente: rode ${build.comando}`).toBe(true)
      const lista = arquivos(build.dir)
      for (const ext of ['.html', '.js', '.css'])
        expect(
          lista.some((f) => f.endsWith(ext)),
          ext,
        ).toBe(true)
    })

    const ler = () => arquivos(build.dir).map((f) => ({ f, texto: readFileSync(f, 'utf8') }))

    it('nenhum padrão de token conhecido', () => {
      const achados = ler().flatMap(({ f, texto }) => TOKENS.filter(([, re]) => re.test(texto)).map(([nome]) => `${f}: ${nome}`))
      expect(achados).toEqual([])
    })

    it('a única DSN no build é a do PUBLIC_SENTRY_DSN, e só quando ele existe', () => {
      const dsns = ler().flatMap(({ texto }) => texto.match(/https:\/\/[A-Za-z0-9]+@[A-Za-z0-9.-]+\/\d+/g) ?? [])
      if (build.dsn) {
        expect(dsns.length).toBeGreaterThan(0)
        expect(new Set(dsns)).toEqual(new Set([build.dsn]))
      } else {
        expect(dsns).toEqual([])
        expect(
          ler()
            .filter(({ texto }) => /ingest\.sentry|sentry\.io/.test(texto))
            .map(({ f }) => f),
        ).toEqual([])
      }
    })

    it('HTML: CSP do build, nada inline, nenhum recurso de terceiros, link externo com rel', () => {
      const htmls = ler().filter(({ f }) => f.endsWith('.html'))
      expect(htmls.length).toBeGreaterThan(0)
      for (const { f, texto } of htmls) {
        const metas = texto.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/g) ?? []
        expect(metas, f).toHaveLength(1)
        expect(metas[0]).toContain(`content="${montarCsp(build.dsn)}"`)
        expect(texto).toContain('<meta name="referrer" content="strict-origin-when-cross-origin">')

        // Script só com src; nenhum <style>; nenhum atributo style nem on* (o que 'unsafe-inline' liberaria).
        const tags = texto.match(/<[a-zA-Z][^>]*>/g) ?? []
        expect(
          tags.filter((t) => /^<script\b/i.test(t) && !/\ssrc=/.test(t)),
          f,
        ).toEqual([])
        expect(
          tags.filter((t) => /^<style\b/i.test(t)),
          f,
        ).toEqual([])
        expect(
          tags.filter((t) => /\sstyle=/i.test(t)),
          f,
        ).toEqual([])
        expect(
          tags.filter((t) => /\son[a-z]+=/i.test(t)),
          f,
        ).toEqual([])

        // Recurso carregado (script, folha de estilo, imagem, ícone): relativo, do próprio site ou data:.
        const recursos = tags.filter((t) => /^<(script|img|link|source|iframe|video|audio)\b/i.test(t)).flatMap((t) => [...t.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((m) => m[1]))
        expect(recursos.length).toBeGreaterThan(0)
        expect(
          recursos.filter((u) => !(u.startsWith('/portfolio/') || u.startsWith('data:') || !/^[a-z]+:|^\/\//i.test(u))),
          f,
        ).toEqual([])

        // Todo link para fora abre sem dar ao destino acesso a esta janela nem a origem.
        const externos = tags.filter((t) => /^<a\b/i.test(t) && /\shref="https?:\/\//.test(t))
        expect(externos.length).toBeGreaterThan(0)
        for (const a of externos) expect(a, f).toMatch(/\srel="noopener noreferrer"/)
        for (const a of tags.filter((t) => /^<a\b/i.test(t) && /\starget=/.test(t))) expect(a, f).toMatch(/\srel="noopener noreferrer"/)
      }
    })

    it('CSS: nenhum data: embutido (uma fonte assim cairia no font-src)', () => {
      const achados = ler()
        .filter(({ f }) => f.endsWith('.css'))
        .filter(({ texto }) => /url\(\s*["']?data:/.test(texto))
        .map(({ f }) => f)
      expect(achados).toEqual([])
    })
  })
}
