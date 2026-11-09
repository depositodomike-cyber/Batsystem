/**
 * Conta compartilhada do time — espelha `ts/api/prisma/seed-demo-conta.ts`.
 * Qualquer pessoa com a API no ar consegue entrar com estas credenciais.
 */
export const DEMO_LOGIN = {
  email: "demo@oracle.ai",
  senha: "OracleDemo1",
  nome: "Time Oracle",
} as const;
