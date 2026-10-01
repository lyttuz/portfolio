import { describe, expect, it } from 'vitest'
import { etapaNaPonta, percursoDaTrilha } from '../../src/scripts/trilha'

describe('percursoDaTrilha', () => {
  it('rola 3,5 vezes a distância horizontal', () => {
    expect(percursoDaTrilha(540, 900)).toBe(1890)
  })
  it('tem piso de 1,5 tela e teto de 3,5 telas', () => {
    expect(percursoDaTrilha(100, 800)).toBe(1200)
    expect(percursoDaTrilha(5_000, 800)).toBe(2800)
  })
})

describe('etapaNaPonta', () => {
  it('começa na primeira e termina na última', () => {
    expect(etapaNaPonta(0, 5)).toBe(0)
    expect(etapaNaPonta(1, 5)).toBe(4)
  })
  it('troca de etapa quando a linha chega no ponto dela', () => {
    expect(etapaNaPonta(0.24, 5)).toBe(0)
    expect(etapaNaPonta(0.25, 5)).toBe(1)
    expect(etapaNaPonta(0.5, 5)).toBe(2)
    expect(etapaNaPonta(0.74, 5)).toBe(2)
  })
  it('fica dentro dos limites mesmo fora de 0 a 1, e com uma etapa só', () => {
    expect(etapaNaPonta(-1, 5)).toBe(0)
    expect(etapaNaPonta(2, 5)).toBe(4)
    expect(etapaNaPonta(0.5, 1)).toBe(0)
  })
})
