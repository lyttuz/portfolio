import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { varrerArquivos } from '../../scripts/trava/nucleo.mjs'
import { arquivosDoRepo, arquivosDoDist, historicoDoRepo, metadadosDoRepo } from '../../scripts/trava/varrer.mjs'

const termos = ['acmeadvocacia']

function repoTemporario() {
  const raiz = mkdtempSync(join(tmpdir(), 'trava-repo-'))
  execFileSync('git', ['init', '-q'], { cwd: raiz })
  execFileSync('git', ['config', 'user.name', 'Teste'], { cwd: raiz })
  execFileSync('git', ['config', 'user.email', 'teste@teste.com'], { cwd: raiz })
  return raiz
}

// `toThrow(regex)` do vitest não falha quando o valor lançado não é um Error
// de verdade (ex.: `throw undefined`, o que aconteceria se falhaInesperada
// perdesse o corpo): ele só confere a mensagem quando existe uma. Por isso os
// testes que precisam da mensagem exata capturam o erro à mão.
function capturarErro(fn) {
  try {
    fn()
  } catch (e) {
    return e
  }
  throw new Error('esperava que a função lançasse, e ela não lançou')
}

describe('arquivosDoRepo', () => {
  it('acha termo que só existe no histórico, adicionado e depois removido', () => {
    const raiz = repoTemporario()
    writeFileSync(join(raiz, 'nota.txt'), 'contato: acmeadvocacia')
    execFileSync('git', ['add', 'nota.txt'], { cwd: raiz })
    execFileSync('git', ['commit', '-q', '-m', 'adiciona nota'], { cwd: raiz })
    execFileSync('git', ['rm', '-q', 'nota.txt'], { cwd: raiz })
    execFileSync('git', ['commit', '-q', '-m', 'remove nota'], { cwd: raiz })

    const achados = varrerArquivos(arquivosDoRepo(raiz), termos)
    expect(achados.some((a) => a.nome === '(conteudo do historico de commits)')).toBe(true)
  })

  it('acha termo dentro de arquivo binário (.png)', () => {
    const raiz = repoTemporario()
    const bytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('acmeadvocacia', 'ascii')])
    writeFileSync(join(raiz, 'foto.png'), bytes)

    const achados = varrerArquivos(arquivosDoRepo(raiz), termos)
    expect(achados.some((a) => a.nome === 'foto.png')).toBe(true)
  })

  it('repositório sem commit não lança', () => {
    const raiz = repoTemporario()
    expect(() => arquivosDoRepo(raiz)).not.toThrow()
  })

  it('sem identidade configurada, nem local nem global, não lança, e ainda acha o histórico', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'trava-sem-id-'))
    execFileSync('git', ['init', '-q'], { cwd: raiz })
    writeFileSync(join(raiz, 'nota.txt'), 'contato: acmeadvocacia')
    execFileSync('git', ['add', 'nota.txt'], { cwd: raiz })
    // Identidade só para este commit, nunca gravada na configuração local do repo.
    execFileSync('git', ['-c', 'user.name=x', '-c', 'user.email=x@y.z', 'commit', '-q', '-m', 'commit sem identidade local'], { cwd: raiz })

    const pastaConfig = mkdtempSync(join(tmpdir(), 'trava-cfg-'))
    const configVazio = join(pastaConfig, 'gitconfig-vazio')
    writeFileSync(configVazio, '')
    const antigos = { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM: process.env.GIT_CONFIG_NOSYSTEM }
    // Isola do ~/.gitconfig real da máquina, para simular ambiente sem identidade (ex.: CI).
    process.env.GIT_CONFIG_GLOBAL = configVazio
    process.env.GIT_CONFIG_NOSYSTEM = '1'
    try {
      let achados
      expect(() => {
        achados = varrerArquivos(arquivosDoRepo(raiz), termos)
      }).not.toThrow()
      expect(achados.some((a) => a.nome === '(conteudo do historico de commits)')).toBe(true)
    } finally {
      for (const [chave, valor] of Object.entries(antigos)) {
        if (valor === undefined) delete process.env[chave]
        else process.env[chave] = valor
      }
    }
  })

  it('erro de git não relacionado (fora de repositório) propaga com o texto do git', () => {
    const pai = mkdtempSync(join(tmpdir(), 'trava-fora-'))
    const raiz = mkdtempSync(join(pai, 'sub-'))
    const antigo = process.env.GIT_CEILING_DIRECTORIES
    // Impede o git de subir e achar um repositório de verdade fora da pasta descartável.
    process.env.GIT_CEILING_DIRECTORIES = pai
    try {
      // O texto precisa vir do stderr capturado do git, e não só "algo foi lançado":
      // sem o stdio certo, o erro nativo do execFileSync perde esse texto.
      expect(() => arquivosDoRepo(raiz)).toThrow(/not a git repository/)
    } finally {
      if (antigo === undefined) delete process.env.GIT_CEILING_DIRECTORIES
      else process.env.GIT_CEILING_DIRECTORIES = antigo
    }
  })

  it('git ausente do PATH é erro de verdade e propaga com a mensagem real (nunca vira false)', () => {
    const raiz = repoTemporario()
    const pathAntigo = process.env.PATH
    // PATH vazio: o `git` do rev-parse deixa de ser encontrado (ENOENT), e essa
    // falha de spawn tem que propagar como erro de verdade, e não virar "sem commit".
    process.env.PATH = ''
    try {
      // A mensagem precisa vir de falhaInesperada (comando + causa real do spawn),
      // não de um erro genérico nem de um "throw undefined" (função sem corpo).
      const erro = capturarErro(() => historicoDoRepo(raiz))
      expect(erro).toBeInstanceOf(Error)
      expect(erro.message).toMatch(/git rev-parse --verify -q HEAD falhou.*ENOENT/)
    } finally {
      process.env.PATH = pathAntigo
    }
  })

  it('repositório que não existe de verdade (sem .git): metadadosDoRepo propaga com "git rev-parse"', () => {
    const pai = mkdtempSync(join(tmpdir(), 'trava-fora2-'))
    const raiz = mkdtempSync(join(pai, 'sub-'))
    const antigo = process.env.GIT_CEILING_DIRECTORIES
    process.env.GIT_CEILING_DIRECTORIES = pai
    try {
      // Se temCommit ignorasse a pasta certa (raiz) e checasse o repositório real
      // de quem chama, essa checagem passaria (o repositório do portfólio tem
      // commit), e o erro nunca apareceria.
      const erro = capturarErro(() => metadadosDoRepo(raiz))
      expect(erro).toBeInstanceOf(Error)
      expect(erro.message).toMatch(/git rev-parse --verify -q HEAD/)
    } finally {
      if (antigo === undefined) delete process.env.GIT_CEILING_DIRECTORIES
      else process.env.GIT_CEILING_DIRECTORIES = antigo
    }
  })

  it('identidade configurada: os metadados trazem o e-mail do commit e o autor atual (git var)', () => {
    const raiz = repoTemporario()
    writeFileSync(join(raiz, 'a.txt'), 'x')
    execFileSync('git', ['add', 'a.txt'], { cwd: raiz })
    execFileSync('git', ['commit', '-q', '-m', 'commit de teste'], { cwd: raiz })
    const meta = metadadosDoRepo(raiz)
    expect(meta.nome).toBe('(metadados dos commits e autor configurado)')
    expect(meta.texto).toContain('teste@teste.com')
    expect(meta.texto).toContain('commit de teste')
    // "git var GIT_AUTHOR_IDENT" sempre imprime um timestamp unix de 10 dígitos;
    // achar um prova que o comando rodou de verdade, e não só que a identidade
    // "parece" configurada.
    expect(meta.texto).toMatch(/\d{10}/)
    // O e-mail entre "<>" só aparece se "git var GIT_AUTHOR_IDENT" rodou na
    // pasta certa (raiz); se rodasse na pasta de quem chama (o próprio
    // portfólio), o autor ali é outro, e este e-mail nunca apareceria.
    expect(meta.texto).toContain('<teste@teste.com>')
  })

  it('e-mail configurado só com espaço não conta como identidade: git var não roda', () => {
    const raiz = repoTemporario()
    execFileSync('git', ['config', 'user.email', '   '], { cwd: raiz })
    writeFileSync(join(raiz, 'a.txt'), 'x')
    execFileSync('git', ['add', 'a.txt'], { cwd: raiz })
    execFileSync('git', ['commit', '-q', '-m', 'commit sem identidade de verdade'], { cwd: raiz })
    const meta = metadadosDoRepo(raiz)
    // Sem o timestamp de "git var GIT_AUTHOR_IDENT": só o e-mail em branco do
    // commit em si (do "%ae"/"%ce" do git log), nunca o autor atual.
    expect(meta.texto).not.toMatch(/\d{10}/)
  })

  it('repositório válido sem nenhum commit: metadados ficam vazios (nunca "Stryker was here")', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'trava-semcommit-meta-'))
    execFileSync('git', ['init', '-q'], { cwd: raiz })
    const pastaConfig = mkdtempSync(join(tmpdir(), 'trava-cfg-meta-'))
    const configVazio = join(pastaConfig, 'gitconfig-vazio')
    writeFileSync(configVazio, '')
    const antigos = { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM: process.env.GIT_CONFIG_NOSYSTEM }
    process.env.GIT_CONFIG_GLOBAL = configVazio
    process.env.GIT_CONFIG_NOSYSTEM = '1'
    try {
      expect(metadadosDoRepo(raiz).texto).toBe('\n')
    } finally {
      for (const [chave, valor] of Object.entries(antigos)) {
        if (valor === undefined) delete process.env[chave]
        else process.env[chave] = valor
      }
    }
  })

  it('repositório válido sem nenhum commit: historicoDoRepo fica vazio (nunca "Stryker was here")', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'trava-semcommit-hist-'))
    execFileSync('git', ['init', '-q'], { cwd: raiz })
    expect(historicoDoRepo(raiz).texto).toBe('')
  })

  it('mensagem de commit grande não estoura o buffer (só o limite real de 100 MB é generoso o bastante)', () => {
    const raiz = repoTemporario()
    writeFileSync(join(raiz, 'a.txt'), 'x')
    execFileSync('git', ['add', 'a.txt'], { cwd: raiz })
    // 20 mil caracteres: passa longe do limite mutado (~10 KB) e continua
    // trivial para o limite real (100 MB).
    const mensagemGrande = `commit grande ${'x'.repeat(20000)}`
    execFileSync('git', ['commit', '-q', '-m', mensagemGrande], { cwd: raiz })
    expect(() => metadadosDoRepo(raiz)).not.toThrow()
    expect(metadadosDoRepo(raiz).texto).toContain(mensagemGrande)
  })
})

