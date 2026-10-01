import { describe, expect, it } from 'vitest'
import { blocoDoJob, cabecaDoJob, ler, nomesDosJobs, passosDoJob } from './workflow-texto'

// Os workflows são lidos como texto, sem parser de YAML. Cada job é isolado
// pelo nome, e cada passo pelo hífen da lista de steps, para que uma variável
// definida num passo não seja confundida com outra definida no job inteiro.
//
// O desenho que estes testes protegem:
// - PUBLIC_SENTRY_DSN nunca fica no env de um job. No publicar ela entra só
//   no passo do build final e no teste desse build, depois de toda a
//   verificação; no qualidade, só no passo de build do lighthouse. Um build
//   sem DSN que herdasse a variável quebraria os testes do caminho "Sentry
//   desligado".
// - BLOQUEIO (a lista da trava) só existe no job trava, e só no env dos
//   passos que rodam a trava. Esse job não instala dependência: build,
//   testes e PDF rodam código de node_modules, longe da lista.
// - npm ci roda sempre com --ignore-scripts.

const define = (variavel: string) => new RegExp(`${variavel}:\\s*\\$\\{\\{`)
const DSN = define('PUBLIC_SENTRY_DSN')
const LISTA = define('BLOQUEIO')
const USA_A_LISTA = /run: node scripts\/trava\.mjs (repo|dist "\$RUNNER_TEMP\/trava\/dist"|texto "\$RUNNER_TEMP\/trava\/pdf-texto\.txt")$/m
const TRAVA_REPO = 'run: node scripts/trava.mjs repo'
const TRAVA_DIST = 'run: node scripts/trava.mjs dist "$RUNNER_TEMP/trava/dist"'
const TRAVA_TEXTO = 'run: node scripts/trava.mjs texto "$RUNNER_TEMP/trava/pdf-texto.txt"'

const publicar = ler('.github/workflows/publicar.yml')
const qualidade = ler('.github/workflows/qualidade.yml')

describe('PUBLIC_SENTRY_DSN', () => {
  it('não é definida no nível do workflow nem no env de nenhum job', () => {
    for (const yaml of [publicar, qualidade]) {
      expect(yaml.split('jobs:')[0]).not.toMatch(DSN)
      for (const job of nomesDosJobs(yaml)) expect(cabecaDoJob(blocoDoJob(yaml, job)), job).not.toMatch(DSN)
    }
  })

  it('no publicar, entra só no build final do montar e no teste dele, depois do e2e', () => {
    const passos = passosDoJob(blocoDoJob(publicar, 'montar'))
    const comDsn = passos.filter((p) => DSN.test(p))
    expect(comDsn).toHaveLength(2)
    expect(comDsn[0]).toMatch(/run: npm run build$/m)
    expect(comDsn[1]).toMatch(/run: npm run teste:build$/m)
    const iDsn = passos.indexOf(comDsn[0])
    const iE2e = passos.findIndex((p) => /run: npm run e2e$/m.test(p))
    expect(iE2e).toBeGreaterThan(-1)
    expect(iDsn).toBeGreaterThan(iE2e)
    // Depois do build com DSN: o PDF, o teste do build, o secretlint e o envio do artefato.
    const depois = passos.slice(iDsn + 1).join('\n')
    expect(depois).toMatch(/npm run pdf -- --exportar-texto saida\/pdf-texto\.txt[\s\S]*npm run teste:build[\s\S]*npm run segredos:dist[\s\S]*upload-pages-artifact/)
    for (const job of ['trava', 'publicar']) expect(blocoDoJob(publicar, job)).not.toMatch(DSN)
  })

  it('no qualidade, só o passo de build do lighthouse a define', () => {
    for (const job of nomesDosJobs(qualidade)) {
      const comDsn = passosDoJob(blocoDoJob(qualidade, job)).filter((p) => DSN.test(p))
      if (job === 'lighthouse') {
        expect(comDsn).toHaveLength(1)
        expect(comDsn[0]).toMatch(/run: npm run build$/m)
      } else {
        expect(comDsn, job).toHaveLength(0)
      }
    }
  })
})

