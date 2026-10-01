// Trilha horizontal de "Como trabalho". Roda só no chunk preguiçoso do
// movimento, e só sem movimento reduzido. O HTML nasce estático e visível;
// aqui a seção ganha data-trilha (o CSS troca o layout), fica presa na tela e
// a rolagem vertical leva a faixa na horizontal. Tudo que este arquivo cria ou
// marca sai de novo no desmontar, que o movimento.ts chama antes de imprimir.
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

/**
 * Quanto rolar na vertical, em px, enquanto a faixa corre `distancia` px na
 * horizontal: 3,5 vezes a distância, para cada etapa ficar na tela o bastante
 * para ser lida, com piso de 1,5 tela e teto de 3,5 telas, para o percurso
 * preso não virar um túnel.
 */
export function percursoDaTrilha(distancia: number, alturaTela: number): number {
  return Math.round(Math.min(Math.max(distancia * 3.5, alturaTela * 1.5), alturaTela * 3.5))
}

// Suavização do scrub, em segundos: a faixa alcança a rolagem com inércia em
// vez de pular a cada dente da roda do mouse (com scrub: true, cada dente
// movia a faixa de uma vez só, num quadro).
const INERCIA = 0.8

/**
 * Qual etapa está na ponta da linha, de 0 a total - 1, para o progresso da
 * faixa entre 0 e 1. A etapa i chega à ponta em i / (total - 1); a primeira
 * já vale no começo.
 */
export function etapaNaPonta(progresso: number, total: number): number {
  if (total <= 1) return 0
  const p = Math.min(Math.max(progresso, 0), 1)
  return Math.min(total - 1, Math.floor(p * (total - 1) + 0.0001))
}

// A faixa corre de 0 a 1 no tempo da linha do tempo, e o fim segura um pouco,
// para a última etapa terminar de entrar antes de a seção soltar.
const FIM_DA_CORRIDA = 1
const SEGURA_NO_FIM = 0.12
// Janela de entrada de cada etapa, em volta do momento em que a linha chega nela.
const ANTES = 0.07
const DEPOIS = 0.07

function span(classe: string) {
  const el = document.createElement('span')
  el.className = classe
  el.setAttribute('aria-hidden', 'true')
  return el
}