describe('arquivosDoDist', () => {
  // Bytes com duas sequências UTF-8 válidas de 2 bytes ('é' = 0xC3 0xA9): lidos
  // como latin1, ficam com o mesmo tamanho dos bytes; lidos como utf8, cada
  // par vira 1 caractere só, e o tamanho encolhe. É o jeito de provar que a
  // extensão realmente decide a codificação, e não só que "algo" foi lido.
  const bytesBinarios = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xc3, 0xa9, 0xc3, 0xa9])

  it('desce em subpasta e usa barra normal no nome, mesmo em texto e em binário', () => {
    const dist = mkdtempSync(join(tmpdir(), 'trava-dist-'))
    writeFileSync(join(dist, 'index.html'), '<h1>ok</h1>')
    mkdirSync(join(dist, 'assets', 'js'), { recursive: true })
    writeFileSync(join(dist, 'assets', 'js', 'app.js'), 'console.log(1)')
    writeFileSync(join(dist, 'assets', 'foto.png'), bytesBinarios)

    const arquivos = arquivosDoDist(dist)
    const porNome = Object.fromEntries(arquivos.map((a) => [a.nome, a.texto]))

    expect(Object.keys(porNome).sort()).toEqual(['assets/foto.png', 'assets/js/app.js', 'index.html'])
    expect(porNome['index.html']).toBe('<h1>ok</h1>')
    expect(porNome['assets/js/app.js']).toBe('console.log(1)')
    // Binário lido como latin1: mesmo número de caracteres que de bytes, sem perda.
    expect(porNome['assets/foto.png']).toHaveLength(bytesBinarios.length)
  })

  it('cada extensão binária da lista é lida como latin1, byte a byte, sem perda', () => {
    const extensoes = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.pdf']
    for (const ext of extensoes) {
      const dist = mkdtempSync(join(tmpdir(), 'trava-dist-ext-'))
      writeFileSync(join(dist, `arquivo${ext}`), bytesBinarios)
      const [{ texto }] = arquivosDoDist(dist)
      expect(texto, `extensão ${ext}`).toHaveLength(bytesBinarios.length)
    }
  })

  it('a extensão binária é reconhecida em maiúsculo também (case-insensitive)', () => {
    const dist = mkdtempSync(join(tmpdir(), 'trava-dist-maiusc-'))
    writeFileSync(join(dist, 'FOTO.PNG'), bytesBinarios)
    const [{ texto }] = arquivosDoDist(dist)
    expect(texto).toHaveLength(bytesBinarios.length)
  })
})
