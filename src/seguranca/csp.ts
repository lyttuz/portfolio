// Política de segurança de conteúdo do site, montada no build e entregue por
// <meta http-equiv="Content-Security-Policy"> (o GitHub Pages não deixa
// definir cabeçalho). Tudo vem do próprio site: nenhum script, estilo ou fonte
// inline ou de terceiros. A única exceção é a origem de ingestão do Sentry, e
// só quando a DSN existe no build.
//
// Fica de fora, de propósito, o que a <meta> ignora: frame-ancestors,
// report-uri e sandbox. Escrever essas diretivas aqui daria a impressão de
// proteção que o navegador não aplica (ver docs/adr/0006-seguranca-de-site-estatico.md).

// Só esquema e host da DSN: a chave pública e o número do projeto não entram na
// política. DSN torta derruba o build, em vez de sair uma CSP que bloquearia o
// Sentry em silêncio.
export function origemDoSentry(dsn: string): string {
  const url = new URL(dsn)
  if (url.protocol !== 'https:') throw new Error('PUBLIC_SENTRY_DSN precisa ser https')
  if (!url.username) throw new Error('PUBLIC_SENTRY_DSN sem a chave pública antes do @: não parece uma DSN')
  // O parser de URL aceita ";" e aspas no host, e o host vai cru para dentro
  // da política: sem esta validação, uma DSN torta abriria diretiva nova.
  if (!/^[a-z0-9.-]+(:\d+)?$/.test(url.host)) throw new Error('PUBLIC_SENTRY_DSN com host inválido: só letras, números, ponto, hífen e porta')
  if (!url.hostname.endsWith('.sentry.io')) throw new Error('PUBLIC_SENTRY_DSN com host fora de .sentry.io')
  return `${url.protocol}//${url.host}`
}

export function montarCsp(dsn: string | undefined): string {
  const conexao = dsn ? `'self' ${origemDoSentry(dsn)}` : "'self'"
  return ["default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:", "font-src 'self'", `connect-src ${conexao}`, "object-src 'none'", "base-uri 'self'", "form-action 'none'", 'upgrade-insecure-requests'].join('; ')
}
