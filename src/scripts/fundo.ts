// Fundo em movimento: malha de pontos num canvas, com uma onda lenta que acende
// os pontos ao passar. É decoração pura. Entra depois do load, e se não entrar,
// fica a malha estática em CSS ([data-fundo-reserva]) no lugar.

// Malha em repouso.
const ESPACO = 26
const RAIO = 0.9
const ALFA = 0.1
// Pontos sob a frente da onda.
const RAIO_PICO = 1.6
const ALFA_PICO = 0.45
// Onda principal: atravessa a tela na diagonal, de cima à esquerda para baixo à direita.
const ONDA_PERIODO = 12_000
const ONDA_LARGURA = 170
const ONDA_ANGULO = (28 * Math.PI) / 180
// Segunda onda, mais fraca e mais lenta, no sentido contrário.
const ONDA2_PERIODO = 19_000
const ONDA2_LARGURA = 260
const ONDA2_ANGULO = (205 * Math.PI) / 180
const ONDA2_FORCA = 0.35
// Cerca de 30 quadros por segundo; a folga evita perder quadro num monitor de 60 Hz.
const QUADRO_MS = 1000 / 30 - 2
const DPR_TETO = 2
// Degraus de alfa: a malha em repouso em 8 níveis de máscara, e a onda em passos de 0,02.
const NIVEIS_REPOUSO = 8
const PASSO_ALFA = 0.02

/** Intensidade gaussiana de uma frente de onda em `frente`, para um ponto projetado em `p`. */
export function onda(p: number, frente: number, largura: number): number {
  const d = (p - frente) / largura
  return Math.exp(-d * d)
}

const suave = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Máscara: a malha some nas bordas da tela, no espírito da máscara radial da
 * grade antiga, e abranda (sem apagar) na coluna onde fica o texto. Assim a
 * onda aparece em volta do conteúdo e passa por trás dele sem disputar a leitura.
 */
export function mascara(x: number, y: number, w: number, h: number): number {
  const ex = (x - w * 0.5) / (w * 0.5)
  const ey = (y - h * 0.5) / (h * 0.5)
  const borda = 1 - suave(0.55, 1.2, Math.sqrt(ex * ex + ey * ey))
  // O texto rola por cima de um fundo fixo, então o miolo é uma coluna inteira,
  // e não um ponto: em qualquer altura da página há texto ali.
  // No celular o texto ocupa a largura toda, então a coluna também ocupa.
  const cx = (x - w * 0.47) / Math.min(w * 0.6, 432)
  const miolo = Math.exp(-cx * cx)
  return borda * (1 - (w < 640 ? 0.72 : 0.6) * miolo)
}

interface Ponto {
  x: number
  y: number
  m: number
  p1: number
  p2: number
}

