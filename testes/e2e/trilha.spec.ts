import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { perfil } from '../../src/conteudo/perfil'

// "Como trabalho" com movimento: a seção fica presa (pin do ScrollTrigger)
// enquanto a rolagem vertical leva a trilha na horizontal. Sem JavaScript, com
// movimento reduzido e no papel, fica a linha do tempo estática.

const URL_ABSOLUTA = 'http://localhost:4329/portfolio/'

// Espera o movimento montar a trilha (o atributo só existe com o pin ligado, e
// só depois que a seção entra na tela).
async function esperarTrilha(page: Page) {
  await expect(page.locator('#como-trabalho[data-trilha]')).toHaveCount(1, { timeout: 5_000 })
}

// Início e tamanho do percurso preso, lidos do pin-spacer que o ScrollTrigger cria.
async function percurso(page: Page) {
  return page.evaluate(() => {
    const secao = document.querySelector<HTMLElement>('#como-trabalho')
    const espaco = secao?.parentElement
    if (!secao || !espaco?.classList.contains('pin-spacer')) throw new Error('sem pin-spacer')
    const nav = document.querySelector<HTMLElement>('nav[data-nav]')?.offsetHeight ?? 0
    const inicio = espaco.getBoundingClientRect().top + window.scrollY - nav
    return { inicio, distancia: espaco.offsetHeight - secao.offsetHeight, nav }
  })
}

async function rolarAte(page: Page, y: number) {
  await page.evaluate((alvo) => window.scrollTo(0, alvo), y)
  await page.waitForTimeout(400)
}

const estado = (page: Page) =>
  page.evaluate(() => {
    const secao = document.querySelector<HTMLElement>('#como-trabalho')
    const trilha = document.querySelector<HTMLElement>('#como-trabalho [data-trilha-faixa]')
    return { topo: secao?.getBoundingClientRect().top ?? Number.NaN, transform: trilha ? getComputedStyle(trilha).transform : '' }
  })

// scaleY de cada haste, lido da matriz do transform computado.
const escalasDasHastes = (page: Page) =>
  page.locator('#como-trabalho .haste').evaluateAll((els) =>
    els.map((el) => {
      const t = getComputedStyle(el).transform
      if (t === 'none') return 1
      return Number(t.replace(/^matrix\(|\)$/g, '').split(',')[3])
    }),
  )

async function etapasVisiveis(page: Page) {
  const etapas = page.locator('#como-trabalho ol > li')
  await expect(etapas).toHaveCount(5)
  for (const [i, e] of perfil.etapas.entries()) {
    await expect(etapas.nth(i)).toBeVisible()
    await expect(etapas.nth(i)).toContainText(e.titulo)
    await expect(etapas.nth(i)).toContainText(e.texto)
  }
}

