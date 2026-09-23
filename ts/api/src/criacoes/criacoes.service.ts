import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type CriacaoStatus, type CriacaoTipo } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

// ----------------------------------------------------------------------
// Criações do AI Studio — o workspace PRIVADO de cada pessoa.
//
// A postura vem inteira de `ConversasService`, que já resolve este problema: em
// TODO método, `empresaId` e `usuarioId` entram no `where` do Prisma, e id que
// não casa devolve 404 — não 403. A diferença importa: 403 confirmaria que o
// registro existe, e a existência de uma criação de outra pessoa também é
// informação privada.
//
// Nenhuma autorização paralela: não há Role nem permissão nova aqui. Ser dono é
// o único critério, e ele mora na consulta.
// ----------------------------------------------------------------------

/** Metadados de uma criação — o que a Home precisa para desenhar a tabela. */
export interface CriacaoResumoDto {
  id: string;
  tipo: CriacaoTipo;
  status: CriacaoStatus;
  etapa: string;
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
}

/** A criação inteira, para retomar de onde parou. */
export interface CriacaoDto extends CriacaoResumoDto {
  repositorioId: string | null;
  dados: Prisma.JsonValue;
}

export interface ListarOpts {
  q?: string;
  tipo?: CriacaoTipo;
  status?: CriacaoStatus;
  limit?: number;
  /** Id da última criação da página anterior. */
  cursor?: string;
}

/** O que a listagem lê. `dados` fica de fora de propósito — ver o schema. */
const CAMPOS_RESUMO = {
  id: true,
  tipo: true,
  status: true,
  etapa: true,
  titulo: true,
  criadoEm: true,
  atualizadoEm: true,
} as const;

const LIMITE_PADRAO = 25;
const LIMITE_MAXIMO = 100;
/** Teto do documento guardado em `dados` (~1 MB de JSON já é muito). */
const LIMITE_DADOS = 1_000_000;

function resumo(row: {
  id: string;
  tipo: CriacaoTipo;
  status: CriacaoStatus;
  etapa: string;
  titulo: string;
  criadoEm: Date;
  atualizadoEm: Date;
}): CriacaoResumoDto {
  return {
    id: row.id,
    tipo: row.tipo,
    status: row.status,
    etapa: row.etapa,
    titulo: row.titulo,
    criadoEm: row.criadoEm.toISOString(),
    atualizadoEm: row.atualizadoEm.toISOString(),
  };
}

/**
 * O documento, no tipo que o Prisma aceita.
 *
 * O valor veio do corpo da requisição, ou seja, saiu de um JSON.parse — ele JÁ
 * é JSON. O `Record<string, unknown>` do DTO só não satisfaz
 * `InputJsonObject` porque `unknown` é mais largo que `InputJsonValue`; a
 * conversão não esconde nada.
 */
function comoJson(dados?: Record<string, unknown>): Prisma.InputJsonObject {
  return (dados ?? {}) as Prisma.InputJsonObject;
}

