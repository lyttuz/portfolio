import type { Projeto } from './tipos'

export const projetos: Projeto[] = [
  {
    id: 'escritorio',
    titulo: 'Escritório Virtual',
    subtitulo: 'Documentos jurídicos sem redigitação',
    dor: 'Contrato, petição e procuração redigidos à mão, com o mesmo dado do cliente digitado de novo em cada um.',
    oQueFaz: 'Gera o documento a partir dos dados do cliente, no padrão visual do escritório e em Word. O advogado revisa em vez de redigir do zero.',
    destaques: [
      { rotulo: 'Escala', texto: 'Trabalha em lote: atende vários clientes numa mesma rodada.' },
      { rotulo: 'Produtividade', texto: 'O dado do cliente entra uma vez e vale para todos os documentos. Some a redigitação, e com ela o erro de cópia.' },
      { rotulo: 'Também faz', texto: 'Lê contratos e aponta cláusulas de risco, organiza peças processuais com o prazo sugerido e cadastra o cliente com os documentos no lugar certo.' },
    ],
    porDentro: {
      pontos: [
        'Cada tipo de documento é um módulo independente, com instruções, modelo e casos de teste próprios. Um modelo novo entra sem mexer nos outros.',
        'Os dados do cliente são validados uma vez e alimentam todos os documentos.',
        'O documento sai em Word no padrão visual do escritório, pronto para a revisão do advogado.',
      ],
      stack: ['Python', 'Claude Code', 'Google Sheets API', 'Google Apps Script'],
      editor: { comando: 'python conversor/gerar.py procuracao --cliente exemplo', statusEsquerda: ['estrutura ilustrativa'], statusDireita: ['Python', 'UTF-8'] },
      arvore: {
        nome: 'producao-documentos/',
        filhos: [
          {
            nome: 'modelos/',
            nota: 'um módulo por tipo de documento',
            filhos: [
              {
                nome: 'procuracao/',
                filhos: [
                  { nome: 'instrucoes.md', nota: 'como a IA preenche' },
                  { nome: 'modelo.md', nota: 'texto-base com os campos' },
                  { nome: 'casos-teste.md', nota: 'entradas e saídas esperadas' },
                ],
              },
              { nome: 'contrato/' },
              { nome: 'peticao/' },
            ],
          },
          { nome: 'cadastro/', nota: 'ficha do cliente e validação' },
          { nome: 'identidade/', nota: 'fontes, margens e timbre' },
          { nome: 'conversor/', nota: 'de texto para Word' },
          { nome: 'checagens/', nota: 'ambiente e padrão do documento' },
        ],
      },
    },
  },
  {
    id: 'protocolador',
    titulo: 'Protocolador PJe',
    subtitulo: 'Protocolo judicial com o advogado no controle',
    estado: 'Em construção',
    dor: 'Protocolar no PJe é repetitivo, e um arquivo trocado ou um documento faltando custa prazo.',
    oQueFaz: 'Monta a peça, confere se a documentação está completa e conduz o protocolo, parando para o advogado aprovar antes de liberar a peça e antes de protocolar.',
    destaques: [
      { rotulo: 'Segurança', texto: 'Se alguém trocar o arquivo depois da aprovação, o sistema para. Tudo fica num histórico que ninguém consegue alterar.' },
      { rotulo: 'Confiável', texto: '195 testes automatizados cobrem as regras do fluxo.' },
    ],
    porDentro: {
      pontos: [
        'Não existe atalho: o sistema não chega ao protocolo sem as duas aprovações, e um teste prova isso.',
        'A aprovação vale para o arquivo exato que o advogado viu, identificado por uma impressão digital (SHA-256).',
        'Cada aprovação só pode ser usada uma vez, mesmo com duas execuções ao mesmo tempo.',
        'O histórico não aceita edição nem exclusão, e o CPF é mascarado antes de gravar.',
      ],
      stack: ['Python', 'SQLite'],
      editor: { comando: 'python -m protocolo.demo', statusEsquerda: ['estrutura ilustrativa'], statusDireita: ['Python', 'UTF-8'] },
      arvore: {
        nome: 'protocolo-automatizado/',
        filhos: [
          { nome: 'fluxo/', nota: 'etapas e estados do protocolo' },
          { nome: 'aprovacao/', nota: 'os dois pontos de aprovação do advogado' },
          { nome: 'montagem/', nota: 'peça a partir do modelo' },
          { nome: 'conferencia/', nota: 'documentação completa do cliente' },
          { nome: 'historico/', nota: 'registro que não pode ser alterado' },
          { nome: 'testes/', nota: 'cenários do fluxo completo' },
        ],
      },
    },
  },
  {
    id: 'noticias',
    titulo: 'Pipeline de notícias com n8n',
    subtitulo: 'Projeto próprio',
    dor: 'Manter um perfil de notícias ativo exige ler várias fontes todo dia, filtrar, escrever e criar a arte.',
    oQueFaz: 'Coleta em seis fontes oficiais, descarta repetidas, escolhe com IA o que importa para o público, escreve o post e gera a arte. O trabalho humano fica em aprovar pelo Telegram.',
    destaques: [
      { rotulo: 'Confiável', texto: 'A IA não inventa: cada número do post é conferido contra a fonte antes de seguir.' },
      { rotulo: 'Replicável', texto: 'Um perfil novo, de outro assunto, é só configuração.' },
      { rotulo: 'Custo', texto: 'Perto de US$ 0,28 por dia com a IA de redação.' },
    ],
    porDentro: {
      pontos: [
        'A IA dá a nota em seis critérios e o código faz a conta com os pesos do público, então dá para reordenar sem nova chamada.',
        'A validação contra invenção é feita em código, e não no prompt.',
        'Duplicatas saem em duas camadas: endereço e título idênticos, e depois notícias parecidas dentro da mesma janela.',
        'Dez detectores de falha silenciosa fazem o fluxo acusar erro em vez de passar como se estivesse tudo certo.',
      ],
      stack: ['n8n', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'Claude', 'Playwright', 'Caddy'],
      editor: { comando: 'npm run teste', statusEsquerda: ['main', '10 detectores'], statusDireita: ['TypeScript', 'UTF-8'] },
      arvore: {
        nome: 'n8n-noticias/',
        filhos: [
          { nome: 'workflows/', nota: 'fluxos do n8n: coleta, publicação, vigilância' },
          {
            nome: 'servico/src/',
            nota: 'serviço em TypeScript',
            filhos: [
              { nome: 'adaptadores/', nota: 'RSS, API e raspagem, no mesmo formato' },
              { nome: 'coleta/', nota: 'rodada diária e estado de cada fonte' },
              { nome: 'dedup/', nota: 'duplicatas em duas camadas' },
              { nome: 'triagem/', nota: 'nota da IA, conta do código' },
              { nome: 'redacao/', nota: 'escrita e validação contra invenção' },
              { nome: 'arte/', nota: 'cartão 1080x1350' },
              { nome: 'aprovacao/', nota: 'link de revisão pelo Telegram' },
              { nome: 'vigilancia/', nota: 'dez detectores de falha silenciosa' },
            ],
          },
          { nome: 'servico/db/', nota: 'migrações numeradas do banco' },
          { nome: 'perfis/', nota: 'público, pesos, tom e fontes de cada perfil' },
        ],
      },
    },
  },
]
