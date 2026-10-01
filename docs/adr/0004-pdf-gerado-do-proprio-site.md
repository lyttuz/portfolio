# 0004. PDF gerado do próprio site

## Contexto

O portfólio existe em dois formatos com o mesmo conteúdo: a página web e um
PDF para anexar em candidatura. Manter o texto do PDF num lugar separado do
texto da página criaria duas fontes de verdade, que se desalinham assim que
uma das duas muda e a outra não acompanha.

## Decisão

O PDF (`gabriel-alves-portfolio.pdf`) nasce do próprio site: o script de
geração sobe o site já montado, abre a página com o Playwright em modo de
impressão e imprime o resultado, com a data de geração no rodapé. Não existe
um segundo conteúdo mantido à parte para o PDF.

## Consequências

Qualquer mudança de texto ou de leiaute na página se reflete automaticamente
no PDF na próxima geração, sem passo manual de sincronização. Em troca, gerar
o PDF depende de o site estar montado e servido localmente antes: não é algo
que se produza isolado, a partir de um arquivo único de texto.

## Como falharia sem avisar

Se algum processo de build passasse a reaproveitar um PDF antigo em vez de
gerar de novo a cada publicação, a página publicada mudaria e o PDF anexado
em candidaturas continuaria mostrando a versão antiga. A única forma de
perceber seria comparar a data de geração no rodapé do PDF com a data da
publicação.
