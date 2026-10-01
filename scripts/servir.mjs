// Serve um diretório de build sob /portfolio/, igual ao GitHub Pages. Usado
// pelo PDF e pelos testes. Serve dist/ por padrão; o e2e do Sentry com DSN
// aponta para dist-sentry-teste/, a segunda build (ver build-sentry-teste.mjs).
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = '/portfolio/'
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
}

function criarResponder(raiz) {
  return async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (!url.startsWith(BASE)) {
      res.writeHead(404).end()
      return
    }
    let caminho = normalize(join(raiz, url.slice(BASE.length)))
    if (!caminho.startsWith(normalize(raiz))) {
      res.writeHead(403).end()
      return
    }
    try {
      if ((await stat(caminho)).isDirectory()) caminho = join(caminho, 'index.html')
      const corpo = await readFile(caminho)
      res.writeHead(200, { 'content-type': TIPOS[extname(caminho)] ?? 'application/octet-stream' })
      res.end(corpo)
    } catch {
      res.writeHead(404).end()
    }
  }
}

export function servir(porta = 4329, diretorio = 'dist') {
  const raiz = fileURLToPath(new URL(`../${diretorio}/`, import.meta.url))
  return new Promise((ok) => {
    const s = http.createServer(criarResponder(raiz))
    s.listen(porta, () => ok(s))
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const porta = Number(process.argv[2] ?? 4329)
  const diretorio = process.argv[3] ?? 'dist'
  // "ready" no meio da frase: é o padrão que o Lighthouse CI espera no stdout
  // para saber que o servidor subiu, antes de bater na URL.
  servir(porta, diretorio).then(() => console.log(`servidor pronto (ready) em http://localhost:${porta}${BASE}`))
}
