# 0003. Conteúdo nasce visível

## Contexto

Um padrão comum de animação de entrada esconde o elemento no CSS (por
exemplo `opacity: 0`) e deixa o script revelar depois. Quando o script não
carrega, por falha de rede, bloqueio de terceiro ou qualquer outro motivo, o
conteúdo escondido nunca aparece, e quem navega vê uma página em branco sem
nenhum erro visível.

## Decisão

Nenhuma folha de estilo deste site esconde elemento algum à espera de
script. Todo o conteúdo já nasce visível no HTML. É o GSAP, depois de
carregado, que aplica em tempo de execução o estado inicial da animação
(esconder e só então revelar). Com `prefers-reduced-motion: reduce`, toda
animação é desligada: o script de animação nem é baixado, e só as
interações (abas e pastas) carregam. O PDF é gerado com movimento reduzido,
então também não carrega o GSAP.

## Consequências

A transição de entrada de uma seção só existe enquanto o script de animação
está no ar; qualquer efeito novo de entrada precisa seguir o mesmo caminho,
aplicando o estado inicial via script, nunca via folha de estilo fixa.

## Como falharia sem avisar

Se um componente novo usar `opacity-0` direto na marcação ou no CSS,
apostando que o GSAP sempre vai revelar depois, uma falha no carregamento do
script deixaria aquele trecho da página permanentemente invisível, sem
nenhum erro no console que aponte a causa.
