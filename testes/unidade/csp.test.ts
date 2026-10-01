import { describe, expect, it } from 'vitest'
import { montarCsp, origemDoSentry } from '../../src/seguranca/csp'

const diretivas = (csp: string) =>
  new Map(
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/) as [string, ...string[]])
      .map(([nome, ...valores]) => [nome, valores.join(' ')]),
  )

describe('origemDoSentry', () => {
  it('tira da DSN só o esquema e o host, sem chave nem projeto', () => {
    expect(origemDoSentry('https://chavePublica@o0.ingest.sentry.io/0')).toBe('https://o0.ingest.sentry.io')
    expect(origemDoSentry('https://abc123@o4507.ingest.us.sentry.io/4507')).toBe('https://o4507.ingest.us.sentry.io')
  })

  it('recusa DSN que não é https ou não parece DSN, em vez de montar uma CSP torta', () => {
    expect(() => origemDoSentry('http://chave@o0.ingest.sentry.io/0')).toThrow(/https/)
    expect(() => origemDoSentry('não é url')).toThrow()
    expect(() => origemDoSentry('https://o0.ingest.sentry.io/0')).toThrow(/chave/)
  })

  it('recusa host que não é do Sentry, inclusive o que só começa como um', () => {
    expect(() => origemDoSentry('https://chave@exemplo.com/1')).toThrow(/sentry\.io/)
    expect(() => origemDoSentry('https://chave@o0.ingest.sentry.io.exemplo.com/1')).toThrow(/sentry\.io/)
    expect(() => origemDoSentry('https://chave@sentry.io/1')).toThrow(/sentry\.io/)
  })

  it('recusa host com caractere que abriria outra diretiva na CSP', () => {
    // O parser de URL aceita ";" no host: sem a validação, a DSN abriria uma diretiva nova na política.
    expect(() => origemDoSentry('https://chave@o0.ingest.sentry.io;script-src/1')).toThrow(/host/)
    expect(() => montarCsp('https://chave@o0.ingest.sentry.io;script-src/1')).toThrow()
    expect(() => origemDoSentry("https://chave@o0.ingest.sentry.io'unsafe-inline'/1")).toThrow()
  })

  it('aceita porta no host', () => {
    expect(origemDoSentry('https://chave@o0.ingest.sentry.io:443/1')).toBe('https://o0.ingest.sentry.io')
    expect(origemDoSentry('https://chave@o0.ingest.sentry.io:8443/1')).toBe('https://o0.ingest.sentry.io:8443')
  })
})

describe('montarCsp', () => {
  it('sem DSN: só o próprio site, nada inline, nada de eval', () => {
    const csp = montarCsp(undefined)
    const d = diretivas(csp)
    expect(d.get('default-src')).toBe("'self'")
    expect(d.get('script-src')).toBe("'self'")
    expect(d.get('style-src')).toBe("'self'")
    expect(d.get('img-src')).toBe("'self' data:")
    expect(d.get('font-src')).toBe("'self'")
    expect(d.get('connect-src')).toBe("'self'")
    expect(d.get('object-src')).toBe("'none'")
    expect(d.get('base-uri')).toBe("'self'")
    expect(d.get('form-action')).toBe("'none'")
    expect(d.has('upgrade-insecure-requests')).toBe(true)
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/)
    // frame-ancestors é ignorada em <meta>; pô-la ali só daria falsa segurança.
    expect(d.has('frame-ancestors')).toBe(false)
  })

  it('DSN vazia conta como ausente', () => {
    expect(montarCsp('')).toBe(montarCsp(undefined))
  })

  it('com DSN: connect-src ganha só a origem de ingestão, e o resto não muda', () => {
    const sem = diretivas(montarCsp(undefined))
    const com = diretivas(montarCsp('https://chavePublica@o0.ingest.sentry.io/0'))
    expect(com.get('connect-src')).toBe("'self' https://o0.ingest.sentry.io")
    for (const [nome, valor] of sem) if (nome !== 'connect-src') expect(com.get(nome), nome).toBe(valor)
    expect(montarCsp('https://chavePublica@o0.ingest.sentry.io/0')).not.toContain('chavePublica')
  })
})
