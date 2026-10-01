import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { normalizar, carregarLista, achar, varrerArquivos, ListaAusente } from '../../scripts/trava/nucleo.mjs'

const termos = ['acmeadvocacia', 'fulano de tal', '12 345', 'joao']

describe('normalizar', () => {
  it('tira acento, caixa e pontuação', () => {
    expect(normalizar('João, 12.345!')).toBe(' joao 12 345 ')
  })
  it('dobra letra de largura total (fullwidth) na letra comum', () => {
    expect(normalizar('Ｊｏａｏ')).toBe(' joao ')
  })
  it('separa ligadura tipográfica nas letras que a compõem', () => {
    expect(normalizar('ﬁscal')).toBe(' fiscal ')
  })
  it('remove caractere de largura zero no meio de uma palavra', () => {
    expect(normalizar('acme​advocacia')).toBe(' acmeadvocacia ')
  })
})

describe('achar', () => {
  it('acha termo com acento e caixa diferentes', () => {
    expect(achar('Falei com JOÃO ontem', termos)).toEqual([4])
  })
  it('acha número com pontuação diferente', () => {
    expect(achar('inscrição 12.345', termos)).toEqual([3])
  })
  it('acha termo de várias palavras', () => {
    expect(achar('Dr. Fulano   de Tal', termos)).toEqual([2])
  })
  it('acha termo longo só de letras dentro de palavra maior', () => {
    expect(achar('contato@acmeadvocacia.com.br', termos)).toEqual([1])
    expect(achar('@acmeadvocaciaoficial', termos)).toEqual([1])
  })
  it('não acha termo curto dentro de palavra maior', () => {
    expect(achar('joaozinho e 123456', termos)).toEqual([])
  })
  it('texto limpo não acha nada', () => {
    expect(achar('Processos e automação com IA', termos)).toEqual([])
  })
  it('acha termo escrito em letra de largura total (fullwidth)', () => {
    expect(achar(`Falei com Ｊｏａｏ ontem`, termos)).toEqual([4])
  })
  it('acha termo escondido atrás de ligadura tipográfica', () => {
    expect(achar('Documento ﬁscal enviado', ['fiscal'])).toEqual([1])
  })
  it('acha termo com caractere de largura zero enfiado no meio', () => {
    expect(achar('Contato: acme​advocacia', termos)).toEqual([1])
  })
})

describe('carregarLista', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'trava-'))
  it('lê do ambiente antes do arquivo', () => {
    expect(carregarLista({ caminho: join(pasta, 'nao-existe'), env: { BLOQUEIO: 'Acme\n# comentário\n\n12.345' } })).toEqual(['acme', '12 345'])
  })
  it('lê do arquivo quando o ambiente está vazio', () => {
    const arq = join(pasta, 'lista.txt')
    writeFileSync(arq, 'Fulano de Tal\n')
    expect(carregarLista({ caminho: arq, env: {} })).toEqual(['fulano de tal'])
  })
  it('ambiente só com espaço não conta como definido: cai pro arquivo', () => {
    const arq = join(pasta, 'lista-espaco.txt')
    writeFileSync(arq, 'Acme\n')
    expect(carregarLista({ caminho: arq, env: { BLOQUEIO: '   ' } })).toEqual(['acme'])
  })
  it('linha de comentário com espaço antes do # continua sendo comentário', () => {
    expect(carregarLista({ caminho: join(pasta, 'nao-existe'), env: { BLOQUEIO: 'Acme\n  # nota interna\nFulano' } })).toEqual(['acme', 'fulano'])
  })
  it('linha que normaliza pra vazio (só pontuação) não vira termo vazio', () => {
    expect(carregarLista({ caminho: join(pasta, 'nao-existe'), env: { BLOQUEIO: 'Acme\n!!!\nFulano' } })).toEqual(['acme', 'fulano'])
  })
  it('falha fechada sem lista', () => {
    expect(() => carregarLista({ caminho: join(pasta, 'nao-existe'), env: {} })).toThrow('lista de bloqueio ausente ou vazia: crie bloqueio.local.txt ou defina BLOQUEIO')
  })
  it('falha fechada com lista só de comentário', () => {
    expect(() => carregarLista({ caminho: join(pasta, 'x'), env: { BLOQUEIO: '# nada\n\n' } })).toThrow(ListaAusente)
  })
})

describe('varrerArquivos', () => {
  it('confere o nome do arquivo além do conteúdo', () => {
    const r = varrerArquivos(
      [
        { nome: 'docs/acmeadvocacia.md', texto: 'limpo' },
        { nome: 'ok.md', texto: 'fala com joão' },
      ],
      termos,
    )
    expect(r).toEqual([
      { nome: 'docs/acmeadvocacia.md', termo: 1 },
      { nome: 'ok.md', termo: 4 },
    ])
  })
})