function montar(secao: HTMLElement) {
  const janela = secao.querySelector<HTMLElement>('[data-trilha-janela]')
  const faixa = secao.querySelector<HTMLElement>('[data-trilha-faixa]')
  const etapas = [...secao.querySelectorAll<HTMLElement>('.etapas > li')]
  const linhasDoTerminal = [...secao.querySelectorAll<HTMLElement>('[data-terminal] .terminal-linha')]
  if (!janela || !faixa || !etapas.length) return () => {}

  secao.dataset.trilha = ''
  const base = span('trilha-linha')
  const viva = span('trilha-linha trilha-linha-viva')
  faixa.prepend(base)
  // A parte viva mora na primeira etapa: assim começa no primeiro ponto sem conta de posição.
  etapas[0].prepend(viva)
  const hastes = etapas.map((li) => {
    const haste = span('haste')
    li.querySelector('.etapa-corpo')?.prepend(haste)
    return haste
  })

  let ativa = -1
  const marcar = (indice: number) => {
    if (indice === ativa) return
    ativa = indice
    etapas.forEach((li, i) => {
      li.toggleAttribute('data-alcancada', i <= indice)
    })
    linhasDoTerminal.forEach((li, i) => {
      li.toggleAttribute('data-ativa', i === indice)
      li.toggleAttribute('data-feita', i < indice)
    })
  }

  // Número, título e texto de cada etapa sobem linha por linha, por trás de uma máscara.
  // aria 'none': o texto continua o mesmo, só embrulhado; um aria-label num <p> seria atributo proibido.
  // As classes vão à mão: .verso marca a linha e .verso-mask recebe a folga das pernas no CSS.
  const linhasDe = (li: HTMLElement) => {
    const divisao = SplitText.create(li.querySelectorAll('.etapa-numero, .etapa-titulo, .etapa-texto'), { type: 'lines', mask: 'lines', aria: 'none' })
    for (const m of divisao.masks) m.classList.add('verso-mask')
    for (const l of divisao.lines) l.classList.add('verso')
    return divisao.lines
  }

  const entrada = (li: HTMLElement, haste: HTMLElement, i: number) => {
    const tl = gsap.timeline()
    // Acima da linha, a haste cresce de baixo para cima; abaixo, de cima para baixo.
    tl.fromTo(haste, { scaleY: 0, transformOrigin: i % 2 === 0 ? '50% 100%' : '50% 0%' }, { scaleY: 1, duration: ANTES + DEPOIS, ease: 'none' }, 0)
      .fromTo(li.querySelector('.marco'), { scale: 0 }, { scale: 1, duration: 0.04, ease: 'back.out(2.5)' }, ANTES * 0.6)
      .fromTo(linhasDe(li), { yPercent: 135 }, { yPercent: 0, duration: 0.08, ease: 'power2.out', stagger: 0.015 }, ANTES * 0.8)
    return tl
  }

  const alturaDaBarra = () => document.querySelector<HTMLElement>('nav[data-nav]')?.offsetHeight ?? 0
  // offsetWidth, e não scrollWidth: o corpo da última etapa passa do passo, e
  // esse excesso não pode entrar na conta, senão o último ponto passa do --fim.
  const distancia = () => Math.max(0, faixa.offsetWidth - janela.clientWidth)

  // A primeira etapa entra enquanto a seção chega, antes de prender.
  const [primeira, ...demais] = etapas
  const primeiraEntrada = entrada(primeira, hastes[0], 0)
  ScrollTrigger.create({ trigger: secao, start: 'top 70%', end: () => `top ${alturaDaBarra() + 1}px`, scrub: INERCIA, animation: primeiraEntrada })

  // O terminal segue o tempo da linha do tempo, e não o progresso da rolagem:
  // com a inércia, a faixa chega um pouco depois, e o destaque acompanha o que
  // se vê. O scrub move a linha do tempo sem disparar o onUpdate dela, daí o
  // ticker: liga a cada rolagem que mexe no progresso e desliga quando a
  // inércia assenta. O marcar só mexe no DOM quando a etapa muda.
  // vivo cai no desmontar: um onUpdate atrasado do ScrollTrigger durante o
  // mm.revert (logo antes de imprimir) não pode religar o ticker nem marcar de
  // novo as etapas e o terminal que o desmontar acabou de limpar.
  let vivo = true
  let linhaDoTempo: gsap.core.Timeline | null = null
  const acompanhar = () => {
    if (vivo && linhaDoTempo) marcar(etapaNaPonta(Math.min(1, linhaDoTempo.time()), etapas.length))
  }
  // Uma chamada atrasada só, reaproveitada: cada rolagem a reinicia em vez de criar outra.
  const assentar = gsap
    .delayedCall(INERCIA + 0.2, () => {
      acompanhar()
      gsap.ticker.remove(acompanhar)
    })
    .pause()
  const acordar = () => {
    if (!vivo) return
    gsap.ticker.add(acompanhar)
    assentar.restart(true)
  }

  const corrida = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: secao,
      // Prende logo abaixo da barra fixa, para ela não cobrir o topo da seção.
      start: () => `top ${alturaDaBarra()}px`,
      end: () => `+=${percursoDaTrilha(distancia(), window.innerHeight)}`,
      pin: true,
      scrub: INERCIA,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      // O pin acrescenta altura à página: recalcula antes dos gatilhos que vêm depois dele (o rodapé).
      refreshPriority: 1,
      onUpdate: acordar,
    },
  })
  corrida.fromTo(faixa, { x: 0 }, { x: () => -distancia(), duration: FIM_DA_CORRIDA }, 0)
  corrida.fromTo(viva, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: FIM_DA_CORRIDA }, 0)
  demais.forEach((li, j) => {
    const i = j + 1
    const chegada = (i / (etapas.length - 1)) * FIM_DA_CORRIDA
    corrida.add(entrada(li, hastes[i], i), chegada - ANTES)
  })
  corrida.to({}, { duration: SEGURA_NO_FIM }, FIM_DA_CORRIDA)
  linhaDoTempo = corrida
  marcar(0)
  acordar()

  return () => {
    vivo = false
    linhaDoTempo = null
    assentar.kill()
    gsap.ticker.remove(acompanhar)
    for (const el of [base, viva, ...hastes]) el.remove()
    for (const li of [...etapas, ...linhasDoTerminal]) {
      li.removeAttribute('data-alcancada')
      li.removeAttribute('data-ativa')
      li.removeAttribute('data-feita')
    }
    delete secao.dataset.trilha
  }
}

/**
 * Liga a trilha e devolve a função que desliga tudo (pin, divisão do texto,
 * estilos e elementos criados, e a espera pela seção). Só monta quando a seção
 * entra na tela: antes disso o content-visibility: auto pode estar pulando o
 * layout dela, e o SplitText dividiria as linhas com medidas que não valem.
 * Abaixo de md (48rem) e em tela baixa (celular deitado) fica a versão
 * estática; cruzar esses limites refaz ou desfaz a trilha.
 */
export function montarTrilha(): () => void {
  const secao = document.querySelector<HTMLElement>('#como-trabalho')
  if (!secao) return () => {}
  const mm = gsap.matchMedia()
  let quadro = 0
  const observador = new IntersectionObserver((entradas) => {
    if (!entradas.some((e) => e.isIntersecting)) return
    observador.disconnect()
    // Um quadro depois de entrar: o navegador já desenhou a seção de verdade.
    quadro = requestAnimationFrame(() => {
      const acima = secao.getBoundingClientRect().top < 0
      const alturaAntes = document.documentElement.scrollHeight
      mm.add('(min-width: 48rem) and (min-height: 35rem)', () => montar(secao))
      // Quem chegou de baixo (a seção entrou pelo topo) não pode ver a página
      // pular: o pin acrescenta altura acima de onde a pessoa está.
      if (acima) window.scrollBy(0, document.documentElement.scrollHeight - alturaAntes)
    })
  })
  observador.observe(secao)
  return () => {
    observador.disconnect()
    cancelAnimationFrame(quadro)
    mm.revert()
  }
}
