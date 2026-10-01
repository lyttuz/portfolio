import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

// A trava roda no CI num job sem npm ci: só Node e o código do repositório.
// Por isso ela não pode importar nada de node_modules nem do resto do
// projeto, e os modos "dist <dir>" e "texto <arquivo>" têm que falhar
// fechado. No CI o log é público: ali a trava diz só quantas ocorrências
// achou, sem arquivo nem número de termo, para o log não servir de oráculo.

const TRAVA = 'scripts/trava.mjs'
// Lista falsa, pelo env: a trava lê BLOQUEIO antes do arquivo local, então
// este teste nunca toca a lista de verdade.
const TERMO = 'palavrinhaproibida'
const { CI: _ci, ...semCi } = process.env
const ENV_LOCAL = { ...semCi, BLOQUEIO: `# lista de teste\n${TERMO}\n` }
const ENV_CI = { ...ENV_LOCAL, CI: 'true' }
const rodarCom = (env, ...args) => spawnSync(process.execPath, [TRAVA, ...args], { encoding: 'utf8', env })
const rodar = (...args) => rodarCom(ENV_LOCAL, ...args)
const dir = mkdtempSync(join(tmpdir(), 'trava-texto-'))
const arquivo = (nome, texto) => {
  const caminho = join(dir, nome)
  mkdirSync(dirname(caminho), { recursive: true })
  writeFileSync(caminho, texto)
  return caminho
}

// Segue os imports a partir de um arquivo, transitivamente. Devolve os que
// não são node: nem caem num arquivo permitido. Import que não é literal
// (import(variavel)) não tem como ser conferido, e também reprova.
const IMPORTS = /\bfrom\s+(['"])([^'"]+)\1|\bimport\s*\(\s*([^)]*)\)|\bimport\s+(['"])([^'"]+)\4/g
function importsProibidos(inicio, permitido) {
  const vistos = new Set()
  const proibidos = []
  const visitar = (arquivo) => {
    if (vistos.has(arquivo)) return
    vistos.add(arquivo)
    for (const m of readFileSync(arquivo, 'utf8').matchAll(IMPORTS)) {
      let origem = m[2] ?? m[5]
      if (m[3] !== undefined) {
        const literal = /^\s*(['"])([^'"]+)\1\s*$/.exec(m[3])
        if (!literal) {
          proibidos.push(`${arquivo}: import(${m[3]})`)
          continue
        }
        origem = literal[2]
      }
      // node:module dá createRequire, que carrega pacote sem passar por import.
      if (origem.startsWith('node:') && origem !== 'node:module') continue
      const alvo = origem.startsWith('.') ? resolve(dirname(arquivo), origem) : null
      if (alvo && permitido(alvo) && existsSync(alvo)) visitar(alvo)
      else proibidos.push(`${arquivo}: ${origem}`)
    }
  }
  visitar(resolve(inicio))
  return proibidos
}

const RAIZ_TRAVA = resolve('scripts/trava')
const daTrava = (abs) => abs === resolve(TRAVA) || (abs.startsWith(RAIZ_TRAVA + sep) && !relative(RAIZ_TRAVA, abs).includes(sep) && abs.endsWith('.mjs'))

describe('trava: só módulos do Node', () => {
  it('controle: o verificador recusa import de pacote, de arquivo de fora e indireto', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'trava-imports-'))
    const escrever = (nome, texto) => {
      mkdirSync(dirname(join(raiz, nome)), { recursive: true })
      writeFileSync(join(raiz, nome), texto)
    }
    escrever('scripts/trava.mjs', "import { a } from './trava/a.mjs'\nimport { readFileSync } from 'node:fs'\n")
    escrever('scripts/trava/a.mjs', "import { b } from './b.mjs'\nexport const a = 1\n")
    escrever('scripts/trava/b.mjs', "import { chromium } from 'playwright'\nimport '../gerar-pdf.mjs'\nconst x = await import(nome)\nimport { createRequire } from 'node:module'\nexport const b = 1\n")
    escrever('scripts/gerar-pdf.mjs', 'export const c = 1\n')
    const base = join(raiz, 'scripts', 'trava')
    const permitido = (abs) => abs === join(raiz, 'scripts', 'trava.mjs') || (abs.startsWith(base + sep) && !relative(base, abs).includes(sep))
    const achados = importsProibidos(join(raiz, 'scripts', 'trava.mjs'), permitido)
    expect(achados.some((a) => a.endsWith(': playwright'))).toBe(true)
    expect(achados.some((a) => a.endsWith(': ../gerar-pdf.mjs'))).toBe(true)
    expect(achados.some((a) => a.includes('import(nome)'))).toBe(true)
    expect(achados.some((a) => a.endsWith(': node:module'))).toBe(true)
    expect(achados).toHaveLength(4)
  })

  it('scripts/trava.mjs, e tudo o que ele importa, só usa node: e scripts/trava/', () => {
    expect(importsProibidos(TRAVA, daTrava)).toEqual([])
  })
})

describe('trava texto <arquivo>', () => {
  it('texto limpo passa', () => {
    const r = rodar('texto', arquivo('limpo.txt', 'Texto comum da página.'))
    expect(r.status, r.stderr).toBe(0)
  })

  it('texto com termo reprova, sem imprimir o termo', () => {
    const r = rodar('texto', arquivo('sujo.txt', `Começo ${TERMO} fim.`))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/sujo\.txt: termo nº 1/)
    expect(`${r.stdout}${r.stderr}`).not.toContain(TERMO)
  })

  it('sem arquivo, com arquivo ausente ou vazio, reprova', () => {
    expect(rodar('texto').status).toBe(1)
    expect(rodar('texto', join(dir, 'nao-existe.txt')).status).toBe(1)
    expect(rodar('texto', arquivo('vazio.txt', '  \n')).status).toBe(1)
  })
})

