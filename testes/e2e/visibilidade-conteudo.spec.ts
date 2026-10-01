import { test, expect } from '@playwright/test'

// As seções abaixo da dobra ganham content-visibility: auto para não custar
// layout/pintura enquanto fora da tela. Os três riscos: a âncora de navegação
// parar de revelar a seção, o ScrollTrigger medir errado antes de a seção
// nascer visível, e a impressão herdar o corte.

test('content-visibility: auto está nos projetos e em "Como trabalho", na tela', async ({ page }) => {
  await page.goto('./')
  const valores = await page.evaluate(() => [...document.querySelectorAll('.projeto, #como-trabalho')].map((el) => getComputedStyle(el).contentVisibility))
  expect(valores.length).toBeGreaterThanOrEqual(4)
  for (const v of valores) expect(v).toBe('auto')
})

test('no papel, o content-visibility desliga', async ({ page }) => {
  await page.goto('./')
  await page.emulateMedia({ media: 'print' })
  const valores = await page.evaluate(() => [...document.querySelectorAll('.projeto, #como-trabalho')].map((el) => getComputedStyle(el).contentVisibility))
  for (const v of valores) expect(v).not.toBe('auto')
})

test('a navegação por âncora revela a seção mesmo com content-visibility: auto', async ({ page }) => {
  await page.goto('./')
  await page.locator('nav[data-nav] a[href="#como-trabalho"]').click()
  await expect(page.locator('#como-trabalho')).toBeInViewport()
  await expect(page.locator('#como-trabalho').getByRole('heading', { level: 2 })).toBeVisible()
})

test('o ScrollTrigger mede certo com content-visibility: auto: o título da seção só anima ao ficar visível', async ({ page }) => {
  await page.goto('./')
  await page.waitForTimeout(300)
  // A entrada mora no título: a seção em si é o elemento preso da trilha.
  const secao = page.locator('#como-trabalho h2')
  const opacidadeAntes = await secao.evaluate((el) => Number(getComputedStyle(el).opacity))
  expect(opacidadeAntes).toBeLessThan(1)
  await secao.scrollIntoViewIfNeeded()
  await expect.poll(() => secao.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 2_000 }).toBe(1)
})
