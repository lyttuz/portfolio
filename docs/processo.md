# Processo

Todo trabalho neste repositório nasce como issue, ganha uma branch própria e
entra na `main` por pull request. A `main` será protegida na publicação:
ninguém envia direto para ela, e um PR só entra depois de todas as
checagens passarem.

## Fluxo

1. **Issue.** Abrir uma issue com o modelo Tarefa ou Defeito. Toda mudança de
   arquitetura fica sinalizada já na issue, no campo "Muda arquitetura?".
2. **Branch.** Criar uma branch a partir da `main` para o trabalho da issue.
3. **Pull request.** Abrir o PR para a `main`, com `Closes #N` no topo do
   corpo, apontando para a issue. Sem essa linha, uma checagem automática
   reprova o PR.
4. **Checagens.** O PR só entra com todas estas checagens verdes:
   - `lint`: Biome.
   - `tipos`: `astro check`.
   - `testes`: `npm audit` das dependências de produção (reprova com
     vulnerabilidade alta ou crítica) e Vitest, com cobertura enviada ao
     Codecov.
   - `mutacao`: Stryker, sobre o código da trava contra vazamento.
   - `e2e`: Playwright de ponta a ponta, com checagem de acessibilidade
     (axe).
   - `lighthouse`: desempenho, acessibilidade, boas práticas e SEO.
   - `trava`: a checagem contra vazamento, sobre o repositório inteiro.
   - `segredos`: o secretlint, sobre os arquivos do repositório e sobre o
     site montado.
   - `verificar` (workflow `pr-com-issue`): a verificação de que o PR cita
     uma issue.
   - `analisar` (workflow `codeql`): CodeQL, como checagem de segurança.
5. **Revisão.** O modelo de PR traz um checklist: critério de aceite
   atendido, testes novos ou atualizados, `npm run tudo` rodado localmente,
   ADR criado ou atualizado quando o PR muda arquitetura, nenhuma frase
   afirmando o que o sistema não faz, e nenhum dado pessoal novo enviado a
   terceiros.
6. **Merge e publicação.** Depois do merge, o envio à `main` dispara a
   publicação: as mesmas etapas do `npm run tudo` rodam de novo, uma por
   passo e sem a DSN do Sentry; no fim, o site é montado outra vez com a DSN,
   ganha o PDF e passa pelo teste do build e pelo secretlint. Em seguida o
   job `trava` confere o repositório, o artefato exato que vai ao Pages e o
   texto do PDF, e só então o site sobe ao GitHub Pages.

A lista da trava (`BLOQUEIO`) só chega ao job `trava`, que não roda `npm ci`:
build, testes e PDF executam código de dependência, e esse código nunca
divide o job com a lista. Nos outros jobs o PDF sai com
`npm run pdf -- --exportar-texto saida/pdf-texto.txt`, que não lê a lista e
entrega o texto ao `trava` por artefato. Localmente, `npm run pdf` sem a
opção continua lendo a lista e falhando fechado.

PR vindo de um fork não recebe segredo nenhum deste repositório, por regra do
GitHub. Por isso a checagem `trava` falha nesse PR (lista vazia derruba a
trava), por desenho, não por defeito. Este repositório tem um único
mantenedor, e PR de fork não é um caso esperado na prática.

PR do Dependabot também não recebe os segredos comuns. Nele, o job `trava`
fica de fora (`if: github.actor != 'dependabot[bot]'`) e o envio ao Codecov
não reprova sem o token; a trava roda de novo no `publicar`, depois do merge
e antes de publicar. `BLOQUEIO` nunca deve ser cadastrado nos segredos do
Dependabot: lá ele chegaria a todo PR de atualização, que é justamente
código de dependência novo.

Aceito: o passo do Codecov só reprova quando `CODECOV_TOKEN` existe. Sem o
token (PR do Dependabot, PR de fork, ou o segredo apagado por engano), o
envio da cobertura pode falhar e o job `testes` continua verde. Os pisos de
cobertura do `vitest.config.ts` seguem reprovando o job do mesmo jeito; o
que se perde é só o relatório no Codecov. Se o relatório parar de aparecer
nos PRs, a primeira coisa a conferir é se o segredo ainda existe.

## Pré-requisito antes de configurar o DSN do Sentry

Antes de criar a variável `vars.PUBLIC_SENTRY_DSN` neste repositório, ligar
no projeto do Sentry, em Security & Privacy, a opção "Prevent Storing of IP
Addresses" e a regra de scrubbing de dado do lado do servidor. O SDK no
navegador não manda IP, mas o servidor do Sentry registra o IP de quem
envia o evento na ingestão por padrão, e só a configuração do projeto evita
isso (ver `docs/adr/0005-observabilidade-so-sentry.md`). Até essas duas
opções estarem ligadas, a variável não deve existir: criá-la antes deixaria
o aviso de privacidade do rodapé ("sem dados pessoais") falso.

No mesmo lugar, em Allowed Domains, deixar só `lyttuz.github.io`: a DSN é
pública dentro do JavaScript do site, e sem essa restrição qualquer página
poderia mandar evento para o projeto. E o projeto fica numa organização
pessoal do Sentry, nunca numa organização de trabalho: o site é pessoal, e
os eventos dele não devem cair onde outra equipe enxerga.

