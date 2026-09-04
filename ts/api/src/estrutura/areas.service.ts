import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ListarEstruturaQuery } from './dto/listar-estrutura.query';
import type { EstruturaComContagem } from './estrutura.mapper';
import {
  EstruturaService,
  type CopyEstrutura,
  type DadosAtualizacaoEstrutura,
  type DadosCriacaoEstrutura,
  type EstruturaResumo,
  type RepositorioEstrutura,
} from './estrutura.service';

/**
 * Áreas da organização — a aba Estrutura › Áreas.
 *
 * Área responde ONDE a pessoa está alocada. Toda a regra está em
 * `EstruturaService`; aqui ficam só o acesso ao delegate `prisma.area` e a
 * cópia no feminino.
 */
@Injectable()
export class AreasService extends EstruturaService {
  protected readonly repo: RepositorioEstrutura;

  protected readonly copy: CopyEstrutura = {
    naoEncontrado: 'Área não encontrada.',
    nomeDuplicado: 'Já existe uma área com este nome.',
    nomeDuplicadoInativo:
      'Já existe uma área inativa com este nome. Reative-a em vez de criar outra.',
    emUso: (membros) =>
      `${membros} ${membros === 1 ? 'membro está' : 'membros estão'} nesta área. Desative-a em vez de excluir: o vínculo de quem já está nela é preservado.`,
  };

  constructor(private readonly prisma: PrismaService) {
    super();
    const prismaService = prisma;

    this.repo = {
      // `findFirst` com empresaId no where, e não `findUnique` pelo id: o id
      // sozinho não pode ser suficiente para alcançar a área de outra empresa.
      buscar: (empresaId, id): Promise<EstruturaComContagem | null> =>
        prismaService.area.findFirst({
          where: { id, empresaId },
          include: INCLUDE_CONTAGEM,
        }),

      buscarPorNome: (empresaId, nome): Promise<EstruturaResumo | null> =>
        prismaService.area.findFirst({
          where: { empresaId, nome: { equals: nome, mode: 'insensitive' } },
          select: { id: true, nome: true, status: true },
        }),

      listar: (empresaId, filtro): Promise<EstruturaComContagem[]> =>
        prismaService.area.findMany({
          where: whereListagem(empresaId, filtro),
          include: INCLUDE_CONTAGEM,
          orderBy: ORDER_BY,
        }),

      criar: (dados: DadosCriacaoEstrutura): Promise<EstruturaComContagem> =>
        prismaService.area.create({
          data: dados,
          include: INCLUDE_CONTAGEM,
        }),

      atualizar: (
        id,
        dados: DadosAtualizacaoEstrutura,
      ): Promise<EstruturaComContagem> =>
        prismaService.area.update({
          where: { id },
          data: dados,
          include: INCLUDE_CONTAGEM,
        }),

      excluir: async (id): Promise<void> => {
        await prismaService.area.delete({ where: { id } });
      },

      contarMembros: (empresaId, areaId): Promise<number> =>
        prismaService.membro.count({ where: { empresaId, areaId } }),
    };
  }
}

/**
 * A contagem de membros é sempre derivada — não existe coluna de contador,
 * que divergiria na primeira edição de membro feita por outro caminho.
 */
const INCLUDE_CONTAGEM = {
  _count: { select: { membros: true } },
} satisfies Prisma.AreaInclude;

/** Ativas primeiro (a ordem do enum garante), alfabético dentro de cada grupo. */
const ORDER_BY = [
  { status: 'asc' },
  { nome: 'asc' },
] satisfies Prisma.AreaOrderByWithRelationInput[];

function whereListagem(
  empresaId: string,
  filtro: ListarEstruturaQuery,
): Prisma.AreaWhereInput {
  const where: Prisma.AreaWhereInput = { empresaId };
  if (filtro.status) where.status = filtro.status;

  const q = filtro.q?.trim();
  if (q) {
    where.OR = [
      { nome: { contains: q, mode: 'insensitive' } },
      { descricao: { contains: q, mode: 'insensitive' } },
    ];
  }
  return where;
}
