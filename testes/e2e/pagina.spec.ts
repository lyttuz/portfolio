import { test, expect, type Page } from '@playwright/test'
import { perfil } from '../../src/conteudo/perfil'
import { projetos } from '../../src/conteudo/projetos'

// Abre toda pasta fechada que estiver à vista, até não sobrar nenhuma.
async function abrirPastas(page: Page) {
  for (;;) {
    const fechada = page.locator('button[data-pasta][aria-expanded="false"]:visible').first()
    if (!(await fechada.count())) return
    await fechada.click()
  }
}

test('a página abre sob /portfolio/', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gabriel Alves')
})

test('mostra os três projetos com o "Por dentro"', async ({ page }) => {
  await page.goto('./')
  for (const p of projetos) {
    const art = page.locator(`article[data-projeto="${p.id}"]`)
    await expect(art.getByRole('heading', { level: 2 })).toHaveText(p.titulo)
    await art.locator('[role="tab"][data-aba="estrutura"]').click()
    await expect(art.locator('[data-painel="estrutura"] [data-linha]').first()).toBeVisible()
  }
})

test('a aba Código saiu: nenhum projeto tem aba nem painel de código', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('[data-aba="codigo"]')).toHaveCount(0)
  await expect(page.locator('[data-painel="codigo"]')).toHaveCount(0)
})

test('cada projeto mostra o texto da dor', async ({ page }) => {
  await page.goto('./')
  for (const p of projetos) {
    const art = page.locator(`article[data-projeto="${p.id}"]`)
    await expect(art).toContainText(p.dor)
  }
})

test('o cabeçalho mostra a chamada', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('header#topo')).toContainText(perfil.chamada)
})

test('o rodapé convida para contar a rotina', async ({ page }) => {
  await page.goto('./')
  const rodape = page.locator('footer')
  await expect(rodape.getByRole('heading', { level: 2 })).toHaveText('Tem uma tarefa que toma horas da sua equipe toda semana?')
  await expect(rodape).toContainText('Me conta qual. Respondo por e-mail ou pelo LinkedIn.')
})

test('contatos e link do PDF', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('a[href="mailto:lyttuz@gmail.com"]').first()).toBeVisible()
  await expect(page.locator('a[href*="gabriel-alves-25021a303"]').first()).toBeVisible()
  await expect(page.locator('a[data-pdf]')).toHaveAttribute('href', '/portfolio/gabriel-alves-portfolio.pdf')
})

test('legível sem JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4329/portfolio/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (const p of projetos) {
    await expect(page.getByRole('heading', { name: p.titulo })).toBeVisible()
  }
  await ctx.close()
})

test('sem rolagem horizontal em 360 px, com "Por dentro" aberto', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('./')
  // Mede com cada aba aberta, e com todas as pastas dela abertas.
  for (const aba of await page.locator('[role="tab"]').all()) {
    await aba.click()
    await abrirPastas(page)
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(sobra).toBeLessThanOrEqual(0)
    // O editor corta o que transborda (overflow-hidden), então a página não acusaria.
    const cortados = await page.locator('[data-editor]:visible').evaluateAll((eds) => eds.filter((e) => e.scrollWidth > e.clientWidth).length)
    expect(cortados).toBe(0)
  }
})

test('etiqueta "Em construção" só aparece no Protocolador', async ({ page }) => {
  await page.goto('./')
  const protocolador = page.locator('article[data-projeto="protocolador"]')
  await expect(protocolador.locator('[data-estado]')).toBeVisible()
  await expect(protocolador.locator('[data-estado]')).toHaveText('Em construção')
  await expect(protocolador.getByRole('heading', { level: 2 })).toHaveText('Protocolador PJe')
  for (const id of ['escritorio', 'noticias']) {
    await expect(page.locator(`article[data-projeto="${id}"] [data-estado]`)).toHaveCount(0)
  }
})

test('a árvore é uma lista aninhada de verdade', async ({ page }) => {
  await page.goto('./')
  const art = page.locator('article[data-projeto="escritorio"]')
  await art.locator('[role="tab"][data-aba="estrutura"]').click()
  await abrirPastas(page)
  const linhasFilhas = art.locator('li:has(> [data-linha]:has-text("procuracao/")) > ul [data-linha]')
  await expect(linhasFilhas.filter({ hasText: 'instrucoes.md' })).toBeVisible()
})

