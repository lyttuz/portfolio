// Tipos do conteúdo do portfólio: perfil e os três projetos.
export type NoArvore = { nome: string; nota?: string; filhos?: NoArvore[] }
/** Janela de editor da aba Estrutura: comando e status vêm do conteúdo; nos projetos do escritório, a estrutura é ilustrativa. */
export type Editor = { comando: string; statusEsquerda: string[]; statusDireita: string[] }
export type Destaque = { rotulo: string; texto: string }
export type Projeto = {
  id: string
  titulo: string
  subtitulo: string
  /** A dor que o projeto resolve, mostrada antes do oQueFaz no cartão principal. */
  dor: string
  oQueFaz: string
  destaques: Destaque[]
  porDentro: { pontos: string[]; stack: string[]; arvore: NoArvore; editor: Editor }
  /** Estado do projeto quando ainda não está pronto, por exemplo "Em construção". Ausente quando o projeto está concluído. */
  estado?: string
}
export type Perfil = {
  nome: string
  titulo: string
  /** Chamada curta no cabeçalho, logo abaixo do título. */
  chamada: string
  local: string
  email: string
  linkedin: string
  sobre: string
  /** Linha do tempo "Como trabalho": o título é o verbo, e o texto diz em uma frase o que acontece nessa etapa. */
  etapas: { titulo: string; texto: string }[]
}
