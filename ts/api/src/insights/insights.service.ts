import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  Insight,
  InsightFeedbackMotivo,
  InsightSeveridade,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AiService } from '@/ai/ai.service';
import {
  buildInsightsSystem,
  buildInsightsUser,
  MAX_INSIGHTS_PADRAO,
  parseInsights,
  type InsightGerado,
} from './insights.prompts';
import { DirecionamentosService } from './direcionamentos.service';
import type { InsightFeedbackDto } from './dto/feedback.dto';

/** Feedback do usuário atual sobre o insight ("Este insight foi útil?"). */
export interface InsightFeedbackResumo {
  util: boolean;
  motivo?: InsightFeedbackMotivo;
}

/** Forma retornada ao front (espelha `Insight` em ts/demo/.../data/insights.ts). */
export interface InsightDto {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  /** Cor/severidade do card. */
  cor: InsightSeveridade;
  /** Pessoa/time a que o insight se refere (opcional). */
  liderado?: string;
  /** DD/MM/YYYY — o front ordena/exibe por esta data. */
  data: string;
  /** ISO — usado pelo sino de notificações para o "há 2 h". */
  criadoEm: string;
  /** De onde veio (ex.: "Áudio", "Transcrição", "Documento"). */
  origem: string;
  /** Direcionamento a que o insight se relaciona, se ainda existir. */
  direcionamento?: { id: string; nome: string };
  /** Feedback do usuário que fez a leitura (só na listagem da página). */
  meuFeedback?: InsightFeedbackResumo;
}

