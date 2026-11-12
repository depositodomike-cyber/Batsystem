import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { idDaRequisicao } from '@/common/correlacao';

export interface EventoAuditoria {
  empresaId: string;
  usuarioId?: string | null;
  execucaoId?: string | null;
  etapaId?: string | null;
  evento: string;
  ferramenta?: string | null;
  risco?: string | null;
  detalhes?: Prisma.InputJsonValue;
}

/**
 * Trilha de auditoria do orquestrador (só INSERT). Cada registro leva o id
 * de correlação da requisição, para casar com os logs.
 *
 * `registrar` loga a falha e segue (leituras, ciclo de vida); antes de uma
 * escrita o executor usa `registrarObrigatorio`, e sem auditoria não há ação.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Para eventos de leitura e de ciclo de vida: falha é logada, não interrompe. */
  async registrar(e: EventoAuditoria): Promise<void> {
    try {
      await this.registrarObrigatorio(e);
    } catch (err) {
      this.logger.error(`Falha ao gravar auditoria (${e.evento}): ${String(err)}`);
    }
  }

  /**
   * Para o que precede uma ESCRITA: se não der para auditar, lança — e quem
   * chama não executa a ação.
   */
  async registrarObrigatorio(e: EventoAuditoria): Promise<void> {
    await this.prisma.registroAuditoria.create({
      data: {
        empresaId: e.empresaId,
        usuarioId: e.usuarioId ?? null,
        execucaoId: e.execucaoId ?? null,
        etapaId: e.etapaId ?? null,
        evento: e.evento,
        ferramenta: e.ferramenta ?? null,
        risco: e.risco ?? null,
        detalhes: e.detalhes,
        idRequisicao: idDaRequisicao() ?? null,
      },
    });
  }
}
