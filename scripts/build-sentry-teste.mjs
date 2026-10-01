// Builda o site de novo, com uma DSN falsa, só para o e2e exercitar o caminho
// "Sentry ligado" (chunk do SDK pedido depois do load, aviso de privacidade no
// rodapé) sem precisar de uma DSN de verdade nem arriscar vazar uma. Sai num
// diretório à parte (dist-sentry-teste/), ignorado pelo git e fora do alcance
// da trava:dist e do gerar-pdf.mjs, que trabalham só em dist/.
import { spawnSync } from 'node:child_process'
import { DSN_FALSA } from './dsn-falsa.mjs'

const resultado = spawnSync('npx', ['astro', 'build', '--outDir', 'dist-sentry-teste'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PUBLIC_SENTRY_DSN: DSN_FALSA },
})
process.exit(resultado.status ?? 1)
