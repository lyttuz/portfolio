// Núcleo da trava. Não imprime termo nenhum: quem chama só recebe índices.
import { existsSync, readFileSync } from 'node:fs'

export class ListaAusente extends Error {}

// Caracteres de largura zero que partiriam um termo ao meio sem aparecer na tela:
// espaço de largura zero, ligamento e desligamento de largura zero, junção de
// palavra, marca de ordem de byte e hífen suave. Removidos antes de qualquer
// outra coisa. Espaço sem quebra (NBSP) fica de fora: continua servindo de
// separador normal, como qualquer outro espaço.
// Escritos como alternância de \u, e não como classe de caracteres: o linter
// acusa classe de caracteres com ponto de código combinável (o desligamento de
// largura zero pode compor emoji) como risco de casar sequência unida por
// engano. Alternância de literais isolados não tem esse risco e casa o mesmo
// conjunto de caracteres, um por vez.
const INVISIVEIS = /(​|‌|‍|⁠|﻿|­)/g

export function normalizar(texto) {
  // NFKD, e não NFD: também dobra largura total (ａｃｍｅ) e ligadura tipográfica
  // (ﬁ) na letra comum, além de separar acento de letra.
  const limpo = texto
    .replace(INVISIVEIS, '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  return ` ${limpo} `
}

export function carregarLista({ caminho, env }) {
  const bruto = env.BLOQUEIO?.trim() ? env.BLOQUEIO : existsSync(caminho) ? readFileSync(caminho, 'utf8') : ''
  const termos = bruto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => normalizar(l).trim())
    .filter(Boolean)
  if (termos.length === 0) {
    throw new ListaAusente('lista de bloqueio ausente ou vazia: crie bloqueio.local.txt ou defina BLOQUEIO')
  }
  return termos
}

// Termo só de letras, com 6 ou mais, casa dentro de palavra (domínio, e-mail, perfil).
// O resto casa por palavra inteira, para número curto não casar dentro de hash.
function casaDentro(termo) {
  return /^\p{L}{6,}$/u.test(termo)
}

export function achar(texto, termos) {
  const n = normalizar(texto)
  const achados = []
  termos.forEach((t, i) => {
    if (casaDentro(t) ? n.includes(t) : n.includes(` ${t} `)) achados.push(i + 1)
  })
  return achados
}

export function varrerArquivos(arquivos, termos) {
  const r = []
  for (const { nome, texto } of arquivos) {
    for (const termo of new Set([...achar(nome, termos), ...achar(texto, termos)])) r.push({ nome, termo })
  }
  return r
}
