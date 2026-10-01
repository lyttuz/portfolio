// Abas do "Por dentro" e pastas do editor. O HTML nasce com os painéis
// empilhados e a árvore toda aberta; este script só liga o comportamento. Se ele
// não carregar, nada fica escondido.
//
// Avisa o movimento.ts por eventos, sem depender dele:
//   'painel:mostrado' no painel que acabou de aparecer;
//   'pasta:aberta' na lista filha que acabou de abrir.
// Nenhum dos dois é disparado ao preparar a impressão.

type Estado = { abas: Map<HTMLElement, HTMLElement>; pastas: Map<HTMLButtonElement, string | null> }

function lista(botao: HTMLButtonElement) {
  return document.getElementById(botao.getAttribute('aria-controls') ?? '')
}

function marcarPasta(botao: HTMLButtonElement, aberta: boolean) {
  botao.setAttribute('aria-expanded', String(aberta))
  const ul = lista(botao)
  if (ul) ul.hidden = !aberta
}

function selecionar(abas: HTMLElement[], alvo: HTMLElement, avisar: boolean) {
  for (const aba of abas) {
    const ativa = aba === alvo
    aba.setAttribute('aria-selected', String(ativa))
    aba.tabIndex = ativa ? 0 : -1
    const painel = document.getElementById(aba.getAttribute('aria-controls') ?? '')
    if (!painel) continue
    painel.hidden = !ativa
    if (ativa && avisar) painel.dispatchEvent(new CustomEvent('painel:mostrado', { bubbles: true }))
  }
}

// Os papéis de ARIA tabs só existem com o script: o HTML nasce como seções
// comuns, cada uma com o seu h3, e é aqui que vira tablist, tab e tabpanel.
function ligarAbas(grupo: HTMLElement, estado: Estado) {
  const tablist = grupo.querySelector<HTMLElement>('[data-lista-abas]')
  if (!tablist) return
  const abas = [...tablist.querySelectorAll<HTMLElement>('[data-aba]')]
  if (!abas.length) return
  tablist.setAttribute('role', 'tablist')
  const rotulo = grupo.querySelector<HTMLElement>('[data-por-dentro]')
  if (rotulo) tablist.setAttribute('aria-labelledby', rotulo.id)
  for (const aba of abas) {
    aba.setAttribute('role', 'tab')
    const painel = grupo.querySelector<HTMLElement>(`[data-painel="${aba.dataset.aba}"]`)
    if (!painel) continue
    aba.setAttribute('aria-controls', painel.id)
    painel.setAttribute('role', 'tabpanel')
    painel.setAttribute('aria-labelledby', aba.id)
    painel.tabIndex = 0
    painel.querySelector('.painel-titulo')?.classList.add('sr-only')
  }
  tablist.hidden = false
  selecionar(abas, abas[0], false)
  estado.abas.set(grupo, abas[0])

  const ir = (alvo: HTMLElement) => {
    selecionar(abas, alvo, true)
    estado.abas.set(grupo, alvo)
    alvo.focus()
  }
  tablist.addEventListener('click', (e) => {
    const aba = (e.target as HTMLElement).closest<HTMLElement>('[role="tab"]')
    if (aba && aba.getAttribute('aria-selected') !== 'true') ir(aba)
  })
  tablist.addEventListener('keydown', (e) => {
    const atual = abas.indexOf(document.activeElement as HTMLElement)
    if (atual < 0) return
    const n = abas.length
    const destino = ({ ArrowRight: (atual + 1) % n, ArrowLeft: (atual - 1 + n) % n, Home: 0, End: n - 1 } as Record<string, number>)[e.key]
    if (destino === undefined) return
    e.preventDefault()
    ir(abas[destino])
  })
}

function ligarPastas(editor: HTMLElement) {
  const botoes = [...editor.querySelectorAll<HTMLButtonElement>('button[data-pasta]')]
  // A raiz e a primeira pasta de primeiro nível com filhos começam abertas.
  const raiz = botoes[0]
  const primeira = botoes.find((b) => b !== raiz && b.closest('ul')?.id === raiz?.getAttribute('aria-controls'))
  for (const b of botoes) marcarPasta(b, b === raiz || b === primeira)
  editor.dataset.vivo = ''
  // Botão já responde a Enter e Espaço com click; não precisa de keydown próprio.
  editor.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-pasta]')
    if (!b) return
    const abrir = b.getAttribute('aria-expanded') !== 'true'
    marcarPasta(b, abrir)
    if (abrir) lista(b)?.dispatchEvent(new CustomEvent('pasta:aberta', { bubbles: true }))
  })
}

// No papel vai tudo: todos os painéis com título, todas as pastas abertas.
// Depois da impressão, a tela volta ao estado em que estava.
function prepararImpressao(estado: Estado) {
  window.addEventListener('beforeprint', () => {
    estado.pastas.clear()
    document.querySelectorAll<HTMLButtonElement>('[data-editor] button[data-pasta]').forEach((b) => {
      estado.pastas.set(b, b.getAttribute('aria-expanded'))
      marcarPasta(b, true)
    })
    document.querySelectorAll<HTMLElement>('[data-abas] [data-painel]').forEach((p) => {
      p.hidden = false
    })
  })
  window.addEventListener('afterprint', () => {
    for (const [b, valor] of estado.pastas) marcarPasta(b, valor === 'true')
    estado.pastas.clear()
    for (const [grupo, aba] of estado.abas) {
      selecionar([...grupo.querySelectorAll<HTMLElement>('[role="tab"]')], aba, false)
    }
  })
}

export function iniciarInteracoes(): void {
  const estado: Estado = { abas: new Map(), pastas: new Map() }
  document.querySelectorAll<HTMLElement>('[data-editor]').forEach(ligarPastas)
  document.querySelectorAll<HTMLElement>('[data-abas]').forEach((g) => {
    ligarAbas(g, estado)
  })
  prepararImpressao(estado)
}