test('abas pelo teclado: setas, Home e End', async ({ page }) => {
  await page.goto('./')
  const art = page.locator('article[data-projeto="protocolador"]')
  const aba = (nome: string) => art.locator(`[role="tab"][data-aba="${nome}"]`)
  const painel = (nome: string) => art.locator(`[role="tabpanel"][data-painel="${nome}"]`)
  await expect(aba('arquitetura')).toHaveAttribute('aria-selected', 'true')
  await expect(aba('estrutura')).toHaveAttribute('tabindex', '-1')
  await aba('arquitetura').focus()
  await page.keyboard.press('ArrowRight')
  await expect(aba('estrutura')).toHaveAttribute('aria-selected', 'true')
  await expect(aba('estrutura')).toBeFocused()
  await expect(aba('estrutura')).toHaveAttribute('tabindex', '0')
  await expect(aba('arquitetura')).toHaveAttribute('aria-selected', 'false')
  await expect(aba('arquitetura')).toHaveAttribute('tabindex', '-1')
  await expect(painel('estrutura')).toBeVisible()
  await expect(painel('arquitetura')).toHaveAttribute('hidden', '')
  await page.keyboard.press('End')
  await expect(aba('estrutura')).toHaveAttribute('aria-selected', 'true')
  await expect(painel('estrutura')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(aba('arquitetura')).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(aba('estrutura')).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Home')
  await expect(aba('arquitetura')).toHaveAttribute('aria-selected', 'true')
  await expect(painel('arquitetura')).toBeVisible()
  await expect(painel('estrutura')).toHaveAttribute('hidden', '')
})

test('pastas começam com a raiz e a primeira pasta abertas', async ({ page }) => {
  await page.goto('./')
  const pasta = (id: string, nome: string) => page.locator(`article[data-projeto="${id}"] button[data-pasta]`).filter({ hasText: nome }).first()
  await expect(pasta('escritorio', 'producao-documentos/')).toHaveAttribute('aria-expanded', 'true')
  await expect(pasta('escritorio', 'modelos/')).toHaveAttribute('aria-expanded', 'true')
  await expect(pasta('escritorio', 'procuracao/')).toHaveAttribute('aria-expanded', 'false')
  await expect(pasta('noticias', 'n8n-noticias/')).toHaveAttribute('aria-expanded', 'true')
  await expect(pasta('noticias', 'servico/src/')).toHaveAttribute('aria-expanded', 'true')
  await expect(pasta('protocolador', 'protocolo-automatizado/')).toHaveAttribute('aria-expanded', 'true')
})

test('clicar numa pasta fechada abre a lista filha', async ({ page }) => {
  await page.goto('./')
  const art = page.locator('article[data-projeto="escritorio"]')
  await art.locator('[role="tab"][data-aba="estrutura"]').click()
  const alvo = await art.locator('button[data-pasta][aria-expanded="false"]').first().getAttribute('aria-controls')
  const pasta = art.locator(`button[aria-controls="${alvo}"]`)
  const filha = page.locator(`#${alvo}`)
  await expect(pasta).toBeVisible()
  await expect(filha).toBeHidden()
  await pasta.click()
  await expect(pasta).toHaveAttribute('aria-expanded', 'true')
  await expect(filha).toBeVisible()
  await pasta.press('Enter')
  await expect(pasta).toHaveAttribute('aria-expanded', 'false')
  await expect(filha).toBeHidden()
})

test('sem JavaScript, painéis empilhados e árvore toda aberta', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4329/portfolio/')
  for (const p of projetos) {
    const art = page.locator(`article[data-projeto="${p.id}"]`)
    // Sem script, nada de ARIA tabs: a lista de abas fica escondida, e os
    // painéis são seções comuns, cada uma com o seu h3 visível.
    await expect(art.locator('[data-lista-abas]')).toBeHidden()
    await expect(art.locator('[role="tablist"], [role="tab"], [role="tabpanel"]')).toHaveCount(0)
    const nomes = ['arquitetura', 'estrutura']
    await expect(art.locator('section[data-painel]')).toHaveCount(nomes.length)
    for (const n of nomes) {
      await expect(art.locator(`section[data-painel="${n}"]`)).toBeVisible()
      await expect(art.locator(`section[data-painel="${n}"]`)).not.toHaveAttribute('aria-labelledby')
      await expect(art.locator(`[data-painel="${n}"] > h3.painel-titulo`)).toBeVisible()
    }
    const ocultas = await art.locator('[data-editor] ul').evaluateAll((uls) => uls.filter((u) => !(u as HTMLElement).checkVisibility()).length)
    expect(ocultas).toBe(0)
    await expect(art.locator('button[data-pasta][aria-expanded="false"]')).toHaveCount(0)
  }
  await ctx.close()
})

test('com JavaScript, o script aplica os papéis de ARIA tabs', async ({ page }) => {
  await page.goto('./')
  for (const p of projetos) {
    const art = page.locator(`article[data-projeto="${p.id}"]`)
    await expect(art.getByRole('tablist')).toBeVisible()
    await expect(art.getByRole('tab')).toHaveCount(2)
    const aba = art.getByRole('tab', { name: 'Arquitetura' })
    await expect(aba).toHaveAttribute('aria-selected', 'true')
    const painel = art.locator(`#${await aba.getAttribute('aria-controls')}`)
    await expect(painel).toHaveAttribute('role', 'tabpanel')
    await expect(painel).toHaveAttribute('aria-labelledby', (await aba.getAttribute('id')) ?? '')
  }
})

