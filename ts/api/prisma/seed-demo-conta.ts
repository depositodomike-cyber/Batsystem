/**
 * Garante uma conta compartilhada no banco (Neon/local) para o time logar.
 *
 * Idempotente: se o e-mail já existir, só atualiza a senha/hash e o nome.
 * Não apaga outras contas.
 *
 * Rodar:
 *   npx ts-node prisma/seed-demo-conta.ts
 *   # ou apontando o Neon:
 *   #   $env:DATABASE_URL = (Get-Content .env.local | …)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/** Credenciais oficiais da conta de demonstração compartilhada. */
export const DEMO_CONTA = {
  nome: "Time BeCulture",
  email: "demo@beculture.ai",
  senha: "BecultureDemo1",
  organizacao: "BeCulture Demo",
} as const;

const TRIAL_DIAS = 14;

function carregarEnvArquivo(nome: string, sobrescrever = false): void {
  const caminho = resolve(__dirname, "..", nome);
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const chave = t.slice(0, i).trim();
    let valor = t.slice(i + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (sobrescrever || process.env[chave] == null || process.env[chave] === "") {
      process.env[chave] = valor;
    }
  }
}

// Base local, depois Neon (.env.local) sobrescreve — é o banco do deploy.
carregarEnvArquivo(".env");
carregarEnvArquivo(".env.local", true);

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = DEMO_CONTA.email.toLowerCase();
  const senhaHash = await bcrypt.hash(DEMO_CONTA.senha, 10);
  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + TRIAL_DIAS);

  const host =
    process.env.DATABASE_URL?.match(/@([^/]+)\//)?.[1] ?? "(desconhecido)";
  console.log(`Banco: ${host}`);

  const existente = await prisma.usuario.findUnique({ where: { email } });

  if (existente) {
    await prisma.usuario.update({
      where: { id: existente.id },
      data: {
        nome: DEMO_CONTA.nome,
        senhaHash,
        trialStartsAt: now,
        trialEndsAt: trialEnds,
        role: "owner",
      },
    });
    console.log(`Conta atualizada: ${email}`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      data: {
        tipoPessoa: "pf",
        documento: "000.000.000-00",
        razaoSocial: DEMO_CONTA.organizacao,
        nomeFantasia: DEMO_CONTA.organizacao,
        plano: "basico",
        ciclo: "mensal",
        modulos: ["ia_pessoal"],
      },
    });

    await tx.usuario.create({
      data: {
        empresaId: empresa.id,
        nome: DEMO_CONTA.nome,
        email,
        senhaHash,
        telefone: "",
        role: "owner",
        trialStartsAt: now,
        trialEndsAt: trialEnds,
      },
    });

    const ends = new Date(now);
    ends.setDate(ends.getDate() + TRIAL_DIAS);

    await tx.assinatura.create({
      data: {
        empresaId: empresa.id,
        plano: "basico",
        ciclo: "mensal",
        modulos: ["ia_pessoal"],
        status: "trial",
        usuarios: 1,
        posicoes: 0,
        precoUsuario: 0,
        precoPosicao: 0,
        total: 0,
        sobConsulta: false,
        trialStartsAt: now,
        trialEndsAt: ends,
        configuracoes: [
          { modulo: "ia_pessoal", plano: "basico", quantidade: 1 },
        ],
      },
    });
  });

  console.log(`Conta criada: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
