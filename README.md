# Portfólio

Site pessoal de Gabriel Alves, com os projetos de automação e IA que ele
construiu. É um site estático em Astro, publicado no GitHub Pages, com o
mesmo conteúdo também em PDF.

## Como rodar

Requer Node 24.

```
npm install
npm run dev    # ambiente de desenvolvimento
npm run build  # gera o site em dist/
npm run tudo   # trava, segredos, lint, tipos, testes com cobertura, build,
               # trava do build, PDF, segredos do build, teste do build e
               # ponta a ponta
```

A lista completa de comandos está em `package.json`.

## Trava contra vazamento

Antes de cada build de publicação, de cada PDF e de cada envio ao
repositório remoto, um script varre o repositório e o resultado do build
contra uma lista de termos que não podem aparecer em nenhum arquivo público.
Essa lista não faz parte do repositório: ela precisa existir em
`bloqueio.local.txt`, na raiz do projeto, em cada máquina que for publicar ou
enviar código, e no segredo `BLOQUEIO` deste repositório no GitHub, para a
publicação automática. Lista ausente ou vazia derruba a checagem.

## Segurança

Como reportar uma vulnerabilidade está em `SECURITY.md`.

## Processo

O fluxo de trabalho (issue, branch, PR e checagens) está em
`docs/processo.md`. Decisões de arquitetura ficam em `docs/adr/`.
