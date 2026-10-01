import { test, expect } from '@playwright/test'

const AVISO = 'Este site registra erros técnicos de JavaScript para correção, sem dados pessoais.'
const HOST_SENTRY = /sentry\.io|ingest\.sentry/i

// Build principal (dist/, servida em 4329): sem PUBLIC_SENTRY_DSN, o build
// avisa no terminal (conferido manualmente, não dá pra ler stdout do build
// por aqui) e a página não pode pedir nada ao Sentry nem mostrar o aviso.
test.describe('sem PUBLIC_SENTRY_DSN', () => {
  test('nenhum pedido sai para o Sentry, e o chunk do SDK nem existe na build', async ({ page }) => {
    const pedidos: string[] = []
    await page.route(HOST_SENTRY, (route) => {
      pedidos.push(route.request().url())
      route.abort()
    })
    const pedidosSdk: string[] = []
    page.on('request', (req) => {
      if (/observabilidade/i.test(req.url())) pedidosSdk.push(req.url())
    })
    await page.goto('http://localhost:4329/portfolio/')
    await page.waitForLoadState('load')
    await page.waitForTimeout(500)
    expect(pedidos).toEqual([])
    expect(pedidosSdk).toEqual([])
  })

  test('o aviso de privacidade não aparece', async ({ page }) => {
    await page.goto('http://localhost:4329/portfolio/')
    await expect(page.getByText(AVISO)).toHaveCount(0)
  })
})

// Segunda build (dist-sentry-teste/, servida em 4333), com uma DSN falsa (ver
// scripts/build-sentry-teste.mjs). Toda requisição ao Sentry é interceptada e
// respondida localmente: nenhum pacote de verdade sai da máquina.
test.describe('com PUBLIC_SENTRY_DSN (build de teste, DSN falsa)', () => {
  const URL = 'http://localhost:4333/portfolio/'

  test('o aviso de privacidade aparece no rodapé', async ({ page }) => {
    await page.route(HOST_SENTRY, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    await page.goto(URL)
    await expect(page.getByText(AVISO)).toBeVisible()
  })

  test('o chunk do SDK só é pedido depois do load, e a interceptação cobre qualquer pedido ao Sentry', async ({ page }) => {
    let carregou = false
    page.on('load', () => {
      carregou = true
    })
    const pedidoSdkAntesDoLoad: string[] = []
    page.on('request', (req) => {
      if (/observabilidade/i.test(req.url()) && !carregou) pedidoSdkAntesDoLoad.push(req.url())
    })
    await page.route(HOST_SENTRY, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
    const pedidoSdk = page.waitForRequest((req) => /observabilidade/i.test(req.url()), { timeout: 5_000 })
    await page.goto(URL)
    await pedidoSdk
    expect(pedidoSdkAntesDoLoad).toEqual([])
  })
})
