import { test, expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test'
import { DSN_FALSA } from '../../scripts/dsn-falsa.mjs'
import { montarCsp } from '../../src/seguranca/csp'

// A CSP vai por <meta> (ver src/seguranca/csp.ts). O risco aqui é a falha
// silenciosa: uma violação não quebra a página, só some com um estilo ou um
// script, e ninguém vê. Por isso cada modo escuta duas fontes ao mesmo tempo:
// o evento securitypolicyviolation (só existe com JavaScript) e o console do
// navegador, que registra a recusa mesmo com o JavaScript desligado. E o
// primeiro teste prova que os dois ouvidos funcionam, provocando violações de
// propósito: sem ele, uma escuta quebrada passaria por "zero violações".

const SITE = 'http://localhost:4329/portfolio/'
const SITE_SENTRY = 'http://localhost:4333/portfolio/'
const HOST_SENTRY = /sentry\.io|ingest\.sentry/i
const RECUSA_NO_CONSOLE = /Content Security Policy|Refused to/i

type Escuta = { eventos: () => Promise<string[]>; console: string[] }

async function escutar(page: Page, comJs = true): Promise<Escuta> {
  const console: string[] = []
  page.on('console', (m) => {
    if (RECUSA_NO_CONSOLE.test(m.text())) console.push(m.text())
  })
  if (comJs) {
    await page.addInitScript(() => {
      const w = window as unknown as { __violacoes: string[] }
      w.__violacoes = []
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__violacoes.push(`${e.violatedDirective} ${e.blockedURI}`)
      })
    })
  }
  return {
    console,
    eventos: async () => (comJs ? page.evaluate(() => (window as unknown as { __violacoes: string[] }).__violacoes) : []),
  }
}

async function semViolacao(escuta: Escuta) {
  expect(await escuta.eventos()).toEqual([])
  expect(escuta.console).toEqual([])
}

// Percorre a página inteira, devagar, para tudo o que é preguiçoso montar sob
// a CSP: o fundo (depois do load), a trilha presa (quando a seção entra na
// tela, com o SplitText) e as entradas do ScrollTrigger.
async function percorrer(page: Page) {
  const altura = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y <= altura; y += 500) {
    await page.evaluate((alvo) => window.scrollTo(0, alvo), y)
    await page.waitForTimeout(60)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
}

async function abrir(browser: Browser, opcoes: BrowserContextOptions = {}) {
  const ctx = await browser.newContext(opcoes)
  const page = await ctx.newPage()
  const escuta = await escutar(page, opcoes.javaScriptEnabled !== false)
  return { ctx, page, escuta }
}

test('controle: as duas escutas pegam uma violação provocada de propósito', async ({ page }) => {
  // HTML servido com um <style> inline a mais: a CSP tem que recusá-lo, e as duas escutas têm que ver.
  await page.route(SITE, async (route) => {
    const r = await route.fetch()
    const corpo = (await r.text()).replace('</head>', '<style>body{outline:1px solid red}</style></head>')
    await route.fulfill({ response: r, body: corpo })
  })
  const escuta = await escutar(page)
  await page.goto(SITE)
  await page.waitForLoadState('load')
  // E um atributo style vindo de HTML, que é o que um SplitText mal escrito faria.
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<div style="color:red">x</div>')
  })
  await page.waitForTimeout(200)
  const eventos = await escuta.eventos()
  expect(eventos.filter((e) => e.startsWith('style-src')).length).toBeGreaterThanOrEqual(2)
  expect(escuta.console.length).toBeGreaterThanOrEqual(2)
})

test('controle sem JavaScript: o console sozinho pega a violação', async ({ browser }) => {
  const { ctx, page, escuta } = await abrir(browser, { javaScriptEnabled: false })
  await page.route(SITE, async (route) => {
    const r = await route.fetch()
    await route.fulfill({ response: r, body: (await r.text()).replace('</head>', '<style>body{outline:1px solid red}</style></head>') })
  })
  await page.goto(SITE)
  await page.waitForTimeout(200)
  expect(escuta.console.length).toBeGreaterThanOrEqual(1)
  await ctx.close()
})

test('a CSP do HTML é a do build sem DSN, e vem antes de qualquer script ou folha de estilo', async ({ page }) => {
  await page.goto(SITE)
  const meta = page.locator('meta[http-equiv="Content-Security-Policy"]')
  await expect(meta).toHaveCount(1)
  await expect(meta).toHaveAttribute('content', montarCsp(undefined))
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'strict-origin-when-cross-origin')
  const ordem = await page.evaluate(() => {
    const filhos = [...document.head.children]
    const iCsp = filhos.findIndex((el) => el.getAttribute('http-equiv') === 'Content-Security-Policy')
    const iRecurso = filhos.findIndex((el) => el.matches('script, link[rel="stylesheet"], style'))
    return { iCsp, iRecurso }
  })
  expect(ordem.iCsp).toBeGreaterThan(-1)
  expect(ordem.iCsp).toBeLessThan(ordem.iRecurso)
})

