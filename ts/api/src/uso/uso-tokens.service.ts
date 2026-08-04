import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

/** Consumo de tokens numa janela de tempo. */
export interface UsoJanela {
  entrada: number;
  saida: number;
  total: number;
}

/** Resumo do consumo de tokens do usuário nas janelas de tempo. */
export interface UsoResumo {
  hora: UsoJanela;
  dia: UsoJanela;
  semana: UsoJanela;
  mes: UsoJanela;
}

const UMA_HORA = 3600 * 1000;
const UM_DIA = 24 * UMA_HORA;
const SETE_DIAS = 7 * UM_DIA;
const TRINTA_DIAS = 30 * UM_DIA;

/**
 * Contador de tokens consumidos pela IA, por janelas de tempo (última hora, 24h,
 * 7 dias, 30 dias). Cada chamada ao modelo grava um evento em `ai_usage` (via
 * `registrar`) e o header consulta o `resumo` do usuário. Portado do contador do
 * beculture/Confi (lib/uso-tokens.js), agora persistido no Postgres e com escopo
 * por usuário.
 */
@Injectable()
export class UsoTokensService {
  private readonly logger = new Logger(UsoTokensService.name);
  /** Timestamp da última poda, para não podar a cada evento. */
  private ultimaPoda = 0;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra um consumo de tokens. Ignora zeros. É best-effort e não-bloqueante:
   * uma falha de escrita nunca deve quebrar a resposta da IA — por isso a Promise
   * é solta com `.catch()` e o método retorna imediatamente.
   */
  registrar(evento: {
    empresaId: string;
    usuarioId: string;
    entrada?: number;
    saida?: number;
    fonte?: string;
  }): void {
    const entrada = Math.max(0, Math.round(Number(evento.entrada) || 0));
    const saida = Math.max(0, Math.round(Number(evento.saida) || 0));
    if (!entrada && !saida) return;

    this.prisma.aiUsage
      .create({
        data: {
          empresaId: evento.empresaId,
          usuarioId: evento.usuarioId,
          entrada,
          saida,
          fonte: evento.fonte,
        },
      })
      .then(() => this.podarSeNecessario())
      .catch((err: unknown) => {
        // Diagnóstico apenas: contar tokens nunca deve derrubar o fluxo.
        this.logger.warn(`Falha ao registrar uso de tokens: ${String(err)}`);
      });
  }

  /** Soma tokens (entrada + saída) nas três janelas para um usuário. */
  async resumo(usuarioId: string): Promise<UsoResumo> {
    const agora = Date.now();
    const janela = async (ms: number): Promise<UsoJanela> => {
      const desde = new Date(agora - ms);
      const r = await this.prisma.aiUsage.aggregate({
        where: { usuarioId, criadoEm: { gte: desde } },
        _sum: { entrada: true, saida: true },
      });
      const entrada = r._sum.entrada ?? 0;
      const saida = r._sum.saida ?? 0;
      return { entrada, saida, total: entrada + saida };
    };
    const [hora, dia, semana, mes] = await Promise.all([
      janela(UMA_HORA),
      janela(UM_DIA),
      janela(SETE_DIAS),
      janela(TRINTA_DIAS),
    ]);
    return { hora, dia, semana, mes };
  }

  /**
   * Descarta eventos com mais de 30 dias (a maior janela) para manter a tabela
   * enxuta. Throttled para no máximo uma poda por hora e best-effort.
   */
  private podarSeNecessario(): void {
    const agora = Date.now();
    if (agora - this.ultimaPoda < UMA_HORA) return;
    this.ultimaPoda = agora;
    this.prisma.aiUsage
      .deleteMany({ where: { criadoEm: { lt: new Date(agora - TRINTA_DIAS) } } })
      .catch(() => {
        /* best-effort: falha na poda não afeta nada */
      });
  }
}
