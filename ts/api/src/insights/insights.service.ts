import { Injectable, Logger } from '@nestjs/common';
import type { Insight, InsightSeveridade } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AiService } from '@/ai/ai.service';
import {
  buildInsightsSystem,
  buildInsightsUser,
  MAX_INSIGHTS_PADRAO,
  parseInsights,
  type InsightGerado,
} from './insights.prompts';

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
}

function ddmmyyyy(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toDto(i: Insight): InsightDto {
  return {
    id: i.id,
    titulo: i.titulo,
    descricao: i.descricao,
    tipo: i.tipo,
    cor: i.severidade,
    ...(i.liderado ? { liderado: i.liderado } : {}),
    data: ddmmyyyy(i.criadoEm),
  };
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /** Todos os insights da empresa — mais recentes no topo. */
  async list(empresaId: string): Promise<InsightDto[]> {
    const rows = await this.prisma.insight.findMany({
      where: { empresaId },
      orderBy: { criadoEm: 'desc' },
    });
    return rows.map(toDto);
  }

  /** Persiste um lote de insights já gerados. */
  async createMany(
    empresaId: string,
    itens: InsightGerado[],
    origem: string,
    memoriaId?: string,
  ): Promise<InsightDto[]> {
    const criados: Insight[] = [];
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
        },
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
      const userPrompt = buildInsightsUser(material.titulo, conteudo, max);
      const { text } = await this.ai.completar(
        empresaId,
        usuarioId,
        buildInsightsSystem(max),
        userPrompt,
        4000,
        'insights',
      );
      const itens = parseInsights(text, max);
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
