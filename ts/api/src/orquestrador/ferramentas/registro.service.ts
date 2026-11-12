import { HttpException, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { DefinicaoFerramenta } from '@/ai/tool-use';
import type { Fonte } from '@/ai/prompt.service';
import { PERMISSOES_VALIDAS } from '@/acesso/permissoes.catalog';
import { FerramentasLeitura } from './leitura';
import { FerramentasEscrita } from './escrita';
import { FerramentasGeracao } from './geracao';
import { FerramentasConectores } from './conectores';
import { FerramentasWeb } from './web';
import { FerramentasDesktop } from './desktop';
import {
  ErroFerramenta,
  type AvaliacaoDinamica,
  type ContextoFerramenta,
  type Ferramenta,
  type NivelRisco,
} from './ferramenta';

/** Teto do texto devolvido ao modelo por chamada — protege o contexto. */
export const MAX_CONTEUDO_FERRAMENTA = 20_000;

export type ResultadoFerramenta =
  | { ok: true; conteudo: string; fontes: Fonte[] }
  | { ok: false; erro: string };

/** O que a política de execução precisa saber de uma ferramenta. */
export interface PerfilFerramenta {
  nome: string;
  risco: NivelRisco;
  permissao: string;
  /** Traz dados de fora do repositório (web, contas conectadas). */
  dadosExternos: boolean;
}

/**
 * Registro das ferramentas que o orquestrador pode oferecer ao modelo.
 *
 * `executar` nunca lança: entrada inválida, ferramenta desconhecida ou falha
 * interna viram `{ ok: false }`, que o executor devolve ao modelo como
 * resultado de erro — o modelo pode corrigir a chamada ou seguir sem ela.
 *
 * Este registro NÃO autoriza nada. Risco e permissão ficam declarados aqui
 * para a PoliticaExecucaoService decidir antes de chamar; quem chama
 * `executar` (o executor) é responsável por ter consultado a política.
 */
@Injectable()
export class RegistroFerramentasService {
  private readonly logger = new Logger(RegistroFerramentasService.name);
  private readonly ferramentas = new Map<string, Ferramenta>();

  constructor(
    leitura: FerramentasLeitura,
    escrita: FerramentasEscrita,
    geracao: FerramentasGeracao,
    conectores: FerramentasConectores,
    web: FerramentasWeb,
    /** Opcional: specs antigos constroem o registro sem o desktop. */
    desktop?: FerramentasDesktop,
  ) {
    for (const f of [
      ...leitura.todas(),
      ...web.todas(),
      ...conectores.todas(),
      ...geracao.todas(),
      ...escrita.todas(),
      ...(desktop?.todas() ?? []),
    ]) {
      this.registrar(f);
    }
  }

  private registrar(f: Ferramenta): void {
    if (this.ferramentas.has(f.nome)) {
      throw new Error(`Ferramenta registrada duas vezes: ${f.nome}`);
    }
    if (f.risco !== 'leitura' && !f.resumir) {
      throw new Error(`Ferramenta de escrita sem resumo para aprovação: ${f.nome}`);
    }
    if (!PERMISSOES_VALIDAS.includes(f.permissao)) {
      throw new Error(`Permissão desconhecida em ${f.nome}: ${f.permissao}`);
    }
    this.ferramentas.set(f.nome, f);
  }

  /** Nome, risco e permissão de cada ferramenta (para política e auditoria). */
  perfis(): PerfilFerramenta[] {
    return [...this.ferramentas.values()].map(({ nome, risco, permissao, dadosExternos }) => ({
      nome,
      risco,
      permissao,
      dadosExternos: !!dadosExternos,
    }));
  }

  perfil(nome: string): PerfilFerramenta | undefined {
    const f = this.ferramentas.get(nome);
    return f && { nome: f.nome, risco: f.risco, permissao: f.permissao, dadosExternos: !!f.dadosExternos };
  }

  /**
   * Definições no formato neutro do tool use. `nomes` restringe o conjunto
   * (o executor oferece só o que a política liberou).
   */
  definicoes(nomes?: string[]): DefinicaoFerramenta[] {
    const escolhidas = nomes
      ? nomes.map((n) => this.ferramentas.get(n)).filter((f): f is Ferramenta => !!f)
      : [...this.ferramentas.values()];
    return escolhidas.map((f) => {
      const { $schema: _descartado, ...parametros } = z.toJSONSchema(f.esquema) as Record<
        string,
        unknown
      >;
      return { nome: f.nome, descricao: f.descricao, parametros };
    });
  }

  /**
   * Valida a entrada SEM executar e devolve a versão normalizada (a que vai
   * para o pedido de aprovação e, depois, para a execução) com o resumo
   * legível. Usado antes de pedir aprovação de uma escrita.
   */
  preparar(
    nome: string,
    entrada: unknown,
  ): { ok: true; entrada: Record<string, unknown>; resumo: string } | { ok: false; erro: string } {
    const f = this.ferramentas.get(nome);
    if (!f) return { ok: false, erro: `Ferramenta desconhecida: ${nome}.` };
    const validada = f.esquema.safeParse(entrada);
    if (!validada.success) {
      return {
        ok: false,
        erro: `Argumentos inválidos para ${nome}:\n${z.prettifyError(validada.error)}`,
      };
    }
    const dados = validada.data as Record<string, unknown>;
    return { ok: true, entrada: dados, resumo: f.resumir?.(dados) ?? `Executar ${nome}.` };
  }

  /**
   * Política dinâmica da ferramenta (depende da entrada e do estado). Sem
   * `avaliar`, devolve null e vale só a política estática. Entrada inválida
   * ou falha da avaliação = negar (falha fechada).
   */
  async avaliar(
    nome: string,
    entrada: unknown,
    ctx: ContextoFerramenta & { execucao: { id: string; etapaId: string } },
  ): Promise<AvaliacaoDinamica | null> {
    const f = this.ferramentas.get(nome);
    if (!f?.avaliar) return null;
    const validada = f.esquema.safeParse(entrada);
    if (!validada.success) {
      return { decisao: 'negar', risco: 'bloqueado', motivo: `Argumentos inválidos para ${nome}:
${z.prettifyError(validada.error)}` };
    }
    try {
      return await f.avaliar(validada.data, ctx);
    } catch (err) {
      this.logger.warn(`Falha na avaliação de ${nome}: ${String(err)}`);
      return { decisao: 'negar', risco: 'bloqueado', motivo: 'A camada de segurança não conseguiu avaliar esta ação; ela não foi executada.' };
    }
  }

  /** Entrada que pode ir para etapa/auditoria (SR-40). */
  redigir(nome: string, entrada: unknown): unknown {
    const f = this.ferramentas.get(nome);
    if (!f?.redigir) return entrada;
    const v = f.esquema.safeParse(entrada);
    return v.success ? f.redigir(v.data) : { invalida: true };
  }

  /** Saída que pode ser gravada na etapa (SR-40/GA-04). */
  redigirSaida(nome: string, conteudo: string): string {
    return this.ferramentas.get(nome)?.redigirSaida?.(conteudo) ?? conteudo;
  }

  async executar(
    nome: string,
    entrada: unknown,
    ctx: ContextoFerramenta,
  ): Promise<ResultadoFerramenta> {
    const f = this.ferramentas.get(nome);
    if (!f) return { ok: false, erro: `Ferramenta desconhecida: ${nome}.` };

    const validada = f.esquema.safeParse(entrada);
    if (!validada.success) {
      return {
        ok: false,
        erro: `Argumentos inválidos para ${nome}:\n${z.prettifyError(validada.error)}`,
      };
    }

    try {
      const saida = await f.executar(validada.data, ctx);
      let conteudo = saida.conteudo;
      if (conteudo.length > MAX_CONTEUDO_FERRAMENTA) {
        conteudo =
          conteudo.slice(0, MAX_CONTEUDO_FERRAMENTA) +
          '\n\n[Resultado cortado por tamanho.]';
      }
      return { ok: true, conteudo, fontes: saida.fontes ?? [] };
    } catch (err) {
      // Mensagens de HttpException são escritas para o usuário (ex.: "Nenhuma
      // IA conectada") e as de ErroFerramenta, para o modelo; o resto é
      // detalhe interno e fica só no log.
      if (err instanceof HttpException || err instanceof ErroFerramenta) {
        return { ok: false, erro: err.message };
      }
      this.logger.warn(`Falha ao executar ${nome}: ${String(err)}`);
      return { ok: false, erro: `Falha interna ao executar ${nome}.` };
    }
  }
}
