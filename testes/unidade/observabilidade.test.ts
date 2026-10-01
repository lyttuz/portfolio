import type { ErrorEvent } from '@sentry/browser'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { INTEGRACOES_DESLIGADAS, iniciarObservabilidade, limparDadoPessoal, semIntegracoesDeRastro } from '../../src/scripts/observabilidade'

const { init } = vi.hoisted(() => ({ init: vi.fn() }))
vi.mock('@sentry/browser', () => ({ init }))

function evento(parcial: Partial<ErrorEvent>): ErrorEvent {
  return { type: undefined, ...parcial } as ErrorEvent
}

describe('limparDadoPessoal', () => {
  it('apaga o cabeçalho da requisição', () => {
    const e = evento({ request: { url: 'https://lyttuz.github.io/portfolio/', headers: { cookie: 'segredo=1' } } })
    expect(limparDadoPessoal(e).request?.headers).toBeUndefined()
  })

  it('apaga o usuário', () => {
    const e = evento({ user: { id: '1', email: 'alguem@exemplo.com' } })
    expect(limparDadoPessoal(e).user).toBeUndefined()
  })

  it('tira a query string e o hash da URL da requisição, mantendo origem e caminho', () => {
    const e = evento({ request: { url: 'https://lyttuz.github.io/portfolio/?busca=alguem%40exemplo.com#secao' } })
    expect(limparDadoPessoal(e).request?.url).toBe('https://lyttuz.github.io/portfolio/')
  })

  it('URL só com hash, sem query: tira o hash e mantém o resto', () => {
    const e = evento({ request: { url: 'https://lyttuz.github.io/portfolio/#como-trabalho' } })
    expect(limparDadoPessoal(e).request?.url).toBe('https://lyttuz.github.io/portfolio/')
  })

  it('apaga os breadcrumbs', () => {
    const e = evento({ breadcrumbs: [{ message: 'clique em #contato' }] })
    expect(limparDadoPessoal(e).breadcrumbs).toBeUndefined()
  })

  it('sem request nem user, não quebra', () => {
    expect(() => limparDadoPessoal(evento({}))).not.toThrow()
  })
})

// O pacote real do Sentry, carregado uma vez só. A primeira carga, com o
// cache do Vitest frio, passou de 6 s numa máquina comum e estourava o limite
// padrão de 5 s do teste, reprovando de vez em quando sem defeito nenhum. Por
// isso a carga fica num beforeAll com limite próprio, e o teste também ganha
// folga explícita.
const LIMITE_SENTRY = 20_000
let real: typeof import('@sentry/browser')

describe('integrações do Sentry', () => {
  beforeAll(async () => {
    real = await vi.importActual<typeof import('@sentry/browser')>('@sentry/browser')
  }, LIMITE_SENTRY)

  it(
    'desliga sessão e breadcrumbs, e mantém a captura de erro',
    () => {
      const padrao = real.getDefaultIntegrations({})
      const nomesPadrao = padrao.map((i) => i.name)
      // Se o pacote renomear uma integração, o filtro deixaria de pegá-la sem
      // reclamar. Este teste quebra antes disso.
      for (const nome of INTEGRACOES_DESLIGADAS) expect(nomesPadrao).toContain(nome)
      const nomes = semIntegracoesDeRastro(padrao).map((i) => i.name)
      expect(nomes).not.toContain('BrowserSession')
      expect(nomes).not.toContain('Breadcrumbs')
      expect(nomes).toContain('GlobalHandlers')
      expect(nomes).toHaveLength(nomesPadrao.length - 2)
    },
    LIMITE_SENTRY,
  )

  it('o init recebe o filtro de integrações e o beforeSend', async () => {
    vi.stubEnv('PUBLIC_SENTRY_DSN', 'https://chave@exemplo.invalid/1')
    await iniciarObservabilidade()
    vi.unstubAllEnvs()
    expect(init).toHaveBeenCalledTimes(1)
    const opcoes = init.mock.calls[0][0]
    expect(opcoes.integrations).toBe(semIntegracoesDeRastro)
    expect(opcoes.beforeSend).toBe(limparDadoPessoal)
    expect(opcoes.tracesSampleRate).toBe(0)
  })
})