@Injectable()
export class CriacoesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * As criações do usuário, da mais recentemente mexida para a mais antiga.
   *
   * Busca, filtro e paginação acontecem DENTRO da mesma consulta escopada — e
   * não numa filtragem depois. Trazer linha de outra pessoa e descartá-la no
   * caminho é o que basta para ela vazar num log, numa contagem ou num cursor.
   *
   * A ordem é `atualizadoEm desc` com desempate por `id`: sem o segundo
   * critério, duas criações salvas no mesmo milissegundo podem aparecer duas
   * vezes (ou nenhuma) ao paginar.
   */
  async listar(
    empresaId: string,
    usuarioId: string,
    opts: ListarOpts = {},
  ): Promise<{ itens: CriacaoResumoDto[]; proximoCursor: string | null }> {
    const q = opts.q?.trim();
    const limit = Math.min(
      Math.max(opts.limit && opts.limit > 0 ? opts.limit : LIMITE_PADRAO, 1),
      LIMITE_MAXIMO,
    );

    const rows = await this.prisma.criacao.findMany({
      where: {
        empresaId,
        usuarioId,
        ...(opts.tipo ? { tipo: opts.tipo } : {}),
        ...(opts.status ? { status: opts.status } : {}),
        ...(q ? { titulo: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ atualizadoEm: 'desc' }, { id: 'desc' }],
      // Uma linha além do pedido: é ela que diz se há próxima página, sem um
      // `count` a mais.
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: CAMPOS_RESUMO,
    });

    const temMais = rows.length > limit;
    const pagina = temMais ? rows.slice(0, limit) : rows;
    return {
      itens: pagina.map(resumo),
      proximoCursor: temMais ? pagina[pagina.length - 1].id : null,
    };
  }

  /** Uma criação com o documento inteiro. 404 se não for do usuário. */
  async obter(
    empresaId: string,
    usuarioId: string,
    id: string,
  ): Promise<CriacaoDto> {
    const c = await this.prisma.criacao.findFirst({
      where: { id, empresaId, usuarioId },
    });
    if (!c) throw new NotFoundException('Criação não encontrada.');
    return {
      ...resumo(c),
      repositorioId: c.repositorioId,
      dados: c.dados,
    };
  }

  /**
   * Cria. O proprietário vem do token, nunca do corpo — é o que torna
   * impossível criar em nome de outra pessoa mesmo forjando a requisição.
   */
  async criar(
    empresaId: string,
    usuarioId: string,
    repositorioId: string | null,
    entrada: {
      tipo: CriacaoTipo;
      titulo?: string;
      status?: CriacaoStatus;
      etapa?: string;
      dados?: Record<string, unknown>;
    },
  ): Promise<CriacaoDto> {
    const c = await this.prisma.criacao.create({
      data: {
        empresaId,
        usuarioId,
        repositorioId,
        tipo: entrada.tipo,
        titulo: (entrada.titulo ?? '').trim().slice(0, 200),
        status: entrada.status ?? 'rascunho',
        etapa: (entrada.etapa ?? 'configuracao').slice(0, 40),
        dados: comoJson(entrada.dados),
      },
    });
    return { ...resumo(c), repositorioId: c.repositorioId, dados: c.dados };
  }

  /**
   * Autosave e renomear.
   *
   * Só grava o que veio: um PATCH com apenas `titulo` não apaga `dados`. E o
   * `where` do `updateMany` repete empresa e usuário — a checagem anterior não
   * é suficiente sozinha, porque entre ela e a escrita existe uma janela.
   */
  async atualizar(
    empresaId: string,
    usuarioId: string,
    id: string,
    entrada: {
      titulo?: string;
      status?: CriacaoStatus;
      etapa?: string;
      dados?: Record<string, unknown>;
    },
  ): Promise<CriacaoDto> {
    const data: Prisma.CriacaoUpdateManyMutationInput = {};
    if (entrada.titulo !== undefined) {
      data.titulo = entrada.titulo.trim().slice(0, 200);
    }
    if (entrada.status !== undefined) data.status = entrada.status;
    if (entrada.etapa !== undefined) data.etapa = entrada.etapa.slice(0, 40);
    if (entrada.dados !== undefined) data.dados = comoJson(entrada.dados);

    const alteradas = await this.prisma.criacao.updateMany({
      where: { id, empresaId, usuarioId },
      data,
    });
    if (alteradas.count === 0) {
      throw new NotFoundException('Criação não encontrada.');
    }
    return this.obter(empresaId, usuarioId, id);
  }

  /**
   * Exclui a criação privada — e SÓ ela.
   *
   * Nada acontece no Repositório: o artefato que a pessoa salvou lá segue sua
   * própria vida, e apagar por tabela seria destruir o que já foi
   * disponibilizado a outras pessoas.
   */
  async remover(
    empresaId: string,
    usuarioId: string,
    id: string,
  ): Promise<{ success: true }> {
    const apagadas = await this.prisma.criacao.deleteMany({
      where: { id, empresaId, usuarioId },
    });
    if (apagadas.count === 0) {
      throw new NotFoundException('Criação não encontrada.');
    }
    return { success: true };
  }

  /** Teto do documento, conferido no controller antes de gravar. */
  static excedeLimite(dados: unknown): boolean {
    try {
      return JSON.stringify(dados ?? {}).length > LIMITE_DADOS;
    } catch {
      return true;
    }
  }
}
