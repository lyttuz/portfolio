import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { blocoDoJob, cabecaDoJob, ler, nomesDosJobs, passosDoJob } from './workflow-texto'

// O que estes testes protegem, em todos os workflows:
// - segredo (secrets.*) só no passo que precisa dele, nunca no env do
//   workflow nem no do job, onde todo passo, inclusive o de ação de
//   terceiro, o receberia;
// - toda ação fixada pelo SHA do commit, com a tag num comentário, porque
//   tag de ação pode ser movida pelo dono para outro código;
// - checkout sem guardar o token do GitHub no .git/config;
// - auditoria de dependências e varredura de segredos no caminho do PR.

const DIR = '.github/workflows'
const WORKFLOWS = readdirSync(DIR)
  .filter((f) => f.endsWith('.yml'))
  .map((f) => ({ nome: f, yaml: ler(`${DIR}/${f}`) }))

// Lugares onde um secrets.* não pode aparecer: o topo do workflow e a cabeça de cada job.
function segredosForaDoPasso(yaml: string): string[] {
  const achados: string[] = []
  if (/secrets\./.test(yaml.split('\njobs:')[0])) achados.push('(workflow)')
  for (const job of nomesDosJobs(yaml)) if (/secrets\./.test(cabecaDoJob(blocoDoJob(yaml, job)))) achados.push(job)
  return achados
}

describe('segredos nos workflows', () => {
  it('controle: o detector acusa secrets.* no env do workflow e no do job', () => {
    // Montado em partes: escrito inteiro, seria lido como expressão de template.
    const SEGREDO = ['$', '{{ secrets.T }}'].join('')
    const noTopo = `name: x\nenv:\n  T: ${SEGREDO}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n`
    const noJob = `name: x\njobs:\n  a:\n    runs-on: ubuntu-latest\n    env:\n      T: ${SEGREDO}\n    steps:\n      - run: echo\n`
    const noPasso = `name: x\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n        env:\n          T: ${SEGREDO}\n`
    expect(segredosForaDoPasso(noTopo)).toEqual(['(workflow)'])
    expect(segredosForaDoPasso(noJob)).toEqual(['a'])
    expect(segredosForaDoPasso(noPasso)).toEqual([])
  })

  it('há workflows para ler', () => {
    expect(WORKFLOWS.map((w) => w.nome).sort()).toEqual(['codeql.yml', 'pr-com-issue.yml', 'publicar.yml', 'qualidade.yml'])
  })

  for (const { nome, yaml } of WORKFLOWS) {
    it(`${nome}: nenhum secrets.* no env do workflow nem no de job`, () => {
      expect(segredosForaDoPasso(yaml)).toEqual([])
    })
  }

  it('só BLOQUEIO e CODECOV_TOKEN são usados, e CODECOV_TOKEN só no passo do Codecov', () => {
    const usados = new Set(WORKFLOWS.flatMap(({ yaml }) => [...yaml.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1])))
    expect([...usados].sort()).toEqual(['BLOQUEIO', 'CODECOV_TOKEN'])
    for (const { yaml } of WORKFLOWS) {
      for (const job of nomesDosJobs(yaml)) {
        for (const passo of passosDoJob(blocoDoJob(yaml, job))) {
          if (passo.includes('secrets.CODECOV_TOKEN')) expect(passo).toMatch(/uses: codecov\/codecov-action@/)
        }
      }
    }
  })
})

