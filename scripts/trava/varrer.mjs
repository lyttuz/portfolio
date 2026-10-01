import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const BINARIOS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.pdf'])

// Sem isto, o stderr do git (ex.: "fatal: not a git repository" fora de um
// repositório) vaza direto para o console de quem chama, além de já vir
// capturado em `r.stderr`/`error.stderr`. O comando substantivo continua
// jogando o erro para fora: isto só faz o texto aparecer uma vez, e no lugar
// certo, nunca duas.
// Stryker disable next-line ArrayDeclaration: nenhum teste consegue diferenciar de um array vazio; testado empiricamente que o Node cai no mesmo default de pipe nos três descritores quando o array fica curto ou vazio.
const STDIO_CAPTURADO = [
  // Stryker disable next-line StringLiteral: nenhum dos comandos de git chamados aqui lê stdin; qualquer valor nesta posição é equivalente (testado).
  'ignore',
  // Stryker disable next-line StringLiteral: com `encoding` definido, o Node devolve o stdout já capturado do mesmo jeito mesmo com string vazia aqui (testado empiricamente); não há teste de conteúdo capaz de diferenciar.
  'pipe',
  // Este índice (stderr) tem teste real: ver "propaga com o texto do git" em varrer.test.mjs.
  'pipe',
]

// Buffer generoso para `git log -p --all`, cujo tamanho cresce com o histórico inteiro.
const BUFFER_GRANDE = 1024 * 1024 * 100

// Binário não é pulado: é lido byte a byte como latin1 (um caractere por byte,
// sem perda), porque nome em EXIF, metadado de PDF ou tabela de fonte também vaza.
// A lista BINARIOS só escolhe a codificação, nunca decide o que entra na varredura.
function ler(raiz, nome) {
  const codificacao = BINARIOS.has(extname(nome).toLowerCase()) ? 'latin1' : 'utf8'
  return readFileSync(join(raiz, nome), codificacao)
}

// Erro de verdade (git ausente do PATH, repositório corrompido etc.) some da
// mensagem de status e vira exceção, para nunca virar "false" por engano.
function falhaInesperada(r, comando) {
  return new Error(`${comando} falhou: ${r.error ? r.error.message : r.stderr}`)
}

// Único propósito de cada cheque abaixo: decidir se a pré-condição existe
// (commit, identidade configurada), por código de saída, nunca por try/catch.
// 0 e 1 são resposta normal do git (existe / não existe); qualquer outro
// código, ou falha de spawn, é erro de verdade e propaga para fora, nunca
// vira "false" em silêncio. O comando substantivo que vem depois (git log,
// git var) roda sem try/catch, e propaga sozinho qualquer erro que tiver.
function temCommit(raiz) {
  const r = spawnSync('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd: raiz, encoding: 'utf8', stdio: STDIO_CAPTURADO })
  if (r.status === 0) return true
  if (r.status === 1) return false
  throw falhaInesperada(r, 'git rev-parse --verify -q HEAD')
}

function temIdentidadeConfigurada(raiz) {
  const r = spawnSync('git', ['config', 'user.email'], { cwd: raiz, encoding: 'utf8', stdio: STDIO_CAPTURADO })
  // Stryker disable next-line OptionalChaining: "?." só importa se r.stdout puder ser null/undefined com status 0, o que não acontece com stdio 'pipe' fixo (mutante isolado); testado.
  if (r.status === 0) return Boolean(r.stdout?.trim())
  if (r.status === 1) return false
  throw falhaInesperada(r, 'git config user.email')
}

// Rastreados e não rastreados que o git enviaria, sem os ignorados.
export function arquivosDoRepo(raiz) {
  const saida = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: raiz, encoding: 'utf8', stdio: STDIO_CAPTURADO })
  const arquivos = saida
    .split('\0')
    .filter(Boolean)
    .map((nome) => ({ nome, texto: ler(raiz, nome) }))
  const commitExiste = temCommit(raiz)
  return [...arquivos, metadadosDoRepo(raiz, commitExiste), historicoDoRepo(raiz, commitExiste)]
}

// Autor, committer e mensagem de todo commit ficam públicos junto com o repositório.
// O e-mail de autor configurado na máquina é o vazamento mais fácil de passar despercebido.
export function metadadosDoRepo(raiz, commitExiste = temCommit(raiz)) {
  const texto = commitExiste ? execFileSync('git', ['log', '--all', '--format=%an %ae %cn %ce%n%B'], { cwd: raiz, encoding: 'utf8', maxBuffer: BUFFER_GRANDE, stdio: STDIO_CAPTURADO }) : ''
  // Sem identidade configurada (ex.: GitHub Actions sem `git config user.email`),
  // `git var GIT_AUTHOR_IDENT` nem roda: não há o que essa checagem pontual leia.
  const autorAtual = temIdentidadeConfigurada(raiz) ? execFileSync('git', ['var', 'GIT_AUTHOR_IDENT'], { cwd: raiz, encoding: 'utf8', stdio: STDIO_CAPTURADO }) : ''
  return { nome: '(metadados dos commits e autor configurado)', texto: `${texto}\n${autorAtual}` }
}

// O conteúdo em si de todo commit, não só a mensagem: termo que entrou numa
// revisão e saiu numa seguinte continua público no histórico, e precisa ser
// achado ali, não só no estado atual dos arquivos.
export function historicoDoRepo(raiz, commitExiste = temCommit(raiz)) {
  const texto = commitExiste ? execFileSync('git', ['log', '--all', '-p', '--format='], { cwd: raiz, encoding: 'utf8', maxBuffer: BUFFER_GRANDE, stdio: STDIO_CAPTURADO }) : ''
  return { nome: '(conteudo do historico de commits)', texto }
}

export function arquivosDoDist(dist) {
  const lista = []
  const andar = (dir) => {
    for (const e of readdirSync(dir)) {
      const c = join(dir, e)
      if (statSync(c).isDirectory()) andar(c)
      else {
        const nome = relative(dist, c).replaceAll('\\', '/')
        lista.push({ nome, texto: ler(dist, nome) })
      }
    }
  }
  andar(dist)
  return lista
}