describe('BLOQUEIO', () => {
  for (const [nome, yaml] of [
    ['publicar', publicar],
    ['qualidade', qualidade],
  ] as const) {
    it(`no ${nome}, só no job trava, e só nos passos que rodam a trava`, () => {
      expect(yaml.split('jobs:')[0]).not.toMatch(LISTA)
      for (const job of nomesDosJobs(yaml)) {
        const bloco = blocoDoJob(yaml, job)
        expect(cabecaDoJob(bloco), job).not.toMatch(LISTA)
        const passos = passosDoJob(bloco)
        if (job !== 'trava') {
          expect(bloco, job).not.toMatch(/BLOQUEIO/)
          continue
        }
        for (const passo of passos) expect(LISTA.test(passo), passo).toBe(USA_A_LISTA.test(passo))
        expect(passos.filter((p) => LISTA.test(p))).toHaveLength(3)
      }
    })

    it(`no ${nome}, o job trava não instala nem roda dependência`, () => {
      const bloco = blocoDoJob(yaml, 'trava')
      expect(bloco).not.toMatch(/\bnpm\b|\bnpx\b|\byarn\b|\bpnpm\b/)
      expect(bloco).not.toMatch(/cache: npm/)
      for (const passo of [TRAVA_REPO, TRAVA_DIST, TRAVA_TEXTO]) expect(bloco).toContain(passo)
    })

    it(`no ${nome}, a trava confere o repositório antes de baixar artefato, e o artefato fica fora do checkout`, () => {
      const passos = passosDoJob(blocoDoJob(yaml, 'trava'))
      const iRepo = passos.findIndex((p) => p.includes(TRAVA_REPO))
      const downloads = passos.filter((p) => /uses: actions\/download-artifact@/.test(p))
      expect(iRepo).toBeGreaterThan(-1)
      expect(downloads.length).toBeGreaterThan(0)
      for (const d of downloads) {
        expect(passos.indexOf(d)).toBeGreaterThan(iRepo)
        expect(d).toMatch(/path: \$\{\{ runner\.temp \}\}\/trava/)
      }
    })
  }

  it('o PDF sai sem a lista, só com a exportação explícita do texto', () => {
    for (const yaml of [publicar, qualidade]) {
      const pdfs = yaml.match(/run: npm run pdf.*$/gm) ?? []
      expect(pdfs.length).toBeGreaterThan(0)
      for (const l of pdfs) expect(l).toBe('run: npm run pdf -- --exportar-texto saida/pdf-texto.txt')
    }
  })

  it('qualidade: a trava espera o e2e e fica de fora só no PR do Dependabot', () => {
    const cabeca = cabecaDoJob(blocoDoJob(qualidade, 'trava'))
    expect(cabeca).toMatch(/needs: e2e/)
    expect(cabeca).toMatch(/if: github\.actor != 'dependabot\[bot\]'/)
  })

  it('publicar: a publicação espera a trava, e a trava não é pulada', () => {
    expect(cabecaDoJob(blocoDoJob(publicar, 'publicar'))).toMatch(/needs: \[montar, trava\]/)
    const cabeca = cabecaDoJob(blocoDoJob(publicar, 'trava'))
    expect(cabeca).toMatch(/needs: montar/)
    expect(cabeca).not.toMatch(/\bif:/)
    // Confere o artefato exato do Pages, não um build refeito.
    expect(blocoDoJob(publicar, 'trava')).toMatch(/name: github-pages[\s\S]*tar -xf "\$RUNNER_TEMP\/trava\/pages\/artifact\.tar" -C "\$RUNNER_TEMP\/trava\/dist"/)
  })
})

describe('instalação e permissões', () => {
  it('npm ci sempre com --ignore-scripts', () => {
    for (const yaml of [publicar, qualidade]) {
      const instalacoes = yaml.match(/run: npm ci.*$/gm) ?? []
      expect(instalacoes.length).toBeGreaterThan(0)
      for (const linha of instalacoes) expect(linha).toBe('run: npm ci --ignore-scripts')
    }
  })

  it('publicar: só leitura no topo, escrita no Pages só no job publicar', () => {
    const topo = publicar.split('jobs:')[0]
    expect(topo).toMatch(/^permissions:\n {2}contents: read\n(?! )/m)
    expect(topo).not.toMatch(/pages: write|id-token: write/)
    expect(cabecaDoJob(blocoDoJob(publicar, 'montar'))).not.toMatch(/permissions:/)
    const job = blocoDoJob(publicar, 'publicar')
    expect(job).toMatch(/ {4}permissions:\n {6}pages: write\n {6}id-token: write/)
  })

  it('publicar: uma publicação em andamento nunca é cancelada', () => {
    expect(publicar).toMatch(/concurrency:\n {2}group: pages\n {2}cancel-in-progress: false/)
  })

  it('ação de terceiro fixada por SHA de commit, com a tag em comentário', () => {
    expect(qualidade).toMatch(/uses: codecov\/codecov-action@[0-9a-f]{40} # v\d+\.\d+\.\d+/)
  })
})
