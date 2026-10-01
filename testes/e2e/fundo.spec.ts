import { test, expect, type Page } from '@playwright/test'

// Fundo em movimento: malha de pontos num canvas, com uma onda lenta. É
// decoração pura, então os riscos são de comportamento: ficar na frente do
// conteúdo, gastar CPU sem ninguém olhar, ignorar o movimento reduzido, deixar
// a tela preta sem JavaScript, ou aparecer no papel.

const quadros = (page: Page) => page.locator('canvas[data-fundo]').evaluate((c) => Number((c as HTMLCanvasElement).dataset.quadros ?? 0))

async function esperarAtivo(page: Page) {
  await expect(page.locator('html[data-fundo-ativo]')).toHaveCount(1, { timeout: 5_000 })
}

test('o canvas existe, é decorativo, fica atrás do conteúdo e não intercepta clique', async ({ page }) => {
  await page.goto('./')
  const canvas = page.locator('canvas[data-fundo]')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toHaveAttribute('aria-hidden', 'true')
  const estilo = await canvas.evaluate((c) => {
    const s = getComputedStyle(c)
    return { pointerEvents: s.pointerEvents, position: s.position, zIndex: s.zIndex }
  })
  expect(estilo.pointerEvents).toBe('none')
  expect(estilo.position).toBe('fixed')
  expect(Number(estilo.zIndex)).toBeLessThan(0)

  await esperarAtivo(page)
  // No centro de cada link do topo, quem recebe o clique é o link, e não o canvas.
  const links = page.locator('nav[data-nav] a')
  expect(await links.count()).toBeGreaterThan(0)
  const alvos = await links.evaluateAll((els) =>
    els
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        const r = el.getBoundingClientRect()
        const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return topo !== null && (topo === el || el.contains(topo))
      }),
  )
  expect(alvos.length).toBeGreaterThan(0)
  for (const ok of alvos) expect(ok).toBe(true)
})

// O fundo antigo nunca apareceu: o body tinha fundo preto opaco, e um filho
// fixo com z-index negativo pinta antes do fundo do body. A cor fica só no html.
test('o body não pinta fundo opaco por cima do canvas', async ({ page }) => {
  await page.goto('./')
  const cor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(cor).toBe('rgba(0, 0, 0, 0)')
})

test('com JS, depois do load o fundo ativa e o canvas acompanha o viewport vezes o DPR', async ({ page }) => {
  await page.goto('./')
  await esperarAtivo(page)
  const medidas = await page.locator('canvas[data-fundo]').evaluate((c) => {
    const el = c as HTMLCanvasElement
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    return { w: el.width, h: el.height, ew: Math.round(document.documentElement.clientWidth * dpr), eh: Math.round(document.documentElement.clientHeight * dpr) }
  })
  expect(medidas.w).toBe(medidas.ew)
  expect(medidas.h).toBe(medidas.eh)
})

test('ao redimensionar, o canvas acompanha o novo viewport', async ({ page }) => {
  await page.goto('./')
  await esperarAtivo(page)
  await page.setViewportSize({ width: 800, height: 600 })
  await expect
    .poll(() => page.locator('canvas[data-fundo]').evaluate((c) => [(c as HTMLCanvasElement).width === Math.round(document.documentElement.clientWidth * Math.min(devicePixelRatio, 2)), (c as HTMLCanvasElement).height === Math.round(document.documentElement.clientHeight * Math.min(devicePixelRatio, 2))]))
    .toEqual([true, true])
})

test.describe('com DPR 3', () => {
  test.use({ deviceScaleFactor: 3 })
  test('o canvas para no teto de 2', async ({ page }) => {
    await page.goto('./')
    await esperarAtivo(page)
    const r = await page.locator('canvas[data-fundo]').evaluate((c) => ({ w: (c as HTMLCanvasElement).width, esperado: Math.round(document.documentElement.clientWidth * 2) }))
    expect(r.w).toBe(r.esperado)
  })
})

test('sem movimento reduzido, o contador de quadros cresce', async ({ page }) => {
  await page.goto('./')
  await esperarAtivo(page)
  const antes = await quadros(page)
  await page.waitForTimeout(1_000)
  const depois = await quadros(page)
  // Uns 30 por segundo; o piso folgado só confirma que há loop.
  expect(depois - antes).toBeGreaterThan(5)
  // E o teto confirma o limite de cerca de 30 quadros por segundo.
  expect(depois - antes).toBeLessThan(45)
})

test('com a aba oculta, o loop para; ao voltar, retoma', async ({ page }) => {
  await page.goto('./')
  await esperarAtivo(page)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(100)
  const parado = await quadros(page)
  await page.waitForTimeout(700)
  expect(await quadros(page)).toBe(parado)

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => quadros(page)).toBeGreaterThan(parado + 3)
})

test.describe('com movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' })
  test('desenha a malha uma vez, parada, e não fica em loop', async ({ page }) => {
    await page.goto('./')
    await esperarAtivo(page)
    await page.waitForTimeout(1_000)
    expect(await quadros(page)).toBe(1)
    const pintado = await page.locator('canvas[data-fundo]').evaluate((c) => {
      const el = c as HTMLCanvasElement
      const dados = el.getContext('2d')?.getImageData(0, 0, el.width, el.height).data
      if (!dados) return false
      for (let i = 3; i < dados.length; i += 4) if (dados[i] > 0) return true
      return false
    })
    expect(pintado).toBe(true)
  })

  test('reage à mudança da preferência em tempo real', async ({ page }) => {
    await page.goto('./')
    await esperarAtivo(page)
    await page.waitForTimeout(300)
    expect(await quadros(page)).toBe(1)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect.poll(() => quadros(page)).toBeGreaterThan(5)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForTimeout(200)
    const parado = await quadros(page)
    await page.waitForTimeout(600)
    expect(await quadros(page)).toBe(parado)
  })
})

test('com JS ativo, o fallback em CSS some', async ({ page }) => {
  await page.goto('./')
  await esperarAtivo(page)
  await expect(page.locator('[data-fundo-reserva]')).toHaveCSS('display', 'none')
})

test.describe('sem JavaScript', () => {
  test.use({ javaScriptEnabled: false })
  test('a malha estática em CSS aparece no lugar do canvas', async ({ page }) => {
    await page.goto('./')
    const reserva = page.locator('[data-fundo-reserva]')
    await expect(reserva).toHaveCount(1)
    const estilo = await reserva.evaluate((el) => {
      const s = getComputedStyle(el)
      return { imagem: s.backgroundImage, display: s.display }
    })
    expect(estilo.imagem).not.toBe('none')
    expect(estilo.display).not.toBe('none')
  })
})

test('no papel, canvas e fallback somem', async ({ page }) => {
  await page.goto('./')
  await esperarAtivo(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('canvas[data-fundo]')).toHaveCSS('display', 'none')
  await expect(page.locator('[data-fundo-reserva]')).toHaveCSS('display', 'none')
})
