// Contrato de uma ferramenta do orquestrador: o que o modelo vê (nome,
// descrição, esquema) e o que a política de execução vai consultar (risco e
// permissão exigida). O esquema zod é a fonte única: dele sai o JSON Schema
// mandado ao modelo e a validação da entrada antes de executar.
import type { z } from 'zod';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import type { Fonte } from '@/ai/prompt.service';

/**
 * Quanto uma ferramenta pode afetar o mundo:
 * - `leitura`: só consulta (memória, web, agentes). Nenhum efeito.
 * - `escrita_interna`: altera dados do próprio Oracle (ex.: salvar nota).
 * - `escrita_externa`: age fora do Oracle (ex.: mandar mensagem no Slack).
 * Escritas vão exigir aprovação; nesta etapa só existem ferramentas de leitura.
 */
export type NivelRisco = 'leitura' | 'escrita_interna' | 'escrita_externa';

/** Quem pede e onde: tudo vem do JWT e dos headers já resolvidos. */
export interface ContextoFerramenta {
  user: AuthenticatedUser;
  organizacaoId: string | null;
  repositorioId: string | null;
  /**
   * Agentes do sistema que a interface exibe (curadoria do front, em
   * `configs/oracleModules.ts`). Ausente/null = todos. É preferência de
   * produto, não fronteira de segurança: ocultar não é proibir.
   */
  agentesSistema?: string[] | null;
  /**
   * Conversa restrita ao repositório (modo "Buscar no seu Repositório", usado
   * também pelos insights e pelo briefing): ferramentas com `dadosExternos`
   * ficam de fora.
   */
  somenteRepositorio?: boolean;
  /**
   * Onde esta chamada está sendo executada. Preenchido SÓ pelo executor
   * (nunca pela entrada do modelo: os esquemas das ferramentas que o usam são
   * `.strict()`). O gateway desktop prova a aprovação com isto (SR-07).
   */
  execucao?: { id: string; etapaId: string; aprovacaoId?: string };
}

/** Resultado de uma avaliação dinâmica (depende da entrada e do estado). */
export interface AvaliacaoDinamica {
  decisao: 'permitir' | 'aprovar' | 'negar';
  /** Rótulo de risco gravado na aprovação (ex.: `alto`). */
  risco: string;
  motivo?: string;
  /** Validade do pedido de aprovação, se diferente do padrão. */
  validadeAprovacaoMs?: number;
  /** Complemento do resumo da aprovação (ex.: caminho real do app, GA-09). */
  detalhe?: string;
}

export interface SaidaFerramenta {
  /** Texto devolvido ao modelo como resultado da chamada. */
  conteudo: string;
  /** Fontes usadas, para a resposta final poder citá-las. */
  fontes?: Fonte[];
}

export interface Ferramenta<S extends z.ZodType = z.ZodType> {
  /** Identificador visto pelo modelo: letras, números, `_` e `-`. */
  nome: string;
  /** Quando usar e o que devolve — é o que o modelo lê para escolher. */
  descricao: string;
  esquema: S;
  risco: NivelRisco;
  /** Código do catálogo de permissões (`acesso/permissoes.catalog.ts`). */
  permissao: string;
  /**
   * Traz dados de FORA do repositório (internet, e-mail, agenda, Drive).
   * Fica indisponível nas conversas restritas ao repositório.
   */
  dadosExternos?: boolean;
  executar(entrada: z.output<S>, ctx: ContextoFerramenta): Promise<SaidaFerramenta>;
  /**
   * Frase que o usuário lê no pedido de aprovação ("Salvar 'Plano.md' no
   * Repositório…"). Obrigatória em escritas; leituras não pedem aprovação.
   */
  resumir?(entrada: z.output<S>): string;
  /**
   * Política que depende da ENTRADA e do estado (ex.: desktop). Roda depois
   * da checagem estática de permissão, que continua mandando no "negar".
   * Quando existe, decide entre executar direto, pedir aprovação ou negar.
   */
  avaliar?(
    entrada: z.output<S>,
    ctx: ContextoFerramenta & { execucao: { id: string; etapaId: string } },
  ): Promise<AvaliacaoDinamica>;
  /** Versão da entrada que pode ir para etapa/auditoria (SR-40). */
  redigir?(entrada: z.output<S>): Record<string, unknown>;
  /** Versão da saída que pode ser gravada na etapa (SR-40/GA-04). */
  redigirSaida?(conteudo: string): string;
}

/**
 * Falha esperada de uma ferramenta, com mensagem escrita PARA O MODELO (ex.:
 * "agente não existe, use listar_agentes"). Qualquer outro erro vira só
 * "falha interna" no resultado — o detalhe fica no log.
 */
export class ErroFerramenta extends Error {}

/** Só para inferir o tipo da entrada a partir do esquema. */
export function definirFerramenta<S extends z.ZodType>(f: Ferramenta<S>): Ferramenta<S> {
  return f;
}