export function iniciarFundo(canvas = document.querySelector<HTMLCanvasElement>('canvas[data-fundo]')) {
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const tela = canvas
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)')

  let pontos: Ponto[] = []
  let w = 0
  let h = 0
  // Faixa das projeções nos eixos das duas ondas, para a frente entrar e sair fora da tela.
  let faixa1 = [0, 0]
  let faixa2 = [0, 0]
  let pedido = 0
  let ultimo = 0
  let quadros = 0
  const repouso = document.createElement('canvas')
  const baldes: (Ponto | number)[][] = Array.from({ length: Math.ceil(ALFA_PICO / PASSO_ALFA) + 1 }, () => [])

  const e1 = [Math.cos(ONDA_ANGULO), Math.sin(ONDA_ANGULO)]
  const e2 = [Math.cos(ONDA2_ANGULO), Math.sin(ONDA2_ANGULO)]

  function medir() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_TETO)
    w = document.documentElement.clientWidth
    h = document.documentElement.clientHeight
    tela.width = Math.round(w * dpr)
    tela.height = Math.round(h * dpr)
    pontos = []
    // Centraliza a malha para as margens ficarem iguais dos dois lados.
    const ox = (w % ESPACO) / 2
    const oy = (h % ESPACO) / 2
    for (let y = oy; y <= h; y += ESPACO) {
      for (let x = ox; x <= w; x += ESPACO) {
        const m = mascara(x, y, w, h)
        if (m < 0.02) continue
        pontos.push({ x, y, m, p1: x * e1[0] + y * e1[1], p2: x * e2[0] + y * e2[1] })
      }
    }
    const cantos = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ]
    const proj = (e: number[]) => cantos.map(([x, y]) => x * e[0] + y * e[1])
    faixa1 = [Math.min(...proj(e1)), Math.max(...proj(e1))]
    faixa2 = [Math.min(...proj(e2)), Math.max(...proj(e2))]
    pintarRepouso()
  }

  // Posição da frente: sai de antes da tela e termina depois dela, e recomeça.
  function frente(t: number, periodo: number, faixa: number[], largura: number) {
    const fase = (t % periodo) / periodo
    const inicio = faixa[0] - largura * 2.5
    const fim = faixa[1] + largura * 2.5
    return inicio + (fim - inicio) * fase
  }

  // Camada da malha em repouso, pintada uma vez por tamanho de tela. A cada
  // quadro ela é copiada inteira, e só os pontos que a onda toca são desenhados
  // por cima, agrupados por nível de alfa: um fill por nível, e não um por ponto.
  function pintarRepouso() {
    repouso.width = tela.width
    repouso.height = tela.height
    const c = repouso.getContext('2d')
    if (!c) return
    c.setTransform(tela.width / w, 0, 0, tela.height / h, 0, 0)
    c.fillStyle = '#fff'
    for (let n = 1; n <= NIVEIS_REPOUSO; n++) {
      c.globalAlpha = (ALFA * n) / NIVEIS_REPOUSO
      c.beginPath()
      for (const pt of pontos) {
        if (Math.max(1, Math.round(pt.m * NIVEIS_REPOUSO)) !== n) continue
        c.moveTo(pt.x + RAIO, pt.y)
        c.arc(pt.x, pt.y, RAIO, 0, Math.PI * 2)
      }
      c.fill()
    }
  }

  function desenhar(t: number | null) {
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, tela.width, tela.height)
    ctx.drawImage(repouso, 0, 0)
    if (t !== null) {
      ctx.setTransform(tela.width / w, 0, 0, tela.height / h, 0, 0)
      ctx.fillStyle = '#fff'
      const f1 = frente(t, ONDA_PERIODO, faixa1, ONDA_LARGURA)
      const f2 = frente(t, ONDA2_PERIODO, faixa2, ONDA2_LARGURA)
      for (const balde of baldes) balde.length = 0
      for (const pt of pontos) {
        const i = Math.min(1, onda(pt.p1, f1, ONDA_LARGURA) + ONDA2_FORCA * onda(pt.p2, f2, ONDA2_LARGURA))
        if (i < 0.03) continue
        // Alfa que, somado ao do ponto em repouso por baixo, dá o alfa da onda.
        const base = pt.m * ALFA
        const extra = (pt.m * (ALFA + (ALFA_PICO - ALFA) * i) - base) / (1 - base)
        const nivel = Math.round(extra / PASSO_ALFA)
        if (nivel < 1) continue
        baldes[Math.min(nivel, baldes.length - 1)].push(pt, i)
      }
      for (let n = 1; n < baldes.length; n++) {
        const balde = baldes[n]
        if (balde.length === 0) continue
        ctx.globalAlpha = n * PASSO_ALFA
        ctx.beginPath()
        for (let k = 0; k < balde.length; k += 2) {
          const pt = balde[k] as Ponto
          const r = RAIO + (RAIO_PICO - RAIO) * (balde[k + 1] as number)
          ctx.moveTo(pt.x + r, pt.y)
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        }
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    quadros++
    tela.dataset.quadros = String(quadros)
    document.documentElement.setAttribute('data-fundo-ativo', '')
  }

  // O relógio da onda só anda com o loop rodando, e começa em zero: a primeira
  // frente nasce fora da tela, em vez de surgir no meio dela quando o fundo liga.
  let relogio = 0
  function passo(agora: number) {
    pedido = requestAnimationFrame(passo)
    if (ultimo === 0) ultimo = agora - QUADRO_MS
    const delta = agora - ultimo
    if (delta < QUADRO_MS) return
    ultimo = agora
    // Teto no passo: ao voltar de uma pausa, a onda continua de onde parou.
    relogio += Math.min(delta, 100)
    desenhar(relogio)
  }

  function parar() {
    cancelAnimationFrame(pedido)
    pedido = 0
    ultimo = 0
  }

  // Decide o estado certo para o momento: loop, um quadro parado, ou nada.
  function atualizar() {
    parar()
    if (reduzido.matches) {
      desenhar(null)
      return
    }
    if (document.visibilityState === 'hidden') return
    pedido = requestAnimationFrame(passo)
  }

  let espera = 0
  window.addEventListener('resize', () => {
    clearTimeout(espera)
    espera = window.setTimeout(() => {
      medir()
      // Com movimento reduzido, redesenha o quadro parado no tamanho novo.
      if (reduzido.matches) desenhar(null)
    }, 150)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') parar()
    else if (!reduzido.matches) atualizar()
  })
  reduzido.addEventListener('change', atualizar)

  medir()
  atualizar()
}
