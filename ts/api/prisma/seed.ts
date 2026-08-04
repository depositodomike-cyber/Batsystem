import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedAgent {
  id: string;
  position: string;
  reference: string;
  who: string;
  contribution: string;
  prompt: string;
  order: number;
}

interface SeedSquad {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  description: string;
  order: number;
  starterQuestions: string[];
  starterActions: string[];
  agents: SeedAgent[];
}

async function main() {
  const file = join(__dirname, "data", "squads.json");
  const squads: SeedSquad[] = JSON.parse(readFileSync(file, "utf8"));

  for (const s of squads) {
    // Squad (upsert pelo id estável do catálogo).
    await prisma.squad.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        slug: s.slug,
        title: s.title,
        icon: s.icon,
        description: s.description,
        order: s.order,
      },
      update: {
        slug: s.slug,
        title: s.title,
        icon: s.icon,
        description: s.description,
        order: s.order,
      },
    });

    // Agentes.
    for (const a of s.agents) {
      await prisma.squadAgent.upsert({
        where: { id: a.id },
        create: {
          id: a.id,
          squadId: s.id,
          position: a.position,
          reference: a.reference,
          who: a.who,
          contribution: a.contribution,
          prompt: a.prompt,
          order: a.order,
        },
        update: {
          squadId: s.id,
          position: a.position,
          reference: a.reference,
          who: a.who,
          contribution: a.contribution,
          prompt: a.prompt,
          order: a.order,
        },
      });
    }

    // Perguntas iniciais: regravadas a cada seed (não têm id estável próprio).
    await prisma.squadStarterQuestion.deleteMany({ where: { squadId: s.id } });
    await prisma.squadStarterQuestion.createMany({
      data: s.starterQuestions.map((text, order) => ({
        squadId: s.id,
        text,
        order,
      })),
    });

    // Ações executáveis: regravadas a cada seed (sem id estável próprio).
    await prisma.squadStarterAction.deleteMany({ where: { squadId: s.id } });
    await prisma.squadStarterAction.createMany({
      data: (s.starterActions ?? []).map((text, order) => ({
        squadId: s.id,
        text,
        order,
      })),
    });
  }

  const [squadCount, agentCount, questionCount, actionCount] = await Promise.all([
    prisma.squad.count(),
    prisma.squadAgent.count(),
    prisma.squadStarterQuestion.count(),
    prisma.squadStarterAction.count(),
  ]);
  console.log(
    `Seed concluído: ${squadCount} squads, ${agentCount} agentes, ${questionCount} perguntas, ${actionCount} ações.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
