import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AiService } from '@/ai/ai.service';
import {
  SYSTEM_ATRIBUICAO,
  SYSTEM_VOCABULARIO,
  buildAtribuicaoUser,
  buildVocabularioUser,
  parseAtribuicao,
  parseVocabulario,
  type CategoriaProposta,
} from './categorias.prompts';

// ----------------------------------------------------------------------
// Classificação das notas do vault em categorias macro descobertas pela IA.
//
// O grafo tinha um eixo só de agrupamento, por recorrência de termos. Isso não
// responde "onde este documento se encaixa?" quando o documento é o único do
// acervo — pasta nova + primeiro upload dava grafo vazio. A categoria resolve
// isso porque não depende de recorrência nenhuma.
//
// Roda em FATIAS. A decisão de produto é que a classificação faz parte do
// Sincronizar, mas 40 notas × 1 chamada de IA num único request dariam minutos
// e encostariam no teto da função serverless — então cada request processa
// poucas notas e devolve quantas faltam, e o cliente chama em laço.
//
// NADA aqui pode derrubar a sincronização: toda falha (sem chave, provedor
// fora, JSON inválido) vira `erro` no retorno, nunca exceção. Sem categorias, o
// grafo simplesmente fica como era antes desta funcionalidade.
// ----------------------------------------------------------------------

export interface ResultadoClassificacao {
  processadas: number;
  pendentes: number;
  /** Tamanho do vocabulário confirmado. */
  vocabulario: number;
  /** Preenchido quando a IA não pôde ser consultada — o cliente para o laço. */
  erro?: string;
}

export interface CategoriasDoVault {
  categorias: { slug: string; label: string; definicao: string | null }[];
  /** path → slugs das categorias confirmadas daquela nota. */
  porPath: Record<string, string[]>;
}

@Injectable()
export class VaultCategoriasService {
  private readonly logger = new Logger(VaultCategoriasService.name);

  /** Notas por request. Mantém cada chamada curta e retomável. */
  private static readonly LOTE = 6;
  /** Notas na amostra que gera o vocabulário. */
  private static readonly AMOSTRA = 40;
  /** Trecho de cada nota na amostra — o suficiente para o tema, não o texto todo. */
  private static readonly TRECHO = 600;
  /** Propostas necessárias para uma categoria nova entrar no vocabulário. */
  private static readonly PARA_CONFIRMAR = 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /** Vocabulário confirmado + o mapa path→categorias, para o grafo montar. */
  async listar(
    empresaId: string,
    repositorioId: string | null,
  ): Promise<CategoriasDoVault> {
    if (!repositorioId) return { categorias: [], porPath: {} };

    const categorias = await this.prisma.vaultCategoria.findMany({
      where: { empresaId, repositorioId, confirmada: true },
      orderBy: [{ label: 'asc' }],
      select: { slug: true, label: true, definicao: true },
    });
    if (categorias.length === 0) return { categorias: [], porPath: {} };

    // As atribuições guardam também categorias ainda não confirmadas (ver
    // `classificar`), então o filtro por slug conhecido é obrigatório aqui.
    const conhecidos = new Set(categorias.map((c) => c.slug));
    const ligacoes = await this.prisma.vaultNotaCategoria.findMany({
      where: { empresaId, repositorioId },
      select: { path: true, categoriaSlug: true },
    });

    const porPath: Record<string, string[]> = {};
    for (const l of ligacoes) {
      if (!conhecidos.has(l.categoriaSlug)) continue;
      (porPath[l.path] ??= []).push(l.categoriaSlug);
    }
    return { categorias, porPath };
  }

