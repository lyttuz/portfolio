import { describe, it, expect } from 'vitest'
import { perfil } from '../../src/conteudo/perfil'
import { projetos } from '../../src/conteudo/projetos'
import { iconeDe } from '../../src/conteudo/icones'

const tudo = JSON.stringify({ perfil, projetos })

describe('conteúdo', () => {
  it('tem os três projetos na ordem aprovada', () => {
    expect(projetos.map((p) => p.id)).toEqual(['escritorio', 'protocolador', 'noticias'])
  })
  it('não tem travessão', () => {
    expect(tudo).not.toMatch(/\u2014/)
  })
  it('só usa meia-risca entre números', () => {
    expect(tudo.match(/\D\u2013|\u2013\D/g)).toBeNull()
  })
  it('não afirma o que não existe', () => {
    expect(tudo).not.toMatch(/publica (sozinho|sozinha|automaticamente)|(extrai|extração|extracao)[^.]*\bIA\b|protocola (sozinho|automaticamente|direto)|j[áa] protocola|protocolo autom[áa]tico/i)
  })
  it('só cita número de teste conferido', () => {
    expect(new Set(tudo.match(/(\d+) testes/g))).toEqual(new Set(['195 testes']))
  })
  it('usa os contatos aprovados', () => {
    expect(perfil.email).toBe('lyttuz@gmail.com')
    expect(perfil.linkedin).toBe('https://www.linkedin.com/in/gabriel-alves-25021a303')
    expect(tudo).not.toMatch(/\(\d{2}\)\s?\d/)
  })
  it('todo projeto tem árvore e pelo menos dois destaques', () => {
    for (const p of projetos) {
      expect(p.destaques.length).toBeGreaterThanOrEqual(2)
      expect(p.porDentro.arvore.filhos?.length).toBeGreaterThan(0)
    }
  })
  it('todo projeto tem editor com comando e barra de status', () => {
    for (const p of projetos) {
      expect(p.porDentro.editor.comando.trim()).not.toBe('')
      expect(p.porDentro.editor.statusEsquerda.length).toBeGreaterThan(0)
      expect(p.porDentro.editor.statusDireita.length).toBeGreaterThan(0)
    }
  })
  it('escritório e protocolador mostram só a estrutura ilustrativa, com raiz fictícia', () => {
    const raizes = { escritorio: 'producao-documentos/', protocolador: 'protocolo-automatizado/' }
    for (const [id, raiz] of Object.entries(raizes)) {
      const p = projetos.find((p) => p.id === id)
      expect(p?.porDentro.arvore.nome).toBe(raiz)
      expect(p?.porDentro.editor.statusEsquerda).toEqual(['estrutura ilustrativa'])
    }
  })
  it('o pipeline de notícias continua com a branch main na barra de status', () => {
    expect(projetos.find((p) => p.id === 'noticias')?.porDentro.editor.statusEsquerda[0]).toBe('main')
  })
  it('só o Protocolador tem estado, e é "Em construção"', () => {
    expect(projetos.find((p) => p.id === 'protocolador')?.estado).toBe('Em construção')
    expect(projetos.find((p) => p.id === 'escritorio')?.estado).toBeUndefined()
    expect(projetos.find((p) => p.id === 'noticias')?.estado).toBeUndefined()
  })
  it('tem as cinco etapas de "Como trabalho", na ordem', () => {
    expect(perfil.etapas.map((e) => e.titulo)).toEqual(['Mapeio', 'Especifico', 'Construo', 'Testo', 'Documento'])
  })
  it('todo projeto tem dor não vazia', () => {
    for (const p of projetos) expect(p.dor.trim()).not.toBe('')
  })
  it('perfil.chamada é exatamente o texto aprovado', () => {
    expect(perfil.chamada).toBe('O que a sua equipe leva horas, às vezes dias, para fazer à mão, a IA faz em minutos. Eu construo essas ferramentas para o time gastar o tempo no que realmente exige gente.')
  })
  it('perfil.sobre é exatamente o texto aprovado', () => {
    expect(perfil.sobre).toBe(
      'Muita equipe perde o dia digitando o mesmo dado em vários lugares, conferindo documento à mão e refazendo o que deu errado na cópia. ' +
        'Eu mapeio essa rotina com quem executa e construo a ferramenta com IA que faz essa parte, para o time render mais no mesmo expediente. ' +
        'Hoje faço isso num escritório de advocacia, da geração de documentos ao protocolo judicial, este ainda em construção. ' +
        'Venho de administração e RH e curso Psicologia, e desenho o sistema a partir de como as pessoas trabalham de verdade.',
    )
  })
  it('cada etapa de "Como trabalho" tem o texto aprovado', () => {
    expect(perfil.etapas).toEqual([
      { titulo: 'Mapeio', texto: 'Acompanho a tarefa com quem faz e anoto cada passo.' },
      { titulo: 'Especifico', texto: 'Defino o que a ferramenta precisa fazer antes do código.' },
      { titulo: 'Construo', texto: 'Automatizo com IA o processo real da equipe.' },
      { titulo: 'Testo', texto: 'Testes automáticos conferem cada regra.' },
      { titulo: 'Documento', texto: 'Registro como funciona e como manter.' },
    ])
  })
  it('o sobre diz que o protocolo judicial ainda está em construção', () => {
    expect(perfil.sobre).toContain('da geração de documentos ao protocolo judicial, este ainda em construção.')
  })
  it('o destaque Confiável do protocolador diz o que os testes cobrem, sem prometer mais', () => {
    const destaque = projetos.find((p) => p.id === 'protocolador')?.destaques.find((d) => d.rotulo === 'Confiável')
    expect(destaque?.texto).toBe('195 testes automatizados cobrem as regras do fluxo.')
  })
  it('nenhum projeto tem trecho: a aba Código saiu', () => {
    for (const p of projetos) expect(Object.hasOwn(p.porDentro, 'trecho')).toBe(false)
  })
  it('escritório não cita número com separador de milhar', () => {
    const escritorio = JSON.stringify(projetos.find((p) => p.id === 'escritorio'))
    expect(escritorio).not.toMatch(/\d\.\d{3}/)
  })
  it('acha ícone para Python e não para Playwright', () => {
    expect(iconeDe('Python')).not.toBeNull()
    expect(iconeDe('Playwright')).toBeNull()
    expect(iconeDe('Coisa que não existe')).toBeNull()
  })
  it('todo item de stack, menos Playwright, tem ícone', () => {
    const itens = projetos.flatMap((p) => p.porDentro.stack).filter((s) => s !== 'Playwright')
    for (const s of itens) expect(iconeDe(s), s).not.toBeNull()
  })
})
