# 0001. Conteúdo em módulo TypeScript

## Contexto

A ideia original era manter o texto de cada projeto separado do leiaute, num
arquivo de conteúdo próprio, para trocar uma frase sem mexer em componente.
No momento da construção, a versão do Astro em uso era recente o bastante
para que a superfície de API de coleções de conteúdo ainda não estivesse
mapeada com segurança.

## Decisão

O conteúdo do perfil e dos projetos vive em módulos TypeScript tipados
(`src/conteudo/perfil.ts`, `src/conteudo/projetos.ts`,
`src/conteudo/tipos.ts`), e não em arquivo de conteúdo separado. O objetivo
original se mantém: o texto continua numa fronteira própria, fora do
componente que desenha a página. Só o formato dessa fronteira muda, de
arquivo de conteúdo para módulo de código.

## Consequências

Trocar um texto passa a exigir editar um arquivo `.ts` em vez de um arquivo
de conteúdo mais simples. Em troca, o conteúdo ganha checagem de tipo em
tempo de build: um campo faltando ou do tipo errado quebra a checagem de
tipos, em vez de aparecer em branco na página sem nenhum aviso.

## Como falharia sem avisar

Se alguém criar, mais adiante, um arquivo de conteúdo solto ao lado dos
módulos `.ts` achando que está "terminando a migração" para o formato
original, o site continua lendo só o módulo `.ts`. O arquivo novo fica ali,
sem erro de build e sem efeito nenhum na página publicada.
