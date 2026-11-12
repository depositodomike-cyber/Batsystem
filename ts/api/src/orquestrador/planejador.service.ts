import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AiService } from '@/ai/ai.service';
import type { LlmUsage } from '@/ai/providers';
import type { MensagemComFerramentas } from '@/ai/tool-use';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import { RegistroFerramentasService } from './ferramentas/registro.service';
import { systemPlanejador } from './prompts';
import { extrairJson } from './json-modelo';

export interface EtapaPlano {
  chave: string;
  descricao: string;
  ferramenta: string | null;
  dependeDe: string[];
}

export interface Plano {
  objetivo: string;
  etapas: EtapaPlano[];
}

export const MAX_ETAPAS_PLANO = 8;

const ESQUEMA = z.object({
  objetivo: z.string().trim().min(1).max(500),
  etapas: z
    .array(
      z.object({
        chave: z.string().trim().min(1).max(20),
        descricao: z.string().trim().min(1).max(500),
        ferramenta: z.string().nullable().optional(),
        dependeDe: z.array(z.string()).max(MAX_ETAPAS_PLANO).optional(),
      }),
    )
    .min(1)
    .max(MAX_ETAPAS_PLANO),
});

/** Plano usado quando o planejador falha: o executor resolve sozinho. */
export function planoPadrao(pedido: string): Plano {
  return {
    objetivo: pedido.slice(0, 500),
    etapas: [
      {
        chave: 'e1',
        descricao: 'Levantar as informações necessárias com as ferramentas',
        ferramenta: null,
        dependeDe: [],
      },
      { chave: 'e2', descricao: 'Responder ao usuário', ferramenta: null, dependeDe: ['e1'] },
    ],
  };
}

/**
 * Normaliza o plano do modelo: descarta ferramentas inexistentes, chaves
 * repetidas e dependências que não apontam para uma etapa ANTERIOR (o que
 * também elimina ciclos). Devolve `null` se não sobrar nada utilizável.
 */
export function normalizarPlano(bruto: unknown, ferramentasValidas: Set<string>): Plano | null {
  const lido = ESQUEMA.safeParse(bruto);
  if (!lido.success) return null;
  const vistas = new Set<string>();
  const etapas: EtapaPlano[] = [];
  for (const e of lido.data.etapas) {
    if (vistas.has(e.chave)) continue;
    const ferramenta = e.ferramenta && ferramentasValidas.has(e.ferramenta) ? e.ferramenta : null;
    etapas.push({
      chave: e.chave,
      descricao: e.descricao,
      ferramenta,
      dependeDe: [...new Set((e.dependeDe ?? []).filter((d) => vistas.has(d)))],
    });
    vistas.add(e.chave);
  }
  return etapas.length ? { objetivo: lido.data.objetivo, etapas } : null;
}

/** O plano em texto, para o system do executor. */
export function planoEmTexto(p: Plano): string {
  const linhas = p.etapas.map((e) => {
    const dep = e.dependeDe.length ? ` (depois de ${e.dependeDe.join(', ')})` : '';
    const ferr = e.ferramenta ? ` [${e.ferramenta}]` : '';
    return `${e.chave}. ${e.descricao}${ferr}${dep}`;
  });
  return `Objetivo: ${p.objetivo}\n${linhas.join('\n')}`;
}

@Injectable()
export class PlanejadorService {
  private readonly logger = new Logger(PlanejadorService.name);

  constructor(
    private readonly ai: AiService,
    private readonly registro: RegistroFerramentasService,
  ) {}

  /**
   * Gera o plano a partir da mesma conversa que o executor vai receber. Nunca
   * lança: sem plano válido, devolve o plano padrão e o executor decide.
   */
  async planejar(
    user: AuthenticatedUser,
    pedido: string,
    mensagens: MensagemComFerramentas[],
    /** Conversa restrita ao repositório: o plano não conta com web nem contas conectadas. */
    somenteRepositorio = false,
  ): Promise<{ plano: Plano; padrao: boolean; usage?: LlmUsage }> {
    const definicoes = this.registro.definicoes(
      somenteRepositorio
        ? this.registro.perfis().filter((f) => !f.dadosExternos).map((f) => f.nome)
        : undefined,
    );
    try {
      const r = await this.ai.completarComFerramentas(user.empresaId, user.id, {
        system: systemPlanejador(definicoes),
        mensagens,
        ferramentas: [],
        maxTokens: 1200,
        fonte: 'orquestrador-plano',
        semDiretrizes: true,
      });
      const plano = normalizarPlano(
        extrairJson(r.texto),
        new Set(definicoes.map((d) => d.nome)),
      );
      if (!plano) {
        this.logger.warn(`Plano fora do formato, usando o padrão: ${r.texto.slice(0, 200)}`);
        return { plano: planoPadrao(pedido), padrao: true, usage: r.usage };
      }
      return { plano, padrao: false, usage: r.usage };
    } catch (err) {
      this.logger.warn(`Falha no planejador, usando o plano padrão: ${String(err)}`);
      return { plano: planoPadrao(pedido), padrao: true };
    }
  }
}
