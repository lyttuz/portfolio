# 0006. Segurança de site estático

## Contexto

O site não tem servidor próprio: é HTML, CSS e JavaScript no GitHub Pages. A
superfície de ataque é o que chega ao navegador, o repositório público e os
workflows que montam e publicam o site. O GitHub Pages não deixa definir
cabeçalho HTTP, então nenhuma política de segurança pode ir por cabeçalho.

## Decisão

- **CSP por `<meta http-equiv>`**, montada no build por
  `src/seguranca/csp.ts`: tudo só do próprio site (`'self'`), sem
  `'unsafe-inline'` nem `'unsafe-eval'`, `object-src 'none'`,
  `form-action 'none'` e `upgrade-insecure-requests`. A origem de ingestão
  do Sentry entra no `connect-src` só quando a DSN existe no build, derivada
  dela.
- **Nada inline no HTML.** O Astro está configurado para nunca embutir a
  folha de estilo (`build.inlineStylesheets: 'never'`) e o Vite para nunca
  embutir arquivo como `data:` (`assetsInlineLimit: 0`). Os scripts saem
  como módulo externo. O GSAP e o SplitText mexem no estilo pelo CSSOM
  (`element.style`), que o `style-src 'self'` permite.
- **Segredo fora do que é publicado.** O secretlint varre o repositório e o
  `dist/`; um teste lê o build atrás de padrões de token e de valores de
  variável de ambiente. A única variável que chega ao navegador é
  `PUBLIC_SENTRY_DSN`, que é pública por natureza.
- **Workflows travados.** Permissão mínima, segredo só no passo que o usa,
  toda ação fixada pelo SHA do commit, checkout sem guardar o token, e
  `npm audit` das dependências de produção reprovando o PR. A lista da
  trava (`BLOQUEIO`) só existe num job sem `npm ci`, porque build, testes e
  PDF rodam código de dependência; o PDF exporta o texto para esse job
  conferir.
- **DSN validada.** O host da DSN vai cru para a política, então só passa
  host com letras, números, ponto, hífen e porta, terminado em `.sentry.io`.
  DSN fora disso derruba o build.

## Consequências

`frame-ancestors`, `report-uri` e `sandbox` não valem em `<meta>`, então o
site pode ser embutido num `<iframe>` de terceiro e nenhuma violação é
reportada a lugar nenhum. Num site sem formulário, sem login e sem dado do
visitante, o risco de clickjacking é baixo, e fica aceito.

`'self'` é a origem inteira `https://lyttuz.github.io`, e não só o caminho
`/portfolio/`: as páginas de outros repositórios da mesma conta no GitHub
Pages têm a mesma origem, e um script publicado em qualquer uma delas
passaria pela política. Fica aceito: os outros repositórios da conta são do
mesmo dono, e um domínio próprio para este site é o caminho se isso mudar.

O secretlint e o teste do build reconhecem token pelo formato do prefixo.
Token em formato UUID (como o do Codecov) não tem prefixo e passa pelos
dois. A proteção de envio do GitHub (push protection) compensa em parte,
para os provedores que ela conhece.

Qualquer `<style>`, atributo `style=""` ou `<script>` inline novo deixa de
funcionar no navegador. Biblioteca nova que injete estilo ou use `eval`
precisa de outra solução, não de afrouxar a política.

## Como falharia sem avisar

Uma violação de CSP não derruba a página: o navegador só recusa o recurso e
escreve no console. Um estilo inline que o Astro passasse a gerar sumiria do
site sem erro. Por isso o e2e (`testes/e2e/seguranca.spec.ts`) escuta o
evento `securitypolicyviolation` e o console em cada modo (com e sem
JavaScript, movimento reduzido, impressão, PDF e Sentry ligado), e começa
provando que a escuta pega uma violação provocada de propósito. O
`gerar-pdf.mjs` também recusa gerar o PDF se o console acusar a CSP.

A outra falha silenciosa é a CSP com DSN: um `connect-src` sem o host do
Sentry bloquearia todo envio de erro, e o site pareceria só não ter erro
nenhum. O e2e da build com DSN falsa manda um erro de verdade e confere que
o pedido sai.
