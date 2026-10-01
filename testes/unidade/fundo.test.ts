import { describe, expect, it } from 'vitest'
import { mascara, onda } from '../../src/scripts/fundo'

describe('onda', () => {
  it('vale 1 em cima da frente e cai dos dois lados', () => {
    expect(onda(500, 500, 100)).toBe(1)
    expect(onda(400, 500, 100)).toBeLessThan(1)
    expect(onda(400, 500, 100)).toBeCloseTo(onda(600, 500, 100))
  })
  it('longe da frente, praticamente some', () => {
    expect(onda(0, 1000, 100)).toBeLessThan(0.001)
  })
})

describe('mascara', () => {
  const W = 1440
  const H = 900
  it('fica entre 0 e 1 e some nos cantos', () => {
    for (const [x, y] of [
      [0, 0],
      [W, 0],
      [0, H],
      [W, H],
    ]) {
      expect(mascara(x, y, W, H)).toBeGreaterThanOrEqual(0)
      expect(mascara(x, y, W, H)).toBeLessThan(0.05)
    }
  })
  it('o anel em volta do texto é mais forte que o centro, onde fica o texto', () => {
    const centro = mascara(W * 0.42, H * 0.4, W, H)
    const anel = mascara(W * 0.85, H * 0.3, W, H)
    expect(anel).toBeGreaterThan(centro)
    expect(anel).toBeLessThanOrEqual(1)
    // O centro abranda, mas não apaga: a malha continua contínua por trás do texto.
    expect(centro).toBeGreaterThan(0.35)
    expect(centro).toBeLessThan(0.75)
  })
  it('no celular, onde o texto ocupa a largura toda, o miolo abranda mais', () => {
    expect(mascara(195, 400, 390, 844)).toBeLessThan(0.32)
    expect(mascara(195, 400, 390, 844)).toBeGreaterThan(0.2)
  })
})
