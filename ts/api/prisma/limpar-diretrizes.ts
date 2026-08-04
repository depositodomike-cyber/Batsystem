import { PrismaClient } from "@prisma/client";
import { ORIGEM_PROMPT_BASE } from "../src/memorias/diretrizes";

// Limpa DIRETRIZES da tabela `memorias`.
//
// Diretriz agora é regra obrigatória anexada ao system prompt de TODA chamada
// de IA (ver src/memorias/diretrizes.ts). O que já estava gravado veio de
// testes — e-mails, atas, notas soltas — e como regra global só atrapalha.
//
// Rodar:
//   npm run db:diretrizes:limpar             → apaga as diretrizes do usuário
//                                              (preserva os prompts-base de squad)
//   npm run db:diretrizes:limpar -- --seed   → apaga só os prompts-base de squad
//   npm run db:diretrizes:limpar -- --todas  → apaga tudo
//
// Sempre lista o que vai apagar antes de apagar.

const prisma = new PrismaClient();

function alvo(): { where: Record<string, unknown>; rotulo: string } {
  if (process.argv.includes("--todas")) {
    return { where: {}, rotulo: "TODAS as diretrizes" };
  }
  if (process.argv.includes("--seed")) {
    return {
      where: { origem: ORIGEM_PROMPT_BASE },
      rotulo: `apenas origem "${ORIGEM_PROMPT_BASE}" (prompts-base de squad)`,
    };
  }
  return {
    where: { origem: { not: ORIGEM_PROMPT_BASE } },
    rotulo: `diretrizes do usuário (preserva "${ORIGEM_PROMPT_BASE}")`,
  };
}

async function main(): Promise<void> {
  const { where, rotulo } = alvo();

  const alvos = await prisma.memoria.findMany({
    where,
    select: { titulo: true, origem: true, categoria: true, conteudo: true },
  });

  if (alvos.length === 0) {
    console.log(`Nada a apagar (${rotulo}).`);
    return;
  }

  const chars = alvos.reduce((a, m) => a + m.conteudo.length, 0);
  console.log(
    `A apagar: ${alvos.length} diretriz(es) · ${chars.toLocaleString("pt-BR")} caracteres — ${rotulo}`,
  );
  for (const m of alvos.slice(0, 30)) {
    console.log(`  - [${m.origem}] ${m.categoria} · ${m.titulo}`);
  }
  if (alvos.length > 30) console.log(`  … e mais ${alvos.length - 30}`);

  const { count } = await prisma.memoria.deleteMany({ where });
  console.log(`Apagadas: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
