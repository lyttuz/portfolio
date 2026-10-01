// Gera o PDF claro a partir do site já montado, e passa o texto final pela trava.
//
// Dois modos, e o segundo só existe pedido por nome:
// - sem argumento (local): carrega a lista e não gera o PDF se achar termo.
//   Lista ausente ou vazia derruba, como sempre.
// - --exportar-texto <arquivo> (CI): não carrega a lista. Escreve no arquivo o
//   mesmo texto que a trava conferiria (página, rodapé e título) e gera o PDF.
//   A conferência fica para o job trava, que roda sem node_modules e é o
//   único que recebe a lista (node scripts/trava.mjs texto <arquivo>). Este
//   script carrega o Playwright, que é código de dependência: a lista não
//   pode estar no mesmo processo.
import { chromium } from 'playwright'
import { mkdirSync, copyFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { servir } from './servir.mjs'
import { carregarLista, achar } from './trava/nucleo.mjs'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const NOME = 'gabriel-alves-portfolio.pdf'
const PORTA = 4330

// Apaga o PDF anterior antes de qualquer outra coisa: se a trava, o goto ou o
// navegador falharem mais adiante, o PDF velho não fica para trás parecendo atual.
rmSync(`${RAIZ}dist/${NOME}`, { force: true })
rmSync(`${RAIZ}saida/${NOME}`, { force: true })

const iFlag = process.argv.indexOf('--exportar-texto')
const exportarPara = iFlag >= 0 ? process.argv[iFlag + 1] : undefined
const argumentos = process.argv.slice(2)
const argumentosValidos = argumentos.length === 0 || (argumentos.length === 2 && iFlag === 2 && !exportarPara?.startsWith('--'))
if (!argumentosValidos) {
  console.error('use: node scripts/gerar-pdf.mjs [--exportar-texto <arquivo>]')
  process.exit(1)
}
if (exportarPara) rmSync(exportarPara, { force: true })
const termos = exportarPara ? null : carregarLista({ caminho: `${RAIZ}bloqueio.local.txt`, env: process.env })
const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' })
const rodape = `<div style="font-family:sans-serif;font-size:8pt;width:100%;text-align:center;color:#666">Gerado em ${hoje} · lyttuz.github.io/portfolio</div>`

const servidor = await servir(PORTA)
const navegador = await chromium.launch()
let codigo = 0
try {
  const pagina = await navegador.newPage()
  // Recusa da CSP no console: o PDF sairia sem o estilo ou o script recusado,
  // e sem erro nenhum. Só a contagem é impressa, nunca o texto da página.
  const recusas = []
  pagina.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) recusas.push(m.text())
  })
  await pagina.emulateMedia({ media: 'print', reducedMotion: 'reduce' })
  await pagina.goto(`http://localhost:${PORTA}/portfolio/`, { waitUntil: 'networkidle' })
  // No papel vai tudo: todos os painéis do "Por dentro" e todas as pastas do editor.
  await pagina.evaluate(() => {
    document.querySelectorAll('[data-abas] [data-painel]').forEach((p) => {
      p.hidden = false
    })
    document.querySelectorAll('[data-editor] button[data-pasta]').forEach((b) => {
      b.setAttribute('aria-expanded', 'true')
      const ul = document.getElementById(b.getAttribute('aria-controls') ?? '')
      if (ul) ul.hidden = false
    })
  })
  await pagina.evaluate(() => document.fonts.ready)
  const texto = `${await pagina.content()} ${rodape} ${await pagina.title()}`
  if (exportarPara) {
    mkdirSync(dirname(exportarPara), { recursive: true })
    writeFileSync(exportarPara, texto)
    console.log(`Texto do PDF exportado para ${exportarPara}, sem conferir: rode node scripts/trava.mjs texto ${exportarPara}`)
  }
  const achados = termos ? achar(texto, termos) : []
  if (recusas.length) {
    console.error(`CSP recusou ${recusas.length} recurso(s) na página do PDF. PDF não gerado.`)
    codigo = 1
  } else if (achados.length) {
    console.error(`TRAVA no PDF: termo(s) nº ${achados.join(', ')}. PDF não gerado.`)
    codigo = 1
  } else {
    const destino = `${RAIZ}dist/${NOME}`
    await pagina.pdf({
      path: destino,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: rodape,
      margin: { top: '16mm', bottom: '18mm', left: '14mm', right: '14mm' },
    })
    mkdirSync(`${RAIZ}saida`, { recursive: true })
    copyFileSync(destino, `${RAIZ}saida/${NOME}`)
    console.log(`PDF gerado: dist/${NOME} e saida/${NOME}`)
  }
} finally {
  await navegador.close()
  servidor.close()
}
process.exit(codigo)