test.describe('com movimento, no computador', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a seção fica presa enquanto a trilha corre, e as cinco hastes chegam ao fim', async ({ page }) => {
    await page.goto('./')
    await page.locator('#como-trabalho').scrollIntoViewIfNeeded()
    await esperarTrilha(page)
    await page.waitForTimeout(300)
    const { inicio, distancia, nav } = await percurso(page)
    expect(distancia).toBeGreaterThan(300)

    await rolarAte(page, inicio + distancia * 0.2)
    const a = await estado(page)
    await rolarAte(page, inicio + distancia * 0.6)
    const b = await estado(page)
    // O topo fica parado logo abaixo da barra fixa, sem ser coberto por ela.
    expect(Math.abs(a.topo - b.topo)).toBeLessThanOrEqual(1)
    expect(a.topo).toBeGreaterThanOrEqual(nav - 1)
    expect(a.transform).not.toBe(b.transform)

    await rolarAte(page, inicio + distancia + 2)
    await expect.poll(() => escalasDasHastes(page), { timeout: 3_000 }).toEqual([1, 1, 1, 1, 1])
    await etapasVisiveis(page)
  })

  test('a linha do terminal acompanha a etapa da trilha', async ({ page }) => {
    await page.goto('./')
    await page.locator('#como-trabalho').scrollIntoViewIfNeeded()
    await esperarTrilha(page)
    await page.waitForTimeout(300)
    const { inicio, distancia } = await percurso(page)
    await rolarAte(page, inicio + distancia + 2)
    await expect(page.locator('#como-trabalho [data-terminal] [data-ativa]')).toHaveCount(1)
    await expect(page.locator('#como-trabalho [data-terminal] .terminal-linha').last()).toHaveAttribute('data-ativa', '')
    await rolarAte(page, inicio)
    await expect(page.locator('#como-trabalho [data-terminal] .terminal-linha').first()).toHaveAttribute('data-ativa', '')
  })

  test('a âncora da navegação para no começo da seção presa', async ({ page }) => {
    await page.goto('./')
    await page.waitForLoadState('networkidle')
    await page.locator('nav[data-nav] a[href="#como-trabalho"]').click()
    await esperarTrilha(page)
    await page.waitForTimeout(500)
    const secao = page.locator('#como-trabalho')
    await expect(secao).toBeInViewport()
    await expect(secao.getByRole('heading', { level: 2 })).toBeInViewport()
  })

  test('com a trilha no fim, o axe não acha violação grave na seção', async ({ page }) => {
    await page.goto('./')
    await page.locator('#como-trabalho').scrollIntoViewIfNeeded()
    await esperarTrilha(page)
    await page.waitForTimeout(300)
    const { inicio, distancia } = await percurso(page)
    await rolarAte(page, inicio + distancia + 2)
    await page.waitForTimeout(600)
    const r = await new AxeBuilder({ page }).include('#como-trabalho').analyze()
    expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([])
  })

  test('Ctrl+P com a seção presa: volta a linha estática, com as cinco etapas', async ({ page }) => {
    await page.goto('./')
    await page.locator('#como-trabalho').scrollIntoViewIfNeeded()
    await esperarTrilha(page)
    await page.waitForTimeout(300)
    const { inicio, distancia } = await percurso(page)
    await rolarAte(page, inicio + distancia * 0.5)
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.pin-spacer')).toHaveCount(0)
    await expect(page.locator('#como-trabalho[data-trilha]')).toHaveCount(0)
    await etapasVisiveis(page)
  })

  test('do topo, rolando com a roda do mouse até a seção: o texto se divide certo e a seção prende', async ({ page }) => {
    await page.goto('./')
    await page.waitForLoadState('networkidle')
    // Ainda no topo, a seção está pulada pelo content-visibility e a trilha não montou.
    await expect(page.locator('#como-trabalho[data-trilha]')).toHaveCount(0)
    for (let i = 0; i < 80; i++) {
      await page.mouse.wheel(0, 400)
      await page.waitForTimeout(30)
      const topo = await page.evaluate(() => document.querySelector('#como-trabalho')?.getBoundingClientRect().top ?? 0)
      if (topo < 300) break
    }
    await esperarTrilha(page)
    await page.waitForTimeout(300)
    const { inicio, distancia } = await percurso(page)
    await rolarAte(page, inicio + distancia + 2)
    // Cada linha dividida tem a altura de uma linha só e cabe na largura do corpo da etapa.
    const versos = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('#como-trabalho .etapa-corpo')].map((corpo) => {
        const largura = corpo.clientWidth
        return [...corpo.querySelectorAll<HTMLElement>('.verso')].map((v) => {
          const r = document.createRange()
          r.selectNodeContents(v)
          return { altura: v.offsetHeight, alturaLinha: Number.parseFloat(getComputedStyle(v).lineHeight), largura: r.getBoundingClientRect().width, cabe: largura }
        })
      }),
    )
    expect(versos).toHaveLength(5)
    for (const etapa of versos) {
      // número, título e pelo menos uma linha de texto
      expect(etapa.length).toBeGreaterThanOrEqual(3)
      for (const v of etapa) {
        expect(v.altura).toBeLessThanOrEqual(v.alturaLinha * 1.2)
        expect(v.largura).toBeLessThanOrEqual(v.cabe + 1)
      }
    }
    await expect.poll(() => escalasDasHastes(page), { timeout: 3_000 }).toEqual([1, 1, 1, 1, 1])
  })
})

test('no celular (390 px), fica a versão estática vertical: sem pin e com as cinco etapas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('./')
  await page.waitForLoadState('networkidle')
  await page.locator('#como-trabalho').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await expect(page.locator('.pin-spacer')).toHaveCount(0)
  await expect(page.locator('#como-trabalho[data-trilha]')).toHaveCount(0)
  await etapasVisiveis(page)
})

test('sem JavaScript, as cinco etapas aparecem', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(URL_ABSOLUTA)
  await page.locator('#como-trabalho').scrollIntoViewIfNeeded()
  await etapasVisiveis(page)
  await ctx.close()
})

test('com movimento reduzido, nada fica preso e as cinco etapas aparecem', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(URL_ABSOLUTA)
  await page.waitForLoadState('networkidle')
  await page.locator('#como-trabalho').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await expect(page.locator('.pin-spacer')).toHaveCount(0)
  await expect(page.locator('#como-trabalho[data-trilha]')).toHaveCount(0)
  await etapasVisiveis(page)
  await ctx.close()
})

test('na impressão, as cinco etapas aparecem', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  await page.emulateMedia({ media: 'print' })
  await etapasVisiveis(page)
})

test('em 360 px, rolando pela seção, a página não rola na horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('./')
  await page.waitForLoadState('networkidle')
  await page.locator('#como-trabalho').scrollIntoViewIfNeeded()
  const altura = await page.evaluate(() => document.documentElement.scrollHeight)
  const topo = await page.evaluate(() => document.querySelector<HTMLElement>('#como-trabalho')?.getBoundingClientRect().top ?? 0)
  const base = await page.evaluate(() => window.scrollY)
  for (const passo of [0, 0.25, 0.5, 0.75, 1]) {
    await rolarAte(page, Math.min(altura, base + topo + passo * 1_800))
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(sobra).toBeLessThanOrEqual(0)
  }
  await etapasVisiveis(page)
})
