import type { Perfil } from './tipos'

export const perfil: Perfil = {
  nome: 'Gabriel Alves',
  titulo: 'Processos e automação com IA',
  chamada: 'O que a sua equipe leva horas, às vezes dias, para fazer à mão, a IA faz em minutos. Eu construo essas ferramentas para o time gastar o tempo no que realmente exige gente.',
  local: 'Teresina, PI',
  email: 'lyttuz@gmail.com',
  linkedin: 'https://www.linkedin.com/in/gabriel-alves-25021a303',
  sobre:
    'Muita equipe perde o dia digitando o mesmo dado em vários lugares, conferindo documento à mão e refazendo o que deu errado na cópia. ' +
    'Eu mapeio essa rotina com quem executa e construo a ferramenta com IA que faz essa parte, para o time render mais no mesmo expediente. ' +
    'Hoje faço isso num escritório de advocacia, da geração de documentos ao protocolo judicial, este ainda em construção. ' +
    'Venho de administração e RH e curso Psicologia, e desenho o sistema a partir de como as pessoas trabalham de verdade.',
  etapas: [
    { titulo: 'Mapeio', texto: 'Acompanho a tarefa com quem faz e anoto cada passo.' },
    { titulo: 'Especifico', texto: 'Defino o que a ferramenta precisa fazer antes do código.' },
    { titulo: 'Construo', texto: 'Automatizo com IA o processo real da equipe.' },
    { titulo: 'Testo', texto: 'Testes automáticos conferem cada regra.' },
    { titulo: 'Documento', texto: 'Registro como funciona e como manter.' },
  ],
}