## Segurança

Como reportar uma vulnerabilidade está em `SECURITY.md`. A decisão por trás
das defesas do site está em `docs/adr/0006-seguranca-de-site-estatico.md`.

Nenhuma das configurações abaixo vem do código, e desligar qualquer uma não
quebra checagem nenhuma: conferir à mão antes de o repositório ficar
público, e de novo de tempos em tempos.

No repositório, em Settings, Code security:

- **Secret scanning** com **push protection**: o GitHub recusa o envio que
  contiver um token conhecido, antes de ele entrar no histórico.
- **Dependabot alerts** e **Dependabot security updates**: avisos de
  vulnerabilidade nas dependências e PR de correção. As atualizações de
  versão semanais vêm do `.github/dependabot.yml`, para npm e para as
  ações do GitHub (que estão fixadas por SHA; o Dependabot atualiza o SHA e
  o comentário com a tag juntos).
- **Private vulnerability reporting**: o canal que o `SECURITY.md` indica.
- **CodeQL**: pelo workflow `codeql.yml`, já no repositório, sobre o código
  e sobre os próprios workflows; o resultado aparece em Security, Code
  scanning.

No repositório, nas outras seções de Settings:

- **Branches**: regra de proteção da `main`, sem envio direto, exigindo PR e
  as checagens da lista do Fluxo como obrigatórias.
- **Environments**, `github-pages`: implantação só a partir da `main`.
- **Actions, General**: Workflow permissions em **Read repository contents
  and packages permissions**; **Allow GitHub Actions to create and approve
  pull requests** desligado; e, em fork pull request workflows, **Require
  approval for all outside contributors**.
- **Pages**: **Enforce HTTPS** ligado.

Na conta, em Settings, Emails, **antes** de o repositório ficar público e
antes de qualquer merge pela interface web: **Keep my email addresses
private** ligado, e conferir que o e-mail usado nas operações pela web
(merge de PR, edição de arquivo no site) é o endereço `noreply` do GitHub.
Sem isso, o commit de merge criado pelo GitHub leva o e-mail principal da
conta. Essa opção vale só para o que o GitHub grava em nome da conta: os
commits feitos na máquina continuam com o autor do `git config` deste
repositório, `Gabriel Alves <lyttuz@gmail.com>`, que é o contato público do
próprio site. Por isso a opção "Block command line pushes that expose my
email" fica desligada: com `lyttuz@gmail.com` cadastrado na conta, ela
recusaria todo envio deste repositório.

Limite conhecido: o GitHub Pages não deixa definir cabeçalho HTTP. A CSP vai
por `<meta http-equiv>`, e nessa forma o navegador ignora `frame-ancestors`
(o site pode ser embutido num `<iframe>` de terceiro), `report-uri` e
`sandbox`. Também não há HSTS próprio nem `X-Content-Type-Options`; o que
houver vem da configuração padrão do GitHub Pages.

## Publicação do repositório

O repositório público nasce de uma cópia limpa, nunca da pasta de trabalho:
o histórico de trabalho tem commits e metadados que a trava acusa (as duas
entradas virtuais de histórico), e apagar isso depois não tira o que já
foi enviado.

1. Criar uma pasta nova, fora desta, por exemplo `../portfolio-publico`.
2. Exportar para ela a árvore do `HEAD`, sem histórico:
   `git archive --format=tar HEAD | tar -x -C ../portfolio-publico`.
3. Nela: `git init -b main`, e configurar o autor só nesse repositório:
   `git config user.name "Gabriel Alves"` e
   `git config user.email lyttuz@gmail.com`.
4. Copiar para ela a lista local (`bloqueio.local.txt`, que o `.gitignore`
   continua ignorando lá; conferir com `git status --ignored` que ela não
   entra no commit).
5. Um commit inicial só, com tudo.
6. Rodar lá `npm ci --ignore-scripts`, ligar o gancho com
   `git config core.hooksPath .githooks` e rodar `npm run trava:repo`;
   seguir só com saída 0. O `--ignore-scripts` é o mesmo do CI: esta é a
   máquina que guarda a lista, e sem ele cada dependência rodaria o próprio
   script de instalação nela. Por isso o gancho é ligado à mão: o `prepare`
   do `package.json`, que faria isso, também é um script que não roda.
7. Criar o repositório no GitHub **vazio**: sem README, sem licença e sem
   `.gitignore`. Qualquer um desses viraria um commit do lado de lá, fora da
   trava, e o primeiro envio já teria de mesclar histórico.
8. Adicionar o remoto e enviar **só a `main` desse repositório novo**.

Daí em diante, o trabalho continua na pasta nova, com o fluxo de issue,
branch e PR deste documento. A pasta de trabalho antiga fica só como
arquivo: nunca enviar a partir dela, e nunca usar `--no-verify`, que pula o
gancho de `pre-push`, a última trava antes do GitHub.

## Decisões de arquitetura

Mudança de arquitetura ganha um ADR em `docs/adr/`, no formato Contexto,
Decisão, Consequências e Como falharia sem avisar. O índice fica em
`docs/adr/README.md`.
