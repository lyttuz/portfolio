// O HTML já nasce visível. Este script só anima por cima; se não carregar, nada some.
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { montarTrilha } from './trilha'

// Enquanto imprime, nenhuma linha começa animação: sem esta marca, uma aba ou
// pasta aberta nessa hora voltaria ao estado inicial da animação no papel.
let imprimindo = false
// Desliga a trilha presa de "Como trabalho"; existe só enquanto ela está montada.
let desmontarTrilha: (() => void) | null = null

function ligarTrilha() {
  desmontarTrilha?.()
  desmontarTrilha = montarTrilha()
}

function prepararImpressao() {
  window.addEventListener('afterprint', () => {
    imprimindo = false
    // Volta a trilha na tela. Os outros gatilhos, mortos no beforeprint, não
    // voltam (o conteúdo deles já ficou no estado final, visível).
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) ligarTrilha()
  })
  window.addEventListener('beforeprint', () => {
    imprimindo = true
    // Primeiro a trilha: desfaz o pin, a divisão do texto e o layout horizontal,
    // e o papel recebe a linha do tempo estática, que o CSS de impressão compacta.
    desmontarTrilha?.()
    ScrollTrigger.getAll().forEach((st) => {
      st.animation?.progress(1)
      st.kill()
    })
    gsap.globalTimeline.getChildren(true, true, false).forEach((t) => {
      t.progress(1)
    })
    gsap.set('[data-anima], [data-anima] *, [data-linha]', { clearProps: 'opacity,transform,visibility' })
  })
}

export function iniciarMovimento() {
  prepararImpressao()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  gsap.registerPlugin(ScrollTrigger, SplitText)

  const titulo = document.querySelector<HTMLElement>('[data-anima="titulo"]')
  if (titulo) {
    const partes = SplitText.create(titulo, { type: 'words' })
    gsap.from(partes.words, { opacity: 0, y: 16, duration: 0.6, ease: 'power2.out', stagger: 0.06 })
  }

  gsap.utils.toArray<HTMLElement>('[data-anima="entrada"]').forEach((el) => {
    gsap.from(el, { opacity: 0, y: 24, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } })
  })

  // As seções com content-visibility: auto (projeto e "Como trabalho") nascem
  // fora da tela sem layout de verdade. O ScrollTrigger mede com o tamanho de
  // palpite (contain-intrinsic-size) até a seção nascer visível; sem recalcular
  // depois, a marca de início fica errada para quem rolou além do palpite.
  // A trilha mede a largura do texto dividido: espera a fonte certa para não
  // quebrar linha com a métrica da fonte reserva. Se o papel chegar antes, fica estática.
  document.fonts.ready.then(() => {
    if (!imprimindo) ligarTrilha()
  })

  document.querySelectorAll<HTMLElement>('.projeto, #como-trabalho').forEach((el) => {
    // O TypeScript ainda não lista este evento em HTMLElementEventMap, daí o tipo
    // genérico aqui e o cast dentro: o evento em si existe e roda (checado no e2e).
    el.addEventListener('contentvisibilityautostatechange', (e: Event) => {
      if (!(e as ContentVisibilityAutoStateChangeEvent).skipped) ScrollTrigger.refresh()
    })
  })

  // As linhas da árvore entram na primeira vez que a aba Estrutura aparece, e as
  // de uma pasta, quando ela abre. Os eventos vêm do interacoes.ts.
  const linhas = (raiz: Element) => [...raiz.querySelectorAll<HTMLElement>('[data-linha]')].filter((el) => el.checkVisibility())
  const entrar = (els: HTMLElement[]) => {
    if (imprimindo || !els.length) return
    // fromTo, e não from: abrir e fechar a pasta no meio da entrada faria o from
    // partir do valor pela metade e deixar a linha apagada para sempre.
    gsap.fromTo(els, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: 0.25, ease: 'power1.out', stagger: 0.035, overwrite: true, clearProps: 'opacity,transform' })
  }
  document.addEventListener('painel:mostrado', (e) => {
    const painel = e.target as HTMLElement
    if (painel.dataset.painel !== 'estrutura' || painel.dataset.animado !== undefined) return
    painel.dataset.animado = ''
    entrar(linhas(painel))
  })
  document.addEventListener('pasta:aberta', (e) => entrar(linhas(e.target as HTMLElement)))
}