  /**
   * Classifica a próxima fatia de notas pendentes. "Pendente" é nota cujo
   * `categoriasHash` não bate com o `hash` atual — nova, alterada ou nunca
   * classificada. Resincronizar um vault intocado não gasta token nenhum.
   */
  async classificar(
    empresaId: string,
    repositorioId: string | null,
    usuarioId: string,
  ): Promise<ResultadoClassificacao> {
    if (!repositorioId) {
      return { processadas: 0, pendentes: 0, vocabulario: 0 };
    }

    let vocabulario = await this.vocabularioConfirmado(empresaId, repositorioId);
    if (vocabulario.length === 0) {
      const erro = await this.construirVocabulario(
        empresaId,
        repositorioId,
        usuarioId,
      );
      if (erro) {
        return {
          processadas: 0,
          pendentes: await this.contarPendentes(empresaId, repositorioId),
          vocabulario: 0,
          erro,
        };
      }
      vocabulario = await this.vocabularioConfirmado(empresaId, repositorioId);
    }

    const paths = await this.pathsPendentes(empresaId, repositorioId);
    const fila = paths.length
      ? await this.prisma.vaultNota.findMany({
          where: {
            empresaId,
            repositorioId,
            path: { in: paths.slice(0, VaultCategoriasService.LOTE) },
          },
          select: { path: true, titulo: true, conteudo: true, hash: true },
        })
      : [];

    if (fila.length === 0) {
      return { processadas: 0, pendentes: 0, vocabulario: vocabulario.length };
    }

    let processadas = 0;
    for (const nota of fila) {
      const erro = await this.classificarNota(
        empresaId,
        repositorioId,
        usuarioId,
        nota,
        vocabulario,
      );
      if (erro) {
        return {
          processadas,
          pendentes: await this.contarPendentes(empresaId, repositorioId),
          vocabulario: vocabulario.length,
          erro,
        };
      }
      processadas += 1;
    }

    return {
      processadas,
      pendentes: await this.contarPendentes(empresaId, repositorioId),
      vocabulario: (await this.vocabularioConfirmado(empresaId, repositorioId))
        .length,
    };
  }

  // ---------- Internos ----------

  private vocabularioConfirmado(empresaId: string, repositorioId: string) {
    return this.prisma.vaultCategoria.findMany({
      where: { empresaId, repositorioId, confirmada: true },
      orderBy: [{ label: 'asc' }],
      select: { slug: true, label: true, definicao: true },
    });
  }

  /**
   * Paths cuja classificação está velha, dos mais recentes para os mais antigos.
   *
   * O Prisma não compara duas colunas da mesma linha, então a comparação
   * `categoriasHash !== hash` é feita em memória — sobre uma projeção sem o
   * `conteudo`, que é o campo pesado.
   */
  private async pathsPendentes(
    empresaId: string,
    repositorioId: string,
  ): Promise<string[]> {
    const notas = await this.prisma.vaultNota.findMany({
      where: { empresaId, repositorioId },
      orderBy: [{ atualizadoEm: 'desc' }],
      select: { path: true, hash: true, categoriasHash: true },
    });
    return notas
      .filter((n) => n.categoriasHash !== n.hash)
      .map((n) => n.path);
  }

  private async contarPendentes(
    empresaId: string,
    repositorioId: string,
  ): Promise<number> {
    return (await this.pathsPendentes(empresaId, repositorioId)).length;
  }

  /** Corpo sem frontmatter e sem excesso de espaço, cortado para caber. */
  private trecho(conteudo: string): string {
    return conteudo
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
      .replace(/[ \t]+/g, ' ')
      .trim()
      .slice(0, VaultCategoriasService.TRECHO);
  }