test('com JavaScript: nenhuma violação, e o fundo e o GSAP funcionam sob a CSP', async ({ browser }) => {
  const { ctx, page, escuta } = await abrir(browser)
  await page.goto(SITE)
  await page.waitForLoadState('load')
  // Fundo: o canvas assumiu e já desenhou quadros.
  await expect(page.locator('html[data-fundo-ativo]')).toHaveCount(1, { timeout: 5_000 })
  await expect.poll(() => page.locator('canvas[data-fundo]').evaluate((c) => Number((c as HTMLCanvasElement).dataset.quadros ?? 0))).toBeGreaterThan(0)
  // GSAP: o título foi dividido pelo SplitText e a trilha presa montou.
  await expect.poll(() => page.locator('[data-anima="titulo"] > *').count()).toBeGreaterThan(1)
  await percorrer(page)
  await page.locator('#como-trabalho').scrollIntoViewIfNeeded()
  await expect(page.locator('#como-trabalho[data-trilha]')).toHaveCount(1, { timeout: 5_000 })
  await percorrer(page)
  await semViolacao(escuta)
  await ctx.close()
})

test('sem JavaScript: nenhuma violação', async ({ browser }) => {
  const { ctx, page, escuta } = await abrir(browser, { javaScriptEnabled: false })
  await page.goto(SITE)
  await page.waitForLoadState('load')
  await page.waitForTimeout(300)
  await expect(page.locator('h1')).toBeVisible()
  await semViolacao(escuta)
  await ctx.close()
})

test('com movimento reduzido: nenhuma violação', async ({ browser }) => {
  const { ctx, page, escuta } = await abrir(browser, { reducedMotion: 'reduce' })
  await page.goto(SITE)
  await page.waitForLoadState('networkidle')
  await percorrer(page)
  await semViolacao(escuta)
  await ctx.close()
})

test('na impressão: nenhuma violação', async ({ browser }) => {
  const { ctx, page, escuta } = await abrir(browser)
  await page.goto(SITE)
  await page.waitForLoadState('networkidle')
  await percorrer(page)
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(300)
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await page.emulateMedia({ media: 'screen' })
  await page.waitForTimeout(300)
  await semViolacao(escuta)
  await ctx.close()
})

test('nas condições do PDF (papel e movimento reduzido): nenhuma violação', async ({ browser }) => {
  const { ctx, page, escuta } = await abrir(browser, { reducedMotion: 'reduce' })
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' })
  await page.goto(SITE, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({ format: 'A4', printBackground: true })
  await semViolacao(escuta)
  await ctx.close()
})

test('nenhum recurso de terceiros: todo pedido fica no próprio site', async ({ page }) => {
  const fora: string[] = []
  page.on('request', (req) => {
    const u = new URL(req.url())
    if (u.protocol === 'data:') return
    if (u.origin !== 'http://localhost:4329') fora.push(req.url())
  })
  await page.goto(SITE)
  await page.waitForLoadState('networkidle')
  await percorrer(page)
  expect(fora).toEqual([])
})

test.describe('com PUBLIC_SENTRY_DSN (build de teste, DSN falsa)', () => {
  test('connect-src inclui o host do Sentry, e o envio de um erro não viola a CSP', async ({ browser }) => {
    const { ctx, page, escuta } = await abrir(browser)
    const enviados: string[] = []
    await page.route(HOST_SENTRY, (route) => {
      enviados.push(route.request().url())
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    const sdk = page.waitForRequest((req) => /observabilidade/i.test(req.url()), { timeout: 5_000 })
    await page.goto(SITE_SENTRY)
    await sdk
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
    expect(csp).toBe(montarCsp(DSN_FALSA))
    expect(csp).toContain("connect-src 'self' https://o0.ingest.sentry.io")
    // Erro de verdade, sem tratamento, para o SDK mandar o evento ao host da DSN.
    await page.waitForTimeout(500)
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('erro de teste da CSP')
      })
    })
    await expect.poll(() => enviados.length, { timeout: 5_000 }).toBeGreaterThan(0)
    await percorrer(page)
    await semViolacao(escuta)
    await ctx.close()
  })
})
