// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // O test runner do vitest (@stryker-mutator/vitest-runner) foi publicado
  // três semanas antes do vitest 5 existir, e o mecanismo dele de ativar o
  // mutante por teste (via beforeAll + inject) não chega ao worker sob o
  // vitest 5: quase todo mutante "sobrevivia" mesmo quando o teste cobria a
  // linha. O command runner ativa o mutante por variável de ambiente, que é
  // o mesmo caminho que o próprio código instrumentado já lê como reserva, e
  // não depende do inject do vitest.
  testRunner: 'command',
  commandRunner: { command: 'npx vitest run testes/unidade/trava.test.mjs testes/unidade/varrer.test.mjs' },
  coverageAnalysis: 'off',
  // Só a trava é mutada: é o único código com lógica de decisão testada em
  // unidade hoje. O conteúdo (src/conteudo) é dado, não decisão.
  mutate: ['scripts/trava/nucleo.mjs', 'scripts/trava/varrer.mjs'],
  reporters: ['clear-text', 'progress', 'html', 'json'],
  htmlReporter: { fileName: 'saida/mutacao/mutacao.html' },
  jsonReporter: { fileName: 'saida/mutacao/mutacao.json' },
  thresholds: { high: 90, low: 80, break: 80 },
  tempDirName: '.stryker-tmp',
  // O comando roda `npx vitest run` do zero a cada mutante (não reaproveita
  // processo, ao contrário do test runner do vitest). Com a concorrência
  // padrão (n-1 núcleos, 11 nesta máquina), tantos `npx`+vitest ao mesmo
  // tempo disputam CPU entre si e estouram o timeout por contenção, não por
  // causa da mutação em si: um teste isolado deste comando leva uns 4s, e
  // ainda assim a maioria dos mutantes aparecia como "timeout" com 11
  // processos concorrentes. Reduzida para 4 e o timeout alargado para isso
  // não acontecer mais.
  concurrency: 4,
  timeoutMS: 20000,
  timeoutFactor: 3,
  // O que é mutado aqui é .mjs puro, sem tipo. Aponta para um tsconfig que não
  // existe de propósito: sem isso, o Stryker tenta reescrever o tsconfig.json
  // real da raiz para a sandbox, e essa etapa chama uma função do TypeScript
  // clássico (`ts.parseConfigFileTextToJson`) que o TypeScript 7 não tem
  // mais, derrubando o processo inteiro antes de mutar qualquer coisa. O
  // package.json fixa o TypeScript em ^6, mas o desvio continua para a troca
  // de versão não quebrar a mutação sem aviso.
  tsconfigFile: '.stryker-sem-tsconfig.json',
}
