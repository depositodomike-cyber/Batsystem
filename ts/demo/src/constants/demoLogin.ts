/**
 * Conta compartilhada do time — espelha `ts/api/prisma/seed-demo-conta.ts`.
 * Qualquer pessoa com a API no ar consegue entrar com estas credenciais.
 */
export const DEMO_LOGIN = {
  email: "demo@beculture.ai",
  senha: "BecultureDemo1",
  nome: "Time BeCulture",
} as const;
