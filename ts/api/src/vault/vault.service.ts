import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/** Uma nota .md vinda do cliente (conteúdo lido no navegador). */
export interface VaultNotaInput {
  path: string;
  titulo: string;
  conteudo: string;
}

/** Nota recuperada pela busca, pronta para virar contexto do prompt. */
export interface VaultNotaHit {
  path: string;
  titulo: string;
  conteudo: string;
}

/** Referência de nota (sem conteúdo) — alvo possível de um [[wikilink]]. */
export interface VaultNotaRef {
  path: string;
  titulo: string;
}

function hashConteudo(conteudo: string): string {
  return createHash('sha256').update(conteudo).digest('hex');
}

/**
 * Índice das notas .md que o cliente sincroniza.
 *
 * TODO método é escopado por empresa **e repositório**. O repositório vem do
 * header `X-Repositorio-Id` (ver RepositorioAtual) e pode ser `null` quando não
 * há contexto ativo; nesse caso nada é lido nem gravado. Cair no escopo da
 * empresa faria uma sincronização apagar as notas de outro repositório e a IA
 * responder com notas de contextos que o usuário não abriu.
 */
@Injectable()
export class VaultService {
  constructor(private readonly prisma: PrismaService) {}

  /** Quantas notas o repositório tem sincronizadas. */
  count(empresaId: string, repositorioId: string | null): Promise<number> {
    if (!repositorioId) return Promise.resolve(0);
    return this.prisma.vaultNota.count({ where: { empresaId, repositorioId } });
  }

  /**
   * Sincroniza um lote de notas: faz upsert por (empresa, repositório, path) e
   * pula as que não mudaram (mesmo hash de conteúdo). Retorna quantas foram
   * gravadas e quantas ficaram inalteradas — para o cliente mostrar progresso.
   */
  async syncBatch(
    empresaId: string,
    repositorioId: string | null,
    notas: VaultNotaInput[],
  ): Promise<{ gravadas: number; inalteradas: number }> {
    if (!repositorioId || notas.length === 0) {
      return { gravadas: 0, inalteradas: 0 };
    }

    const paths = notas.map((n) => n.path);
    const existentes = await this.prisma.vaultNota.findMany({
      where: { empresaId, repositorioId, path: { in: paths } },
      select: { path: true, hash: true },
    });
    const hashPorPath = new Map(existentes.map((e) => [e.path, e.hash]));

    let gravadas = 0;
    let inalteradas = 0;
    const ops = [];
    for (const nota of notas) {
      const hash = hashConteudo(nota.conteudo);
      if (hashPorPath.get(nota.path) === hash) {
        inalteradas++;
        continue;
      }
      gravadas++;
      ops.push(
        this.prisma.vaultNota.upsert({
          where: {
            empresaId_repositorioId_path: {
              empresaId,
              repositorioId,
              path: nota.path,
            },
          },
          create: {
            empresaId,
            repositorioId,
            path: nota.path,
            titulo: nota.titulo,
            conteudo: nota.conteudo,
            hash,
          },
          update: { titulo: nota.titulo, conteudo: nota.conteudo, hash },
        }),
      );
    }
    if (ops.length) await this.prisma.$transaction(ops);
    return { gravadas, inalteradas };
  }

  /**
   * Fecha a sincronização: remove as notas cujo `path` não está mais na pasta
   * (lista completa de paths atuais). Retorna o total final e quantas foram
   * removidas.
   *
   * O `deleteMany` é escopado ao repositório. Sem esse filtro ele apagaria as
   * notas de todos os outros repositórios da empresa — cujos caminhos nunca
   * estarão na lista da pasta que está sendo sincronizada.
   */
  async finalize(
    empresaId: string,
    repositorioId: string | null,
    paths: string[],
  ): Promise<{ total: number; removidas: number }> {
    if (!repositorioId) return { total: 0, removidas: 0 };
    const del = await this.prisma.vaultNota.deleteMany({
      where: { empresaId, repositorioId, path: { notIn: paths } },
    });
    const total = await this.count(empresaId, repositorioId);
    return { total, removidas: del.count };
  }

