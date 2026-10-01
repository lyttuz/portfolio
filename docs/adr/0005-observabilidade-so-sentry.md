# 0005. Observabilidade só Sentry

## Contexto

O site é estático, publicado no GitHub Pages: não existe servidor próprio
para monitorar. O único ponto onde algo pode falhar de um jeito que vale a
pena capturar é o JavaScript rodando no navegador de quem visita a página.

## Decisão

A única observabilidade do site é o Sentry no navegador, carregado de forma
preguiçosa, capturando só erro de JavaScript. Sem IP, sem replay de sessão,
sem contagem de sessão (a integração `BrowserSession` fica desligada), sem
breadcrumbs (a integração `Breadcrumbs` fica desligada, e o `beforeSend`
ainda apaga o campo) e sem qualquer outro dado pessoal, com aviso de privacidade no rodapé. Sem
`PUBLIC_SENTRY_DSN` configurado, o Sentry fica desligado, e o build avisa
isso em voz alta. Datadog e New Relic ficam de fora: não há servidor para
monitorar, e adicionar outra ferramenta de observabilidade de servidor não
teria o que medir.

## Pré-requisito antes de configurar o DSN

O SDK no navegador não manda IP, mas isso não é suficiente: o servidor do
Sentry registra o IP de quem envia o evento no momento em que recebe o
evento (na ingestão), por padrão, e isso é independente de qualquer opção do
SDK. Nenhuma configuração em `Sentry.init` muda esse comportamento, porque o
SDK não controla o que o servidor faz depois que o evento chega.

A única forma de desligar isso é na configuração do projeto, no próprio
Sentry: "Prevent Storing of IP Addresses", em Security & Privacy, mais a
regra de scrubbing de dado do lado do servidor. Enquanto essas duas coisas
não estiverem ligadas no projeto, `PUBLIC_SENTRY_DSN` não deve existir como
variável do repositório: criar a variável antes disso deixa a frase do
aviso de privacidade no rodapé falsa, porque o site diria "sem dados
pessoais" enquanto o servidor guarda o IP de cada visitante que gera um
erro. Com a sessão desligada, só quem gera erro manda evento, então é esse o
alcance do risco.

## Consequências

Erro de build, de rede ou de infraestrutura de publicação nunca aparece no
Sentry, porque ele só existe depois que a página já carregou no navegador.
Qualquer necessidade futura de monitorar outra camada (por exemplo, a própria
publicação) exigiria uma ferramenta diferente, fora do escopo desta decisão.

## Como falharia sem avisar

O aviso do build quando falta o DSN é o único sinal de que o Sentry está
desligado: a página continua funcionando normalmente sem ele, sem nenhum
erro visível para quem navega. Se esse aviso for ignorado ou removido do
processo de build, o site ficaria sem nenhuma captura de erro de forma
indefinida, sem ninguém perceber.