  /** Devolve a mensagem de erro, ou `undefined` quando gravou o vocabulário. */
  private async construirVocabulario(
    empresaId: string,
    repositorioId: string,
    usuarioId: string,
  ): Promise<string | undefined> {
    const notas = await this.prisma.vaultNota.findMany({
      where: { empresaId, repositorioId },
      orderBy: [{ atualizadoEm: 'desc' }],
      take: VaultCategoriasService.AMOSTRA,
      select: { titulo: true, conteudo: true },
    });
    if (notas.length === 0) return undefined;

    let texto: string;
    try {
      const r = await this.ai.completar(
        empresaId,
        usuarioId,
        SYSTEM_VOCABULARIO,
        buildVocabularioUser(
          notas.map((n) => ({ titulo: n.titulo, trecho: this.trecho(n.conteudo) })),
        ),
        2000,
        'categorias:vocabulario',
        { semDiretrizes: true },
      );
      texto = r.text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Vocabulário de categorias não gerado: ${msg}`);
      return msg;
    }

    const propostas = parseVocabulario(texto);
    if (propostas.length === 0) {
      this.logger.warn('IA não devolveu vocabulário de categorias válido.');
      return 'A IA não devolveu categorias válidas.';
    }

    await this.prisma.$transaction(
      propostas.map((c) =>
        this.prisma.vaultCategoria.upsert({
          where: {
            empresaId_repositorioId_slug: { empresaId, repositorioId, slug: c.slug },
          },
          // O vocabulário inicial nasce confirmado: ele veio de uma leitura do
          // acervo inteiro, não da proposta de uma nota isolada.
          create: {
            empresaId,
            repositorioId,
            slug: c.slug,
            label: c.label,
            definicao: c.definicao || null,
            confirmada: true,
            propostas: VaultCategoriasService.PARA_CONFIRMAR,
          },
          update: { confirmada: true },
        }),
      ),
    );
    this.logger.log(
      `Vocabulário de categorias criado (${propostas.length}) para o repositório ${repositorioId}.`,
    );
    return undefined;
  }

  /** Devolve a mensagem de erro, ou `undefined` quando classificou a nota. */
  private async classificarNota(
    empresaId: string,
    repositorioId: string,
    usuarioId: string,
    nota: { path: string; titulo: string; conteudo: string; hash: string },
    vocabulario: { slug: string; label: string; definicao: string | null }[],
  ): Promise<string | undefined> {
    let texto: string;
    try {
      const r = await this.ai.completar(
        empresaId,
        usuarioId,
        SYSTEM_ATRIBUICAO,
        buildAtribuicaoUser(vocabulario, nota),
        500,
        'categorias:atribuicao',
        { semDiretrizes: true },
      );
      texto = r.text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Falha ao classificar ${nota.path}: ${msg}`);
      return msg;
    }

    const conhecidos = new Set(vocabulario.map((c) => c.slug));
    const { slugs, novas } = parseAtribuicao(texto, conhecidos);
    await this.registrarPropostas(empresaId, repositorioId, novas);

    // As propostas também viram atribuição, mesmo antes de confirmadas: assim,
    // quando a segunda nota confirmar a categoria, a primeira já está ligada a
    // ela e não precisa ser reclassificada. `listar` filtra pelas confirmadas.
    const todos = [...new Set([...slugs, ...novas.map((c) => c.slug)])];

    await this.prisma.$transaction([
      this.prisma.vaultNotaCategoria.deleteMany({
        where: { empresaId, repositorioId, path: nota.path },
      }),
      ...todos.map((slug) =>
        this.prisma.vaultNotaCategoria.create({
          data: {
            empresaId,
            repositorioId,
            path: nota.path,
            categoriaSlug: slug,
            hash: nota.hash,
          },
        }),
      ),
      // Grava o hash mesmo com zero categorias: sem isso a nota voltaria à fila
      // para sempre, gastando token a cada Sincronizar.
      this.prisma.vaultNota.update({
        where: {
          empresaId_repositorioId_path: {
            empresaId,
            repositorioId,
            path: nota.path,
          },
        },
        data: { categoriasHash: nota.hash },
      }),
    ]);
    return undefined;
  }

  /** Conta a proposta e confirma a categoria ao atingir o piso. */
  private async registrarPropostas(
    empresaId: string,
    repositorioId: string,
    novas: CategoriaProposta[],
  ): Promise<void> {
    for (const c of novas) {
      const linha = await this.prisma.vaultCategoria.upsert({
        where: {
          empresaId_repositorioId_slug: { empresaId, repositorioId, slug: c.slug },
        },
        create: {
          empresaId,
          repositorioId,
          slug: c.slug,
          label: c.label,
          definicao: c.definicao || null,
          confirmada: false,
          propostas: 1,
        },
        update: { propostas: { increment: 1 } },
      });
      if (
        !linha.confirmada &&
        linha.propostas >= VaultCategoriasService.PARA_CONFIRMAR
      ) {
        await this.prisma.vaultCategoria.update({
          where: { id: linha.id },
          data: { confirmada: true },
        });
        this.logger.log(`Categoria "${linha.label}" confirmada por recorrência.`);
      }
    }
  }
}
