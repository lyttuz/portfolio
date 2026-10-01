# 0002. Trava contra vazamento fora do repositório

## Contexto

Este repositório é público. Ele descreve, em alto nível, um trabalho feito
para terceiros, e nenhum nome de pessoa, empresa, marca, domínio ou cliente
ligado a esse trabalho pode aparecer em nenhum arquivo, em nenhum momento do
histórico. Uma lista desses termos precisa existir para uma checagem
automática comparar contra ela, mas a lista em si é o próprio material que
não pode vazar.

## Decisão

A lista de termos bloqueados não entra no repositório. Ela mora em
`bloqueio.local.txt` na máquina de quem escreve (ignorado pelo git) e no
segredo `BLOQUEIO` do repositório no GitHub. Um script varre todo o
repositório, o histórico de commits inteiro e os arquivos do resultado final
do build em `dist/` (o HTML e o que ele carrega) contra essa lista, antes de
cada publicação e antes de cada envio ao GitHub. O PDF não é varrido como
arquivo, porque sai comprimido e a busca nos bytes não acharia o termo: o
gerador confere o texto da página renderizada, antes de gerar o arquivo, e
não gera o PDF se achar algo. A trava falha fechado: lista ausente ou vazia derruba a checagem
em vez de deixar passar. A trava nunca imprime o termo encontrado, só o
arquivo e a posição do termo na lista.

## Consequências

Qualquer máquina nova ou ambiente de integração contínua sem o arquivo ou o
segredo configurado não consegue publicar nem enviar ao repositório remoto:
o primeiro comando da cadeia falha. Descobrir qual termo bateu numa
ocorrência exige abrir a lista local e contar a posição, porque a saída da
trava nunca mostra o termo em si.

## Como falharia sem avisar

Se a trava um dia passasse a "falhar aberto" (por exemplo, tratando erro de
leitura da lista como lista vazia e seguindo em frente), um segredo
esquecido no primeiro envio deste repositório passaria batido, e o nome
vazaria no próprio commit inicial, sem nenhuma mensagem indicando o
problema.