describe('ações de terceiros', () => {
  it('toda ação fixada pelo SHA de 40 caracteres, com a tag exata em comentário', () => {
    const usos = WORKFLOWS.flatMap(({ nome, yaml }) => (yaml.match(/uses: .*$/gm) ?? []).map((l) => `${nome}: ${l}`))
    expect(usos.length).toBeGreaterThan(10)
    const soltas = usos.filter((l) => !/uses: [\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/.test(l))
    expect(soltas).toEqual([])
  })

  it('a mesma ação, no mesmo SHA, em todo lugar onde aparece', () => {
    const porAcao = new Map<string, Set<string>>()
    for (const { yaml } of WORKFLOWS) {
      for (const m of yaml.matchAll(/uses: ([\w.-]+\/[\w.-]+)[\w./-]*@([0-9a-f]{40})/g)) {
        porAcao.set(m[1], (porAcao.get(m[1]) ?? new Set()).add(m[2]))
      }
    }
    for (const [acao, shas] of porAcao) expect(shas.size, acao).toBe(1)
  })

  it('checkout nunca guarda o token no .git/config', () => {
    for (const { nome, yaml } of WORKFLOWS) {
      for (const job of nomesDosJobs(yaml)) {
        for (const passo of passosDoJob(blocoDoJob(yaml, job))) {
          if (/uses: actions\/checkout@/.test(passo)) expect(passo, `${nome} ${job}`).toMatch(/persist-credentials: false/)
        }
      }
    }
  })
})

describe('auditoria e varredura de segredos no PR', () => {
  const qualidade = ler(`${DIR}/qualidade.yml`)

  it('o job testes roda a auditoria das dependências de produção antes dos testes', () => {
    const passos = passosDoJob(blocoDoJob(qualidade, 'testes'))
    const iAuditoria = passos.findIndex((p) => /run: npm run auditoria$/m.test(p))
    expect(iAuditoria).toBeGreaterThan(-1)
    expect(iAuditoria).toBeLessThan(passos.findIndex((p) => /run: npm run teste:cobertura$/m.test(p)))
  })

  it('o job segredos varre o repositório e o site montado', () => {
    const passos = passosDoJob(blocoDoJob(qualidade, 'segredos')).join('\n')
    expect(passos).toMatch(/run: npm run segredos:repo[\s\S]*run: npm run build[\s\S]*run: npm run segredos:dist/)
  })

  it('o job e2e confere o site montado (teste:build) depois das duas builds', () => {
    const passos = passosDoJob(blocoDoJob(qualidade, 'e2e'))
    const i = (re: RegExp) => passos.findIndex((p) => re.test(p))
    expect(i(/run: npm run teste:build$/m)).toBeGreaterThan(i(/run: npm run build:sentry-teste$/m))
  })

  it('o publicar varre o site final, com a DSN, antes de enviar ao Pages', () => {
    const passos = passosDoJob(blocoDoJob(ler(`${DIR}/publicar.yml`), 'montar'))
    const i = (re: RegExp) => passos.findIndex((p) => re.test(p))
    const iFinal = passos.findIndex((p) => /PUBLIC_SENTRY_DSN/.test(p))
    expect(i(/run: npm run segredos:dist$/m)).toBeGreaterThan(iFinal)
    expect(i(/run: npm run segredos:dist$/m)).toBeLessThan(i(/upload-pages-artifact/))
    expect(i(/run: npm run auditoria$/m)).toBeGreaterThan(-1)
  })
})

describe('dependabot', () => {
  const yaml = ler('.github/dependabot.yml')

  it('npm e github-actions, toda semana, com as menores agrupadas', () => {
    for (const eco of ['npm', 'github-actions']) {
      const bloco = yaml.split(/\n(?= {2}- package-ecosystem:)/).find((b) => b.includes(`package-ecosystem: ${eco}`))
      expect(bloco, eco).toBeDefined()
      expect(bloco).toMatch(/interval: weekly/)
      expect(bloco).toMatch(/groups:[\s\S]*update-types:[\s\S]*- minor[\s\S]*- patch/)
    }
  })
})

describe('gatilhos, interpolação e permissões', () => {
  it('nenhum gatilho que roda com segredo sobre código de fora (pull_request_target, workflow_run)', () => {
    for (const { nome, yaml } of WORKFLOWS) expect(yaml, nome).not.toMatch(/pull_request_target|workflow_run/)
  })

  it('nenhuma expressão com texto de fora (github.event, github.head_ref, inputs) em run: ou script:', () => {
    // Título de PR, nome de branch e entrada de workflow_dispatch são escritos
    // por quem dispara: interpolados no shell ou no script, viram código.
    const re = /\$\{\{\s*(github\.event\.|github\.head_ref\b|inputs\.)/
    const expr = (dentro: string) => ['run: echo "$', `{{ ${dentro} }}"`].join('')
    expect(re.test(expr('github.head_ref'))).toBe(true)
    expect(re.test(expr('inputs.versao'))).toBe(true)
    expect(re.test(expr('github.ref_name'))).toBe(false)
    // Controle: o padrão pega a forma perigosa, e não o uso seguro pelo context do github-script.
    expect(re.test(['run: echo "$', '{{ github.event.pull_request.title }}"'].join(''))).toBe(true)
    expect(re.test('script: const corpo = context.payload.pull_request.body')).toBe(false)
    for (const { nome, yaml } of WORKFLOWS) {
      for (const job of nomesDosJobs(yaml)) {
        for (const passo of passosDoJob(blocoDoJob(yaml, job))) {
          const run = /(run|script): [\s\S]*/.exec(passo)?.[0] ?? ''
          expect(re.test(run), `${nome} ${job}: ${passo.split('\n')[0]}`).toBe(false)
        }
      }
    }
  })

  it('escrita só no CodeQL (security-events) e no job que publica (pages, id-token)', () => {
    const escritas = WORKFLOWS.flatMap(({ nome, yaml }) => [...yaml.matchAll(/^\s*([\w-]+): write$/gm)].map((m) => `${nome}: ${m[1]}`))
    expect(escritas.sort()).toEqual(['codeql.yml: security-events', 'publicar.yml: id-token', 'publicar.yml: pages'])
    const publicar = ler(`${DIR}/publicar.yml`)
    for (const job of nomesDosJobs(publicar)) if (job !== 'publicar') expect(blocoDoJob(publicar, job), job).not.toMatch(/: write$/m)
    expect(/write-all|permissions: write/.test(WORKFLOWS.map((w) => w.yaml).join('\n'))).toBe(false)
  })

  it('o CodeQL analisa o código e os próprios workflows', () => {
    expect(ler(`${DIR}/codeql.yml`)).toMatch(/languages: javascript-typescript, actions$/m)
  })
})
