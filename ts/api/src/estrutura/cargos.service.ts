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
 * Cargos da organização — a aba Estrutura › Cargos.
 *
 * Cargo responde QUAL POSIÇÃO profissional a pessoa ocupa. Não define
 * hierarquia (isso é `Membro.gestorId`) nem concede permissão (isso é Role).
 * Toda a regra está em `EstruturaService`; aqui ficam só o acesso ao delegate
 * `prisma.cargo` e a cópia no masculino.
 */
@Injectable()
export class CargosService extends EstruturaService {
  protected readonly repo: RepositorioEstrutura;

  protected readonly copy: CopyEstrutura = {
    naoEncontrado: 'Cargo não encontrado.',
    nomeDuplicado: 'Já existe um cargo com este nome.',
    nomeDuplicadoInativo:
      'Já existe um cargo inativo com este nome. Reative-o em vez de criar outro.',
    emUso: (membros) =>
      `${membros} ${membros === 1 ? 'membro ocupa' : 'membros ocupam'} este cargo. Desative-o em vez de excluir: o vínculo de quem já o ocupa é preservado.`,
  };

  constructor(private readonly prisma: PrismaService) {
    super();
    const prismaService = prisma;

    this.repo = {
      // `findFirst` com empresaId no where, e não `findUnique` pelo id: o id
      // sozinho não pode alcançar o cargo de outra empresa.
      buscar: (empresaId, id): Promise<EstruturaComContagem | null> =>
        prismaService.cargo.findFirst({
          where: { id, empresaId },
          include: INCLUDE_CONTAGEM,
        }),

      buscarPorNome: (empresaId, nome): Promise<EstruturaResumo | null> =>
        prismaService.cargo.findFirst({
          where: { empresaId, nome: { equals: nome, mode: 'insensitive' } },
          select: { id: true, nome: true, status: true },
        }),

      listar: (empresaId, filtro): Promise<EstruturaComContagem[]> =>
        prismaService.cargo.findMany({
          where: whereListagem(empresaId, filtro),
          include: INCLUDE_CONTAGEM,
          orderBy: ORDER_BY,
        }),

      criar: (dados: DadosCriacaoEstrutura): Promise<EstruturaComContagem> =>
        prismaService.cargo.create({
          data: dados,
          include: INCLUDE_CONTAGEM,
        }),

      atualizar: (
        id,
        dados: DadosAtualizacaoEstrutura,
      ): Promise<EstruturaComContagem> =>
        prismaService.cargo.update({
          where: { id },
          data: dados,
          include: INCLUDE_CONTAGEM,
        }),

      excluir: async (id): Promise<void> => {
        await prismaService.cargo.delete({ where: { id } });
      },

      contarMembros: (empresaId, cargoId): Promise<number> =>
        prismaService.membro.count({ where: { empresaId, cargoId } }),
    };
  }
}

/** Contagem sempre derivada — não existe coluna de contador. */
const INCLUDE_CONTAGEM = {
  _count: { select: { membros: true } },
} satisfies Prisma.CargoInclude;

/** Ativos primeiro (a ordem do enum garante), alfabético dentro de cada grupo. */
const ORDER_BY = [
  { status: 'asc' },
  { nome: 'asc' },
] satisfies Prisma.CargoOrderByWithRelationInput[];

function whereListagem(
  empresaId: string,
  filtro: ListarEstruturaQuery,
): Prisma.CargoWhereInput {
  const where: Prisma.CargoWhereInput = { empresaId };
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
