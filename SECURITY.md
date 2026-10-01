# Segurança

## Como reportar

Encontrou uma vulnerabilidade? Reporte em particular, pelo reporte privado de
vulnerabilidade do GitHub: na aba **Security** deste repositório, botão
**Report a vulnerability**. O relato fica visível só para quem mantém o
repositório até a correção sair.

Não abra issue pública nem PR para falha de segurança: os dois são visíveis
para qualquer pessoa desde o primeiro minuto.

Ajuda no relato:

- o que acontece e onde (a página, o arquivo ou o workflow);
- como reproduzir, passo a passo;
- o impacto que você enxerga.

## Escopo

Entram:

- o site publicado em `https://lyttuz.github.io/portfolio/` e o PDF que sai
  dele;
- o código deste repositório;
- os workflows do GitHub Actions em `.github/workflows/`.

Ficam de fora: a infraestrutura do GitHub Pages e do GitHub Actions, o
Sentry e o Codecov como serviços, e os perfis externos para onde o site
aponta. Falha nesses vai direto para quem os mantém.

## Tempo de resposta

Este repositório tem um mantenedor só. Todo relato é lido e respondido, mas
não há prazo fixo prometido para a resposta nem para a correção. O que for
confirmado é corrigido aqui, e quem reportou é avisado quando a correção
estiver no ar.
