import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class SquadsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catálogo (leve): squads ativos, ordenados, sem agentes/prompts. */
  async list() {
    return this.prisma.squad.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        slug: true,
        title: true,
        icon: true,
        description: true,
      },
    });
  }

  /**
   * Detalhe de um squad: agentes ativos + perguntas iniciais.
   * O `prompt` dos agentes é propriedade do produto e fica só no servidor
   * (usado em AiService.buildSystem) — nunca é exposto na API.
   */
  async getById(id: string) {
    const squad = await this.prisma.squad.findFirst({
      where: { id, active: true },
      include: {
        agents: {
          where: { active: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            position: true,
            reference: true,
            who: true,
            contribution: true,
          },
        },
        starterQuestions: { orderBy: { order: 'asc' }, select: { text: true } },
        starterActions: { orderBy: { order: 'asc' }, select: { text: true } },
      },
    });
    if (!squad) {
      throw new NotFoundException('Squad não encontrado.');
    }

    return {
      id: squad.id,
      slug: squad.slug,
      title: squad.title,
      icon: squad.icon,
      description: squad.description,
      starterQuestions: squad.starterQuestions.map((q) => q.text),
      starterActions: squad.starterActions.map((a) => a.text),
      agents: squad.agents,
    };
  }
}