  /**
   * Recupera as notas mais relevantes à pergunta por busca textual do Postgres
   * (full-text em português). Se a pergunta não casar com nada (ou vier vazia),
   * cai para as notas mais recentes — melhor dar algum contexto do que nenhum.
   */
  async search(
    empresaId: string,
    repositorioId: string | null,
    query: string,
    k = 8,
  ): Promise<VaultNotaHit[]> {
    if (!repositorioId) return [];
    const q = query.trim();
    if (q) {
      const rows = await this.prisma.$queryRaw<VaultNotaHit[]>`
        SELECT "path", "titulo", "conteudo"
        FROM "vault_notas"
        WHERE "empresaId" = ${empresaId}
          AND "repositorioId" = ${repositorioId}
          AND to_tsvector('portuguese', coalesce("titulo", '') || ' ' || coalesce("conteudo", ''))
              @@ websearch_to_tsquery('portuguese', ${q})
        ORDER BY ts_rank(
          to_tsvector('portuguese', coalesce("titulo", '') || ' ' || coalesce("conteudo", '')),
          websearch_to_tsquery('portuguese', ${q})
        ) DESC
        LIMIT ${k}
      `;
      if (rows.length) return rows;
    }

    // Fallback: notas mais recentes.
    const recentes = await this.prisma.vaultNota.findMany({
      where: { empresaId, repositorioId },
      orderBy: { atualizadoEm: 'desc' },
      take: k,
      select: { path: true, titulo: true, conteudo: true },
    });
    return recentes;
  }

  /**
   * Notas cujo título casa com o que o usuário digitou depois de "[[" — os
   * alvos do autocomplete de conexão com a Memória. Diferente de `search`, que
   * é full-text para montar contexto: aqui a busca é por PEDAÇO do título
   * (`contains`), porque quem digita "reu" espera ver "Reunião de conselho" —
   * o full-text do Postgres só casaria a palavra inteira. Sem termo, devolve as
   * notas mais recentes (a lista inicial que abre junto com o "[[").
   */
  async buscarNotas(
    empresaId: string,
    repositorioId: string | null,
    query = '',
    k = 200,
  ): Promise<VaultNotaRef[]> {
    if (!repositorioId) return [];
    const q = query.trim().slice(0, 120);
    return this.prisma.vaultNota.findMany({
      where: {
        empresaId,
        repositorioId,
        ...(q ? { titulo: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { atualizadoEm: 'desc' },
      take: k,
      select: { path: true, titulo: true },
    });
  }

  /**
   * Só os títulos das notas mais relevantes ao assunto — alvos possíveis para os
   * [[wikilinks]] do bloco "Conexões no Vault". Traz mais itens que o `search`
   * (e sem o conteúdo) porque aqui o que importa é a variedade de assuntos que a
   * IA pode ligar, não o texto das notas. Sem casamento, cai nas mais recentes.
   */
  async titulos(
    empresaId: string,
    repositorioId: string | null,
    query = '',
    k = 40,
  ): Promise<string[]> {
    if (!repositorioId) return [];
    const q = query.trim().slice(0, 1000);
    if (q) {
      const rows = await this.prisma.$queryRaw<{ titulo: string }[]>`
        SELECT "titulo"
        FROM "vault_notas"
        WHERE "empresaId" = ${empresaId}
          AND "repositorioId" = ${repositorioId}
          AND to_tsvector('portuguese', coalesce("titulo", '') || ' ' || coalesce("conteudo", ''))
              @@ websearch_to_tsquery('portuguese', ${q})
        ORDER BY ts_rank(
          to_tsvector('portuguese', coalesce("titulo", '') || ' ' || coalesce("conteudo", '')),
          websearch_to_tsquery('portuguese', ${q})
        ) DESC
        LIMIT ${k}
      `;
      if (rows.length) return rows.map((r) => r.titulo);
    }

    const recentes = await this.prisma.vaultNota.findMany({
      where: { empresaId, repositorioId },
      orderBy: { atualizadoEm: 'desc' },
      take: k,
      select: { titulo: true },
    });
    return recentes.map((r) => r.titulo);
  }
}
