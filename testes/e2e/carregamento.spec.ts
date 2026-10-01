import { test, expect } from '@playwright/test'

// O script inicial (o que o documento referencia direto) precisa ficar pequeno:
// GSAP, o movimento e as interações vêm depois, por import() dinâmico disparado
// no DOMContentLoaded. Sem isto, um bundle de ~120 KB (GSAP incluso) nasceria
// bloqueando a primeira pintura, mesmo a página não precisando dele de cara.
test('o script inicial do documento é pequeno; o resto vem por import() dinâmico', async ({ page }) => {
  const tamanhos = new Map<string, number>()
  page.on('response', async (res) => {
    if (res.request().resourceType() !== 'script') return
    const corpo = await res.body().catch(() => null)
    if (corpo) tamanhos.set(res.url(), corpo.length)
  })
  await page.goto('./')
  await page.waitForLoadState('networkidle')

  const iniciais = await page.evaluate(() => [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map((s) => s.src))
  expect(iniciais.length).toBeGreaterThan(0)
  for (const src of iniciais) {
    const tamanho = tamanhos.get(src)
    expect(tamanho).toBeDefined()
    expect(tamanho as number).toBeLessThan(3_000)
  }
})

test('depois do DOMContentLoaded, o chunk com o movimento (GSAP) é pedido à parte', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (req) => {
    if (req.resourceType() === 'script') scripts.push(req.url())
  })
  await page.goto('./')
  await page.waitForLoadState('networkidle')
  // Mais de um arquivo de script: o inicial, pequeno, e ao menos mais um vindo do import() dinâmico.
  expect(new Set(scripts).size).toBeGreaterThan(1)
})

// Com movimento reduzido, o GSAP nem é baixado: não há animação para ele
// fazer. As interações (abas e pastas) continuam chegando e funcionando.
test('com movimento reduzido, o chunk do GSAP não é pedido, e as abas continuam ligadas', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const scripts: string[] = []
  const comGsap: string[] = []
  page.on('response', async (res) => {
    if (res.request().resourceType() !== 'script') return
    scripts.push(res.url())
    const corpo = await res.text().catch(() => '')
    if (/GreenSock|gsap/.test(corpo)) comGsap.push(res.url())
  })
  await page.goto('http://localhost:4329/portfolio/')
  await page.waitForLoadState('networkidle')
  expect(scripts.some((u) => u.includes('/interacoes.'))).toBe(true)
  expect(scripts.filter((u) => u.includes('/movimento.'))).toEqual([])
  expect(comGsap).toEqual([])
  const art = page.locator('article[data-projeto="escritorio"]')
  await expect(art.getByRole('tablist')).toBeVisible()
  await art.getByRole('tab', { name: 'Estrutura' }).click()
  await expect(art.locator('[data-painel="estrutura"]')).toBeVisible()
  await expect(art.locator('[data-painel="arquitetura"]')).toBeHidden()
  await ctx.close()
})