describe('trava dist [diretório]', () => {
  it('confere o diretório pedido, fora do checkout', () => {
    arquivo('site-limpo/index.html', '<p>ok</p>')
    expect(rodar('dist', join(dir, 'site-limpo')).status).toBe(0)
    arquivo('site-sujo/a/index.html', `<p>${TERMO}</p>`)
    const r = rodar('dist', join(dir, 'site-sujo'))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/a\/index\.html: termo nº 1/)
  })

  it('diretório ausente reprova', () => {
    expect(rodar('dist', join(dir, 'nao-existe')).status).toBe(1)
  })

  it('diretório sem nenhum arquivo reprova, mesmo com subpastas', () => {
    // Controle: o mesmo diretório passa assim que ganha um arquivo.
    mkdirSync(join(dir, 'site-vazio', 'sub', 'mais'), { recursive: true })
    const r = rodar('dist', join(dir, 'site-vazio'))
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/nenhum arquivo/)
    arquivo('site-vazio/sub/index.html', '<p>ok</p>')
    expect(rodar('dist', join(dir, 'site-vazio')).status).toBe(0)
  })
})

describe('saída no CI', () => {
  it('com CI, só "TRAVA: reprovado": nem contagem, nem arquivo, nem número de termo, e ainda reprova', () => {
    const caminho = arquivo('ci/segredo-no-nome.txt', `${TERMO} e ${TERMO}`)
    const r = rodarCom(ENV_CI, 'texto', caminho)
    expect(r.status).toBe(1)
    const saida = `${r.stdout}${r.stderr}`
    expect(r.stderr.trim()).toBe('TRAVA: reprovado')
    expect(r.stdout).toBe('')
    expect(saida).not.toMatch(/\d|termo nº|segredo-no-nome|ocorrência/)
    expect(saida).not.toContain(TERMO)
  })

  it('com CI e nada achado, passa', () => {
    expect(rodarCom(ENV_CI, 'texto', arquivo('ci/limpo.txt', 'nada aqui')).status).toBe(0)
  })

  it('sem CI, a saída detalhada continua', () => {
    const r = rodarCom(ENV_LOCAL, 'texto', arquivo('local/sujo.txt', TERMO))
    expect(r.stderr).toMatch(/sujo\.txt: termo nº 1/)
  })
})
