import { readFileSync } from 'node:fs'

// Leitura dos workflows como texto, sem parser de YAML, compartilhada pelos
// testes de workflow. Cada job é isolado pelo nome, e cada passo pelo hífen da
// lista de steps, para que uma variável definida num passo não seja confundida
// com outra definida no job inteiro.

// O checkout no Windows pode trazer CRLF; sem normalizar, nenhum job seria achado.
export const ler = (caminho: string) => readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n')

export function blocoDoJob(yaml: string, nomeDoJob: string): string {
  const linhas = yaml.split('\n')
  const inicio = linhas.indexOf(`  ${nomeDoJob}:`)
  if (inicio < 0) throw new Error(`job "${nomeDoJob}" não encontrado no workflow`)
  let fim = linhas.length
  for (let i = inicio + 1; i < linhas.length; i++) {
    if (/^ {2}\S.*:$/.test(linhas[i])) {
      fim = i
      break
    }
  }
  return linhas.slice(inicio, fim).join('\n')
}

export function nomesDosJobs(yaml: string): string[] {
  const jobs = yaml.split('\n').indexOf('jobs:')
  return yaml
    .split('\n')
    .slice(jobs + 1)
    .flatMap((l) => /^ {2}([\w-]+):$/.exec(l)?.[1] ?? [])
}

// Tudo do job antes de "steps:": é onde fica o env do job inteiro.
export function cabecaDoJob(bloco: string): string {
  return bloco.split('    steps:')[0]
}

export function passosDoJob(bloco: string): string[] {
  const corpo = bloco.split('    steps:')[1] ?? ''
  return corpo
    .split(/\n(?= {6}- )/)
    .map((p) => p.trim())
    .filter((p) => p.startsWith('- '))
}
