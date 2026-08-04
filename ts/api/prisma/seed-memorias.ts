import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

// Seed de memórias a partir do "prompt base" dos squads.
// - Apaga TODAS as memórias existentes.
// - Cria uma memória AGREGADA por squad (tema = slug do squad), juntando os
//   prompts-base dos agentes daquele squad. Replica para cada empresa (tenant).
//
// Rodar: npx ts-node prisma/seed-memorias.ts   (ou npm run db:seed:memorias)

const prisma = new PrismaClient();

interface SeedAgent {
  reference: string;
  position: string;
  prompt: string;
  order: number;
}
interface SeedSquad {
  slug: string;
  title: string;
  agents: SeedAgent[];
}

async function main(): Promise<void> {
  const file = join(__dirname, "data", "squads.json");
  const squads: SeedSquad[] = JSON.parse(readFileSync(file, "utf8"));

  // 1) Apaga todas as memórias criadas (de todas as empresas).
  const apagadas = await prisma.memoria.deleteMany({});
  console.log(`Memórias apagadas: ${apagadas.count}`);

  // 2) Uma memória agregada por squad, para cada empresa.
  const empresas = await prisma.empresa.findMany({ select: { id: true } });
  let criadas = 0;

  for (const empresa of empresas) {
    for (const s of squads) {
      const agents = [...s.agents].sort((a, b) => a.order - b.order);
      const conteudo = agents
        .map((a) => `## ${a.reference} — ${a.position}\n${a.prompt}`)
        .join("\n\n---\n\n");

      await prisma.memoria.create({
        data: {
          empresaId: empresa.id,
          categoria: s.slug,
          titulo: `Prompt base — ${s.title}`,
          conteudo,
          origem: "Prompt base",
          confianca: "alta",
          ativa: true,
          corporativa: true, // definição corporativa (read-only)
        },
      });
      criadas++;
    }
  }

  console.log(
    `Empresas: ${empresas.length} · squads: ${squads.length} · memórias criadas: ${criadas}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
