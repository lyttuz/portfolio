// DSN com formato válido (chave@host/id), mas projeto 0 na sentry.io: mesmo se
// a interceptação de rede do teste falhar, não existe destino de verdade para
// receber o evento. Mora num módulo à parte porque o build de teste, o e2e e o
// teste do build precisam do mesmo valor.
export const DSN_FALSA = 'https://examplePublicKey@o0.ingest.sentry.io/0'
