// Uso: node scripts/trava.mjs repo|dist [diretório]|texto <arquivo>
//
// Só módulos do Node e da própria trava (ver testes/unidade/trava-cli.test.mjs):
// no CI ela roda num job sem npm ci, o único que recebe a lista, para nenhum
// código de dependência rodar ao lado dela.
//
// "texto" confere um arquivo de texto avulso. É o texto da página do PDF que o
// gerar-pdf.mjs exporta no CI com --exportar-texto, onde ele não lê a lista.
// "dist" aceita o diretório (no CI, o artefato fica fora do checkout); sem
// ele, confere o dist/ do projeto.
//
// Com a variável CI definida, a saída é só "TRAVA: reprovado": o log do CI é
// público, e arquivo, número de termo ou mesmo a contagem, rodada após
// rodada, serviriam de oráculo para adivinhar a lista. Localmente, o detalhe
// continua.
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { carregarLista, varrerArquivos } from './trava/nucleo.mjs'
import { arquivosDoRepo, arquivosDoDist } from './trava/varrer.mjs'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const alvo = process.argv[2]

// Arquivo ausente ou vazio reprova: "nada encontrado" num texto que não
// existe seria a falha silenciosa que a trava não pode ter.
function textoAvulso(caminho) {
  if (!caminho) throw new Error('use: node scripts/trava.mjs texto <arquivo>')
  if (!existsSync(caminho)) throw new Error(`${caminho} não existe`)
  const texto = readFileSync(caminho, 'utf8')
  if (!texto.trim()) throw new Error(`${caminho} está vazio`)
  return [{ nome: caminho, texto }]
}

try {
  const termos = carregarLista({ caminho: `${RAIZ}bloqueio.local.txt`, env: process.env })
  const dist = alvo === 'dist' ? (process.argv[3] ?? `${RAIZ}dist`) : null
  if (dist && !existsSync(dist)) throw new Error(`${dist} não existe: rode o build antes`)
  const arquivos = alvo === 'repo' ? arquivosDoRepo(RAIZ) : dist ? arquivosDoDist(dist) : alvo === 'texto' ? textoAvulso(process.argv[3]) : null
  if (!arquivos) throw new Error('use: node scripts/trava.mjs repo|dist [diretório]|texto <arquivo>')
  // Artefato que chegou vazio daria "nada encontrado" sem ter lido nada.
  if (dist && arquivos.length === 0) throw new Error(`${dist} não tem nenhum arquivo`)
  const achados = varrerArquivos(arquivos, termos)
  if (achados.length) {
    if (process.env.CI) {
      console.error('TRAVA: reprovado')
    } else {
      console.error(`TRAVA: ${achados.length} ocorrência(s) proibida(s). O termo não é mostrado; veja o número na sua lista local.`)
      for (const a of achados) console.error(`  ${a.nome}: termo nº ${a.termo}`)
    }
    process.exit(1)
  }
  console.log(`trava ${alvo}: ${arquivos.length} arquivo(s) conferido(s), nada encontrado`)
} catch (e) {
  console.error(`TRAVA: ${e.message}`)
  process.exit(1)
}
