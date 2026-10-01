// Ícones da stack, do pacote simple-icons (CC0). Entram no HTML na montagem,
// como SVG embutido; nada é baixado no navegador.
import { siCaddy, siClaude, siDocker, siGoogleappsscript, siGooglesheets, siN8n, siNodedotjs, siPostgresql, siPython, siSqlite, siTypescript } from 'simple-icons'

type Icone = { titulo: string; path: string }
const de = (i: { title: string; path: string }): Icone => ({ titulo: i.title, path: i.path })

// Playwright não tem ícone no pacote e fica fora: aparece só com o nome.
const mapa: Record<string, Icone> = {
  Python: de(siPython),
  n8n: de(siN8n),
  TypeScript: de(siTypescript),
  'Node.js': de(siNodedotjs),
  PostgreSQL: de(siPostgresql),
  Docker: de(siDocker),
  Claude: de(siClaude),
  'Claude Code': de(siClaude),
  Caddy: de(siCaddy),
  'Google Sheets API': de(siGooglesheets),
  'Google Apps Script': de(siGoogleappsscript),
  SQLite: de(siSqlite),
}

export function iconeDe(nome: string): Icone | null {
  return Object.hasOwn(mapa, nome) ? mapa[nome] : null
}
