import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AiService } from '@/ai/ai.service';
import type { LlmUsage } from '@/ai/providers';
import type { HistoricoTurno } from '@/ai/prompt/framework';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { SYSTEM_ROTEADOR } from './prompts';
import { extrairJson } from './json-modelo';

export type Rota = 'direta' | 'plano';

export interface DecisaoRota {
  rota: Rota;
  /** De onde a resposta direta vem; ausente = o Assistente decide sozinho. */
  fonte?: 'memoria' | 'web';
  motivo: string;
  usage?: LlmUsage;
}

const RESPOSTA = z.object({
  rota: z.enum(['direta', 'plano']),
  fonte: z.enum(['memoria', 'web']).optional(),
  motivo: z.string().max(300).optional(),
});

/**
 * Decide se o pedido vai pelo fluxo direto do Assistente (uma chamada, igual
 * a hoje) ou vira uma execução planejada. Qualquer falha — sem IA, resposta
 * fora do formato — cai em "direta": o pior caso é o comportamento atual.
 */
@Injectable()
export class RoteadorService {
  private readonly logger = new Logger(RoteadorService.name);

  constructor(private readonly ai: AiService) {}

  async decidir(
    user: AuthenticatedUser,
    texto: string,
    historico: HistoricoTurno[],
  ): Promise<DecisaoRota> {
    // Os dois últimos turnos bastam para resolver "e o outro?", "compare com
    // aquilo" — o roteador não precisa da conversa inteira.
    const recente = historico
      .slice(-2)
      .map((t) => `Usuário: ${t.pergunta.slice(0, 500)}\nAssistente: ${t.resposta.slice(0, 500)}`)
      .join('\n\n');
    const pedido = recente
      ? `## CONVERSA RECENTE\n${recente}\n\n## PEDIDO\n${texto}`
      : `## PEDIDO\n${texto}`;
    try {
      const r = await this.ai.completarComFerramentas(user.empresaId, user.id, {
        system: SYSTEM_ROTEADOR,
        mensagens: [{ papel: 'user', blocos: [{ tipo: 'texto', texto: pedido }] }],
        ferramentas: [],
        maxTokens: 80,
        fonte: 'orquestrador-rota',
        semDiretrizes: true,
      });
      const lido = RESPOSTA.safeParse(extrairJson(r.texto));
      if (!lido.success) {
        this.logger.warn(`Roteador fora do formato, seguindo direto: ${r.texto.slice(0, 200)}`);
        return { rota: 'direta', motivo: 'classificação inválida', usage: r.usage };
      }
      return {
        rota: lido.data.rota,
        ...(lido.data.fonte ? { fonte: lido.data.fonte } : {}),
        motivo: lido.data.motivo ?? '',
        usage: r.usage,
      };
    } catch (err) {
      this.logger.warn(`Falha no roteador, seguindo direto: ${String(err)}`);
      return { rota: 'direta', motivo: 'falha ao classificar' };
    }
  }
}