function ddmmyyyy(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Detalhe (modal "Ver insight"): o resumo da listagem + o conteúdo completo. */
export interface InsightDetalheDto extends InsightDto {
  analise?: string;
  /** Trechos literais do material de origem. Vazio = não há o que mostrar. */
  evidencias: string[];
  /** Material de origem, se ainda existir na Memória da empresa. */
  fonte?: { titulo: string; categoria: string; data: string };
}

/** A listagem não carrega o conteúdo completo — só o modal busca. */
const OMIT_DETALHE = { analise: true, evidencias: true } as const;

type InsightComRelacoes = Omit<Insight, 'analise' | 'evidencias'> & {
  direcionamento?: { id: string; nome: string } | null;
  feedbacks?: { util: boolean; motivo: InsightFeedbackMotivo | null }[];
};

function toDto(i: InsightComRelacoes): InsightDto {
  const fb = i.feedbacks?.[0];
  return {
    id: i.id,
    titulo: i.titulo,
    descricao: i.descricao,
    tipo: i.tipo,
    cor: i.severidade,
    ...(i.liderado ? { liderado: i.liderado } : {}),
    data: ddmmyyyy(i.criadoEm),
    criadoEm: i.criadoEm.toISOString(),
    origem: i.origem,
    ...(i.direcionamento ? { direcionamento: i.direcionamento } : {}),
    ...(fb
      ? { meuFeedback: { util: fb.util, ...(fb.motivo ? { motivo: fb.motivo } : {}) } }
      : {}),
  };
}

const INCLUDE_DIRECIONAMENTO = {
  direcionamento: { select: { id: true, nome: true } },
} as const;

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly direcionamentos: DirecionamentosService,
  ) {}

  /**
   * Todos os insights da empresa — mais recentes no topo — com o feedback do
   * próprio usuário (cada um vê o seu 👍/👎).
   */
  async list(empresaId: string, usuarioId: string): Promise<InsightDto[]> {
    const rows = await this.prisma.insight.findMany({
      where: { empresaId },
      orderBy: { criadoEm: 'desc' },
      omit: OMIT_DETALHE,
      include: {
        ...INCLUDE_DIRECIONAMENTO,
        feedbacks: {
          where: { usuarioId },
          select: { util: true, motivo: true },
        },
      },
    });
    return rows.map(toDto);
  }

  /**
   * Um insight com o conteúdo completo, para o modal. A fonte só aparece se a
   * Memória de origem ainda existir E for da mesma empresa.
   */
  async detalhe(
    empresaId: string,
    usuarioId: string,
    id: string,
  ): Promise<InsightDetalheDto> {
    const row = await this.prisma.insight.findFirst({
      where: { id, empresaId },
      include: {
        ...INCLUDE_DIRECIONAMENTO,
        feedbacks: {
          where: { usuarioId },
          select: { util: true, motivo: true },
        },
      },
    });
    if (!row) throw new NotFoundException('Insight não encontrado.');
    const memoria = row.memoriaId
      ? await this.prisma.memoria.findFirst({
          where: { id: row.memoriaId, empresaId },
          select: { titulo: true, categoria: true, criadoEm: true },
        })
      : null;
    return {
      ...toDto(row),
      ...(row.analise ? { analise: row.analise } : {}),
      evidencias: row.evidencias,
      ...(memoria
        ? {
            fonte: {
              titulo: memoria.titulo,
              categoria: memoria.categoria,
              data: memoria.criadoEm.toISOString(),
            },
          }
        : {}),
    };
  }

  /** Registra (ou troca) o feedback do usuário sobre o insight. */
  async salvarFeedback(
    empresaId: string,
    usuarioId: string,
    insightId: string,
    dto: InsightFeedbackDto,
  ): Promise<InsightFeedbackResumo> {
    await this.exigirInsightDaEmpresa(empresaId, insightId);
    // Motivo e comentário só fazem sentido no 👎; no 👍 são limpos.
    const motivo = dto.util ? null : (dto.motivo ?? null);
    const comentario = dto.util ? null : dto.comentario?.trim() || null;
    const row = await this.prisma.insightFeedback.upsert({
      where: { insightId_usuarioId: { insightId, usuarioId } },
      create: { insightId, usuarioId, util: dto.util, motivo, comentario },
      update: { util: dto.util, motivo, comentario },
    });
    return { util: row.util, ...(row.motivo ? { motivo: row.motivo } : {}) };
  }

  /** Desfaz o feedback do usuário. Idempotente. */
  async removerFeedback(
    empresaId: string,
    usuarioId: string,
    insightId: string,
  ): Promise<void> {
    await this.exigirInsightDaEmpresa(empresaId, insightId);
    await this.prisma.insightFeedback.deleteMany({
      where: { insightId, usuarioId },
    });
  }

  private async exigirInsightDaEmpresa(
    empresaId: string,
    insightId: string,
  ): Promise<void> {
    const insight = await this.prisma.insight.findFirst({
      where: { id: insightId, empresaId },
      select: { id: true },
    });
    if (!insight) throw new NotFoundException('Insight não encontrado.');
  }

  /**
   * Insights que o USUÁRIO ainda não viu (sem `InsightLeitura` dele) — é o
   * conteúdo do sino de notificações. `total` conta todos; `insights` traz só
   * os `limite` mais recentes.
   */
  async listNaoLidos(
    empresaId: string,
    usuarioId: string,
    limite = 20,
  ): Promise<{ insights: InsightDto[]; total: number }> {
    const where = { empresaId, leituras: { none: { usuarioId } } };
    const [rows, total] = await Promise.all([
      this.prisma.insight.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        take: limite,
        omit: OMIT_DETALHE,
        include: INCLUDE_DIRECIONAMENTO,
      }),
      this.prisma.insight.count({ where }),
    ]);
    return { insights: rows.map(toDto), total };
  }

  /** Marca um insight como visto pelo usuário. Idempotente. */
  async marcarLido(
    empresaId: string,
    usuarioId: string,
    insightId: string,
  ): Promise<void> {
    await this.exigirInsightDaEmpresa(empresaId, insightId);
    await this.prisma.insightLeitura.upsert({
      where: { insightId_usuarioId: { insightId, usuarioId } },
      create: { insightId, usuarioId },
      update: {},
    });
  }

  /** Marca como vistos todos os insights da empresa ainda não lidos pelo usuário. */
  async marcarTodosLidos(empresaId: string, usuarioId: string): Promise<void> {
    const pendentes = await this.prisma.insight.findMany({
      where: { empresaId, leituras: { none: { usuarioId } } },
      select: { id: true },
    });
    if (pendentes.length === 0) return;
    await this.prisma.insightLeitura.createMany({
      data: pendentes.map((i) => ({ insightId: i.id, usuarioId })),
      skipDuplicates: true,
    });
  }

  /** Persiste um lote de insights já gerados. */
  async createMany(
    empresaId: string,
    itens: InsightGerado[],
    origem: string,
    memoriaId?: string,
  ): Promise<InsightDto[]> {
    const criados: InsightComRelacoes[] = [];
    for (const it of itens) {
      const row = await this.prisma.insight.create({
        data: {
          empresaId,
          titulo: it.titulo,
          descricao: it.descricao,
          tipo: it.tipo,
          severidade: it.severidade,
          ...(it.liderado ? { liderado: it.liderado } : {}),
          origem,
          ...(memoriaId ? { memoriaId } : {}),
          ...(it.direcionamentoId
            ? { direcionamentoId: it.direcionamentoId }
            : {}),
          ...(it.analise ? { analise: it.analise } : {}),
          ...(it.evidencias?.length ? { evidencias: it.evidencias } : {}),
        },
        omit: OMIT_DETALHE,
        include: INCLUDE_DIRECIONAMENTO,
      });
      criados.push(row);
    }
    return criados.map(toDto);
  }

  /**
   * Gera insights a partir de um material (ata/resumo/documento) via IA e os
   * persiste. `max` limita o tamanho do lote — o documento pede menos que uma
   * reunião (ver MAX_INSIGHTS_DOCUMENTO). Retorna os criados. NÃO lança em
   * falha de geração —
   * devolve [] e loga, para nunca derrubar o fluxo que a chamou (ex.: a
   * transcrição de áudio, que já salvou a ata com sucesso).
   */
  async gerarDeMaterial(
    empresaId: string,
    usuarioId: string,
    material: {
      titulo: string;
      conteudo: string;
      origem: string;
      memoriaId?: string;
      /** Teto do lote. Omitido, vale MAX_INSIGHTS_PADRAO. */
      max?: number;
    },
  ): Promise<InsightDto[]> {
    const conteudo = (material.conteudo || '').trim();
    if (!conteudo) return [];
    const max = material.max ?? MAX_INSIGHTS_PADRAO;
    try {
      // Direcionamentos ATIVOS da empresa orientam foco e critério. Falha ao
      // carregá-los não derruba a geração — segue sem eles.
      const direcionamentos = await this.direcionamentos
        .ativosParaPrompt(empresaId)
        .catch((err) => {
          this.logger.warn(`Direcionamentos indisponíveis: ${String(err)}`);
          return [];
        });
      const userPrompt = buildInsightsUser(material.titulo, conteudo, max);
      const { text } = await this.ai.completar(
        empresaId,
        usuarioId,
        buildInsightsSystem(max, direcionamentos),
        userPrompt,
        // Análise e evidências deixam a resposta bem maior que o resumo.
        8000,
        'insights',
      );
      // O material vai junto: evidência só é aceita se estiver nele.
      const itens = parseInsights(text, max, direcionamentos, conteudo);
      if (itens.length === 0) {
        this.logger.warn('IA não retornou insights válidos para o material.');
        return [];
      }
      return this.createMany(empresaId, itens, material.origem, material.memoriaId);
    } catch (err) {
      this.logger.error(`Falha ao gerar insights: ${String(err)}`);
      return [];
    }
  }
}
