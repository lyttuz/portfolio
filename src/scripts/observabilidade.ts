// Sentry carrega tarde, só com PUBLIC_SENTRY_DSN definido, e só para registrar
// erro técnico de JavaScript: sem replay, sem sessão, sem breadcrumbs, sem
// rastreamento de performance, sem dado pessoal. O astro.config.mjs já avisa
// na hora do build quando a DSN está ausente; aqui o guarda é o mesmo, para o caso de o import() ser chamado fora
// do fluxo do Base.astro (por exemplo, num teste).
import type { ErrorEvent, getDefaultIntegrations } from '@sentry/browser'

// O @sentry/browser não reexporta o tipo Integration; sai do retorno da função.
type Integration = ReturnType<typeof getDefaultIntegrations>[number]

// Integrações padrão que não são captura de erro: BrowserSession conta cada
// visita como sessão (sem erro nenhum), e Breadcrumbs grava cliques, console e
// navegação antes do erro. Os nomes são os do @sentry/browser instalado; o
// teste de unidade quebra se o pacote renomear alguma, porque aí o filtro
// deixaria de pegá-la sem reclamar.
export const INTEGRACOES_DESLIGADAS = ['BrowserSession', 'Breadcrumbs']

export function semIntegracoesDeRastro(padrao: Integration[]): Integration[] {
  return padrao.filter((i) => !INTEGRACOES_DESLIGADAS.includes(i.name))
}

// Tira do evento, antes de sair da máquina, o cabeçalho de requisição, o
// usuário, os breadcrumbs (reforço: a integração já está desligada) e a parte
// da URL que pode carregar dado (query string e hash, que às vezes guardam
// token, e-mail ou busca digitada).
//
// O IP do visitante continua sendo um risco à parte, fora do alcance deste
// código: o servidor do Sentry registra o IP de quem envia o evento no
// momento da ingestão, independente de qualquer opção aqui. Só a
// configuração do projeto no Sentry evita isso (ver
// docs/adr/0005-observabilidade-so-sentry.md).
export function limparDadoPessoal(evento: ErrorEvent): ErrorEvent {
  if (evento.request) {
    delete evento.request.headers
    if (evento.request.url) evento.request.url = semQueryNemHash(evento.request.url)
  }
  delete evento.user
  delete evento.breadcrumbs
  return evento
}

// Mantém só origem e caminho; descarta query string e hash. Faz na mão, sem
// o construtor URL, porque a URL registrada no evento às vezes é relativa
// (sem origem), e o construtor rejeitaria isso sem uma base.
function semQueryNemHash(url: string): string {
  return url.split('?')[0].split('#')[0]
}

export async function iniciarObservabilidade(): Promise<void> {
  const dsn = import.meta.env.PUBLIC_SENTRY_DSN
  if (!dsn) return
  const Sentry = await import('@sentry/browser')
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, urlQueryParams: false },
    integrations: semIntegracoesDeRastro,
    beforeSend: limparDadoPessoal,
  })
}