test('cada editor mostra o comando e o status do conteúdo', async ({ page }) => {
  await page.goto('./')
  for (const p of projetos) {
    const art = page.locator(`article[data-projeto="${p.id}"]`)
    const ed = p.porDentro.editor
    await expect(art.locator('[data-comando]')).toHaveText(ed.comando)
    for (const t of [...ed.statusEsquerda, ...ed.statusDireita]) {
      await expect(art.locator('[data-status]')).toContainText(t)
    }
    const raiz = p.porDentro.arvore.nome.replace(/\/$/, '')
    await expect(art.locator('[data-editor]')).toContainText(`~/${raiz}`)
    await expect(art.locator('[data-editor]')).toContainText(`~ / projetos / ${raiz}`)
  }
})

test('os editores ilustrativos têm legenda visível acima da janela, e o de notícias não', async ({ page }) => {
  await page.goto('./')
  for (const id of ['escritorio', 'protocolador']) {
    const art = page.locator(`article[data-projeto="${id}"]`)
    await art.getByRole('tab', { name: 'Estrutura' }).click()
    const painel = art.locator('[data-painel="estrutura"]')
    const legenda = painel.locator('[data-legenda]')
    await expect(legenda).toBeVisible()
    await expect(legenda).toHaveText('Estrutura ilustrativa, não é a pasta real.')
    const [topoLegenda, topoJanela] = await Promise.all([legenda.boundingBox(), painel.locator('[data-editor]').boundingBox()])
    expect(topoLegenda?.y ?? 0).toBeLessThan(topoJanela?.y ?? 0)
    await expect(painel.locator('[data-status]')).not.toContainText('main')
  }
  await expect(page.locator('article[data-projeto="noticias"] [data-legenda]')).toHaveCount(0)
})

test('a navegação leva aos três projetos e a "Como trabalho"', async ({ page }) => {
  await page.goto('./')
  const nav = page.locator('nav[data-nav]')
  const ancoras = nav.locator('a[href^="#"]:not([href="#topo"])')
  await expect(ancoras).toHaveCount(4)
  const alvos = ['#escritorio', '#protocolador', '#noticias', '#como-trabalho']
  expect(await ancoras.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(alvos)
  for (const alvo of alvos) await expect(page.locator(alvo)).toHaveCount(1)
  await expect(nav.getByRole('link', { name: 'Contato' })).toHaveAttribute('href', 'mailto:lyttuz@gmail.com')
})

test('"Como trabalho" tem as cinco etapas', async ({ page }) => {
  await page.goto('./')
  const secao = page.locator('section#como-trabalho')
  await expect(secao.getByRole('heading', { level: 2 })).toHaveText('Como trabalho')
  await expect(secao.locator('ol > li')).toHaveCount(5)
})

test('em 360 px, a navegação fica com nome e "Contato", sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('./')
  const nav = page.locator('nav[data-nav]')
  for (const a of await nav.locator('a[href^="#"]:not([href="#topo"])').all()) await expect(a).toBeHidden()
  await expect(nav.getByRole('link', { name: 'Contato' })).toBeVisible()
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(sobra).toBeLessThanOrEqual(0)
})

test('a faixa "Como está organizado" saiu', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByText('Como está organizado')).toHaveCount(0)
  await expect(page.locator('.faixa')).toHaveCount(0)
})

test('o cartão de stack mostra ícone onde o pacote tem, e só nome no Playwright', async ({ page }) => {
  await page.goto('./')
  const stack = page.locator('article[data-projeto="noticias"] [data-stack]')
  await expect(stack.locator('li')).toHaveCount(8)
  await expect(stack.locator('li:has-text("Playwright") svg')).toHaveCount(0)
  await expect(stack.locator('li:has-text("Docker") svg')).toHaveCount(1)
})

test('o HTML publicado não leva comentário de código', async ({ request }) => {
  const html = await (await request.get('./')).text()
  expect(html).not.toContain('<!--')
})

test('no papel, o contato do LinkedIn mostra o endereço; na tela, o rótulo', async ({ page }) => {
  await page.goto('./')
  const link = page.locator('header nav[aria-label="Contato"] a[href*="linkedin.com"]')
  const visivel = () => link.evaluate((a) => (a as HTMLElement).innerText.trim())
  expect(await visivel()).toBe('LinkedIn')
  await expect(link).toHaveAccessibleName('LinkedIn')
  await page.emulateMedia({ media: 'print' })
  expect(await visivel()).toBe('linkedin.com/in/gabriel-alves-25021a303')
})
