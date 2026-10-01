import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Abre toda pasta fechada que estiver à vista, até não sobrar nenhuma.
async function abrirPastas(page: Page) {
  for (;;) {
    const fechada = page.locator('button[data-pasta][aria-expanded="false"]:visible').first()
    if (!(await fechada.count())) return
    await fechada.click()
  }
}

// Passa por toda aba de todo projeto, abrindo as pastas que aparecerem em cada
// uma, e roda o axe a cada estado: como aba é ARIA tabs, só um painel por
// projeto fica visível de cada vez, então "todas as abas abertas" quer dizer
// passar por todas elas, não deixar todas visíveis ao mesmo tempo.
async function violacoesGraves(page: Page) {
  const graves = new Set(['serious', 'critical'])
  const achadas: string[] = []
  await abrirPastas(page)
  const primeira = await new AxeBuilder({ page }).analyze()
  for (const v of primeira.violations) if (graves.has(v.impact ?? '')) achadas.push(`${v.id} (${v.impact}): ${v.nodes.length} nó(s)`)

  for (const aba of await page.locator('[role="tab"]').all()) {
    await aba.click()
    await abrirPastas(page)
    const resultado = await new AxeBuilder({ page }).analyze()
    for (const v of resultado.violations) {
      if (graves.has(v.impact ?? '')) achadas.push(`${v.id} (${v.impact}) em [role=tab] ${await aba.textContent()}: ${v.nodes.length} nó(s)`)
    }
  }
  return achadas
}

// Sem isto, o axe pode flagrar o quadro no meio da animação de entrada (ainda
// clareando) como contraste insuficiente: um estado que dura uma fração de
// segundo, e não o "em repouso" que a checagem de contraste da WCAG mede.
test('zero violações graves ou críticas, com todas as abas e pastas abertas', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4329/portfolio/')
  const achadas = await violacoesGraves(page)
  expect(achadas).toEqual([])
  await ctx.close()
})

test('zero violações graves ou críticas em 360 px', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 360, height: 800 } })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4329/portfolio/')
  const achadas = await violacoesGraves(page)
  expect(achadas).toEqual([])
  await ctx.close()
})

// O axe precisa de JavaScript para rodar dentro da página, então "sem
// JavaScript" aqui é o script do site que não carrega: todo .js dele é
// bloqueado, e a página fica no HTML de origem, sem os papéis de ARIA tabs.
test('zero violações graves ou críticas sem o script do site', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.route('**/_astro/*.js', (route) => route.abort())
  await page.goto('http://localhost:4329/portfolio/')
  await expect(page.locator('[role="tablist"], [role="tab"], [role="tabpanel"]')).toHaveCount(0)
  await expect(page.locator('section[data-painel]')).toHaveCount(6)
  const resultado = await new AxeBuilder({ page }).analyze()
  const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nó(s)`)
  expect(graves).toEqual([])
  await ctx.close()
})
