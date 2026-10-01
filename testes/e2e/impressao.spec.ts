import { test, expect, type Page } from '@playwright/test'
import { existsSync, readFileSync, statSync } from 'node:fs'

// Depois do beforeprint: nenhum painel escondido, nenhuma pasta fechada, nenhuma lista oculta.
async function conferirAberto(page: Page) {
  // Por data-painel, e não por role: sem o script carregado, o painel ainda não tem papel de tabpanel.
  expect(await page.locator('[data-abas] [data-painel]').count()).toBe(6)
  expect(await page.locator('[data-abas] [data-painel][hidden]').count()).toBe(0)
  expect(await page.locator('button[data-pasta][aria-expanded="false"]').count()).toBe(0)
  expect(await page.locator('[data-editor] ul[hidden]').count()).toBe(0)
  // O beforeprint limpa estilo inline; a seta de linha sem filhos não pode reaparecer.
  const setasSoltas = await page.locator('[data-editor] span[data-linha] .seta').evaluateAll((els) => els.filter((el) => getComputedStyle(el).visibility !== 'hidden').length)
  expect(setasSoltas).toBe(0)
}

test('Ctrl+P no topo da página: tudo visível, painéis e pastas abertos', async ({ page }) => {
  await page.goto('./')
  await page.waitForTimeout(200)
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await page.emulateMedia({ media: 'print' })
  const escondidos = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-anima], [data-anima] *, [data-linha]')].filter((el) => Number(getComputedStyle(el).opacity) < 1).length)
  expect(escondidos).toBe(0)
  await conferirAberto(page)
})

test('Ctrl+P com a página rolada até o meio: tudo visível, painéis e pastas abertos', async ({ page }) => {
  await page.goto('./')
  await page.waitForTimeout(200)
  await page.locator('article[data-projeto="protocolador"]').scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await page.emulateMedia({ media: 'print' })
  const escondidos = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-anima], [data-anima] *, [data-linha]')].filter((el) => Number(getComputedStyle(el).opacity) < 1).length)
  expect(escondidos).toBe(0)
  await conferirAberto(page)
})

test('com movimento reduzido, nada fica com estilo de animação', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4329/portfolio/')
  const comEstilo = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-anima]')].filter((el) => el.style.opacity !== '' || el.style.transform !== '').length)
  expect(comEstilo).toBe(0)
  await ctx.close()
})

test('movimento reduzido com Ctrl+P: tudo visível e aberto', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4329/portfolio/')
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' })
  const escondidos = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-anima], [data-anima] *, [data-linha]')].filter((el) => Number(getComputedStyle(el).opacity) < 1).length)
  expect(escondidos).toBe(0)
  await conferirAberto(page)
  await ctx.close()
})

test('beforeprint antes do carregamento preguiçoso: o estado de origem já imprime certo', async ({ page }) => {
  // Atrasa todo .js: o movimento e as interações vêm por import() dinâmico
  // disparado no DOMContentLoaded, então o navegador ainda não os carregou
  // quando o beforeprint dispara logo depois do goto. O HTML nasce com tudo
  // aberto e visível, então a página precisa imprimir certo mesmo assim.
  await page.route('**/*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 3_000))
    await route.continue()
  })
  await page.goto('./')
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await page.emulateMedia({ media: 'print' })
  const escondidos = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-anima], [data-anima] *, [data-linha]')].filter((el) => Number(getComputedStyle(el).opacity) < 1).length)
  expect(escondidos).toBe(0)
  await conferirAberto(page)
})

test('o PDF existe no dist e é servido', async ({ request }) => {
  expect(existsSync('dist/gabriel-alves-portfolio.pdf')).toBe(true)
  expect(statSync('dist/gabriel-alves-portfolio.pdf').size).toBeGreaterThan(20_000)
  const r = await request.get('gabriel-alves-portfolio.pdf')
  expect(r.status()).toBe(200)
  expect(r.headers()['content-type']).toBe('application/pdf')
})

// Conta os objetos de página (/Type /Page, sem o /Pages da árvore) direto nos
// bytes do PDF. Mais de cinco páginas é sinal de algo quebrado no layout de
// impressão, por exemplo um painel duplicado ou uma quebra a mais.
test('o PDF tem no máximo 5 páginas', () => {
  const bytes = readFileSync('dist/gabriel-alves-portfolio.pdf', 'latin1')
  const paginas = (bytes.match(/\/Type\s*\/Page(?!s)/g) ?? []).length
  expect(paginas).toBeGreaterThan(0)
  expect(paginas).toBeLessThanOrEqual(5)
})
