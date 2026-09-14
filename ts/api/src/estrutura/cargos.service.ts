import { Injectable } from '@nestjs/common';
import { MembroTipo, Prisma } from '@prisma/client';
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
      `${membros} ${membros === 1 ? 'colaborador ocupa' : 'colaboradores ocupam'} este cargo. Escolha para qual cargo realocá-los, ou confirme sem destino — eles ficam sem cargo.`,
    destinoNaoEncontrado: 'O cargo de destino não faz parte desta organização.',
    destinoInativo: (nome) =>
      `O cargo "${nome}" está inativo e não pode receber colaboradores. Reative-o antes de escolhê-lo como destino.`,
    destinoEhAOrigem: 'O cargo de destino não pode ser o que está saindo.',
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

      transacao: <T,>(
        fn: (db: Prisma.TransactionClient) => Promise<T>,
      ): Promise<T> => prismaService.$transaction(fn),

      atualizarEm: (
        db,
        id,
        dados: DadosAtualizacaoEstrutura,
      ): Promise<EstruturaComContagem> =>
        db.cargo.update({
          where: { id },
          data: dados,
          include: INCLUDE_CONTAGEM,
        }),

      contarMembrosEm: (db, empresaId, id): Promise<number> =>
        db.membro.count({
          where: { empresaId, cargoId: id, tipo: MembroTipo.membro },
        }),

      realocarMembros: async (
        db,
        empresaId,
        deId,
        destinoId,
      ): Promise<number> => {
        const { count } = await db.membro.updateMany({
          // O MESMO filtro da contagem, `tipo` incluído: o número que a tela
          // mostrou tem de ser o número de linhas que esta operação toca.
          where: { empresaId, cargoId: deId, tipo: MembroTipo.membro },
          // Sem destino, a coluna legada de texto sai junto. Sem isso o
          // colaborador fica com `cargoId: null` e a tela segue exibindo o
          // nome antigo, porque o rótulo no front cai no texto legado quando
          // não há entidade. É a segunda escrita do código novo nessas
          // colunas congeladas — a outra é a conversão para convidado.
          data:
            destinoId == null
              ? { cargoId: null, cargo: null }
              : { cargoId: destinoId },
        });
        return count;
      },

      excluirEm: async (db, id): Promise<void> => {
        await db.cargo.delete({ where: { id } });
      },

      contarMembros: (empresaId, cargoId): Promise<number> =>
        prismaService.membro.count({
          // `tipo` aqui pelo mesmo motivo do `INCLUDE_CONTAGEM`: é esta
          // contagem que vira a mensagem do 409, e ela tem de bater com o
          // número que a tela mostrou.
          where: { empresaId, cargoId, tipo: MembroTipo.membro },
        }),
    };
  }
}

/**
 * Contagem sempre derivada — não existe coluna de contador.
 *
 * CONVIDADOS ficam de fora. Em regime normal o filtro é inócuo (um convidado
 * nunca tem cargo — o service zera na conversão e recusa na criação), mas ele
 * existe para o dado inconsistente: sem ele, uma linha gravada por SQL
 * inflaria o número da tela.
 *
 * O MESMO filtro tem de valer nos dois lugares que contam: aqui, que alimenta a
 * listagem, e `contarMembros`, que alimenta a guarda de exclusão. Filtrar só um
 * faz o número exibido divergir do número que aparece no 409.
 */
const INCLUDE_CONTAGEM = {
  _count: { select: { membros: { where: { tipo: MembroTipo.membro } } } },
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
