import { extname } from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { extrairTexto } from '@/ai/analise/extrair-texto';
import type { VaultNotaHit } from '@/vault/vault.service';

export type StatusDocumentoOrg = 'processando' | 'disponivel' | 'erro';

/** Linha da tabela do Repositório — sem o conteúdo, que só a IA lê. */
export interface DocumentoOrg {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  status: StatusDocumentoOrg;
  erro: string | null;
  adicionadoPorNome: string;
  criadoEm: Date;
}

const SELECT_LINHA = {
  id: true,
  nome: true,
  tipo: true,
  tamanho: true,
  status: true,
  erro: true,
  adicionadoPorNome: true,
  criadoEm: true,
} as const;

/**
 * Prefixo do `path` com que um documento da organização entra no contexto da
 * IA. Distingue-o de uma nota do vault (cujo path é um caminho de pasta) e não
 * colide com nenhum caminho real.
 */
export const PREFIXO_PATH_ORG = 'repositorio:';

/**
 * Repositório da organização: a base de conhecimento compartilhada.
 *
 * TODO método é escopado por empresa (tenant, do JWT) **e** organização (header
 * `X-Organizacao-Id`). Sem organização, nada é lido nem gravado — cair no
 * escopo da empresa mostraria a uma organização os documentos de outra.
 *
 * Fonte separada do vault de propósito: os documentos daqui não aparecem na
 * lista pessoal nem no grafo pessoal. Eles só chegam à IA, via `search`.
 */
@Injectable()
export class RepositorioOrgService {
  private readonly logger = new Logger(RepositorioOrgService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listar(
    empresaId: string,
    organizacaoId: string | null,
  ): Promise<DocumentoOrg[]> {
    if (!organizacaoId) return [];
    const linhas = await this.prisma.repositorioOrgDocumento.findMany({
      where: { empresaId, organizacaoId },
      orderBy: { criadoEm: 'desc' },
      select: SELECT_LINHA,
    });
    return linhas as DocumentoOrg[];
  }

  /**
   * Grava o documento e extrai o texto. A linha nasce `processando` e termina
   * `disponivel` ou `erro` — é o estado que a tabela mostra, e um documento em
   * `erro` fica visível (com a causa) em vez de sumir.
   */
  async enviar(
    empresaId: string,
    organizacaoId: string,
    usuarioId: string,
    arquivo: { originalname: string; buffer: Buffer; size: number },
  ): Promise<DocumentoOrg> {
    const nome = nomeDoArquivo(arquivo.originalname);
    const tipo = extname(nome).replace('.', '').toLowerCase() || 'txt';

    const autor = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { nome: true, email: true },
    });

    const criado = await this.prisma.repositorioOrgDocumento.create({
      data: {
        empresaId,
        organizacaoId,
        nome,
        tipo,
        tamanho: arquivo.size,
        adicionadoPorId: usuarioId,
        adicionadoPorNome: autor?.nome || autor?.email || 'Usuário',
      },
      select: { id: true },
    });

    let conteudo = '';
    let erro: string | null = null;
    try {
      conteudo = (await extrairTexto(arquivo.buffer, nome)).trim();
      if (!conteudo) erro = 'Não foi possível extrair texto do arquivo.';
    } catch (err) {
      erro =
        err instanceof Error ? err.message : 'Não foi possível ler o arquivo.';
      this.logger.warn(`Falha ao extrair "${nome}": ${String(err)}`);
    }

    const atualizado = await this.prisma.repositorioOrgDocumento.update({
      where: { id: criado.id },
      data: erro
        ? { status: 'erro', erro }
        : { status: 'disponivel', conteudo },
      select: SELECT_LINHA,
    });
    return atualizado as DocumentoOrg;
  }

  async remover(
    empresaId: string,
    organizacaoId: string,
    id: string,
  ): Promise<void> {
    const { count } = await this.prisma.repositorioOrgDocumento.deleteMany({
      where: { id, empresaId, organizacaoId },
    });
    if (!count) throw new NotFoundException('Documento não encontrado.');
  }

  /**
   * Os documentos disponíveis mais recentes da organização, com conteúdo —
   * matéria-prima da geração manual de insights (tela de Insights).
   */
  async recentes(
    empresaId: string,
    organizacaoId: string | null,
    k = 8,
  ): Promise<VaultNotaHit[]> {
    if (!organizacaoId) return [];
    const docs = await this.prisma.repositorioOrgDocumento.findMany({
      where: { empresaId, organizacaoId, status: 'disponivel' },
      orderBy: { criadoEm: 'desc' },
      take: k,
      select: { nome: true, conteudo: true },
    });
    return docs.map((d) => ({
      path: `${PREFIXO_PATH_ORG}${d.nome}`,
      titulo: tituloDoNome(d.nome),
      conteudo: d.conteudo,
    }));
  }

  /**
   * Documentos mais relevantes à pergunta, no mesmo formato das notas do vault
   * — para entrarem no MESMO bloco de contexto. Mesma busca full-text em
   * português de `VaultService.search`, só sobre documentos `disponivel`.
   *
   * Sem casamento, devolve vazio (não há fallback de "mais recentes"): quem
   * chama já recebe o fallback do vault, e documento da organização fora de
   * assunto só competiria com ele pelo orçamento do prompt.
   */
  async search(
    empresaId: string,
    organizacaoId: string | null,
    query: string,
    k = 4,
  ): Promise<VaultNotaHit[]> {
    const q = query.trim();
    if (!organizacaoId || !q) return [];
    const rows = await this.prisma.$queryRaw<
      { nome: string; conteudo: string }[]
    >`
      SELECT "nome", "conteudo"
      FROM "repositorio_org_documentos"
      WHERE "empresaId" = ${empresaId}
        AND "organizacaoId" = ${organizacaoId}
        AND "status" = 'disponivel'
        AND to_tsvector('portuguese', coalesce("nome", '') || ' ' || coalesce("conteudo", ''))
            @@ websearch_to_tsquery('portuguese', ${q})
      ORDER BY ts_rank(
        to_tsvector('portuguese', coalesce("nome", '') || ' ' || coalesce("conteudo", '')),
        websearch_to_tsquery('portuguese', ${q})
      ) DESC
      LIMIT ${k}
    `;
    return rows.map((r) => ({
      path: `${PREFIXO_PATH_ORG}${r.nome}`,
      titulo: tituloDoNome(r.nome),
      conteudo: r.conteudo,
    }));
  }
}

/**
 * O multer entrega `originalname` decodificado como latin1; um "Relatório.pdf"
 * chegaria como "RelatÃ³rio.pdf". Reinterpreta como UTF-8 só quando isso
 * produz texto válido — um nome ASCII passa igual.
 */
function nomeDoArquivo(original: string): string {
  const utf8 = Buffer.from(original, 'latin1').toString('utf8');
  const nome = utf8.includes('�') ? original : utf8;
  return nome.trim().slice(0, 255) || 'documento';
}

/** "Plano Estratégico 2026.pdf" → "Plano Estratégico 2026". */
function tituloDoNome(nome: string): string {
  return nome.replace(/\.[^.]+$/, '') || nome;
}
