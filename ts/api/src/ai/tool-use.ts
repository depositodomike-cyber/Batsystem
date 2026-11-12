// Tool use (chamada de ferramentas pelo modelo) num formato NEUTRO, que não é
// nem o da Anthropic nem o da OpenAI. O histórico de uma execução fica neste
// formato e é convertido a cada turno para o provedor da vez — por isso o
// failover pode trocar de provedor entre um turno e outro sem perder nada.
//
// Este arquivo só converte e interpreta. Quem executa a ferramenta e devolve o
// resultado é o chamador (o executor do orquestrador). Um turno = uma chamada
// ao modelo; o loop "modelo → ferramenta → modelo" não mora aqui.
import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import type { LlmUsage } from './providers';
import { sanitizarUnicode } from './texto-seguro';

/** Uma ferramenta que o modelo pode pedir para chamar. */
export interface DefinicaoFerramenta {
  /** Identificador: letras, números, `_` e `-`, até 64 caracteres. */
  nome: string;
  /** Quando usar e o que a ferramenta devolve — é o que o modelo lê. */
  descricao: string;
  /** JSON Schema (type: object) dos argumentos. */
  parametros: Record<string, unknown>;
}

export type BlocoConversa =
  | { tipo: 'texto'; texto: string }
  /** O modelo pediu uma ferramenta (só em mensagens do assistente). */
  | { tipo: 'chamada'; id: string; nome: string; entrada: Record<string, unknown> }
  /** Resultado de uma chamada (só em mensagens do usuário). */
  | { tipo: 'resultado'; idChamada: string; conteudo: string; erro?: boolean };

export interface MensagemComFerramentas {
  papel: 'user' | 'assistant';
  blocos: BlocoConversa[];
}

/**
 * `auto`: o modelo decide; `obrigatoria`: tem de chamar alguma; `nenhuma`: só
 * texto (útil no último turno, para forçar a resposta final).
 */
export type EscolhaFerramenta = 'auto' | 'obrigatoria' | 'nenhuma';

export interface LlmToolsParams {
  apiKey: string;
  model: string;
  system: string;
  mensagens: MensagemComFerramentas[];
  ferramentas: DefinicaoFerramenta[];
  maxTokens: number;
  escolha?: EscolhaFerramenta;
}

export interface ChamadaFerramenta {
  id: string;
  nome: string;
  entrada: Record<string, unknown>;
  /**
   * Os argumentos vieram como JSON inválido (acontece na OpenAI). A entrada
   * fica vazia e o chamador deve devolver um resultado de erro, sem executar.
   */
  argumentosInvalidos?: string;
}

/** Por que o modelo parou: respondeu, quer ferramenta, estourou ou recusou. */
export type MotivoParada = 'fim' | 'ferramenta' | 'limite' | 'recusa';

export interface LlmToolsResult {
  /** Texto do turno (pode vir junto com chamadas). */
  texto: string;
  chamadas: ChamadaFerramenta[];
  parada: MotivoParada;
  usage?: LlmUsage;
  /** O turno do assistente, pronto para entrar no histórico. */
  mensagem: MensagemComFerramentas;
}

const NOME_VALIDO = /^[a-zA-Z0-9_-]{1,64}$/;

/** Erro de programação, não do usuário: falha cedo, antes de gastar tokens. */
export function validarFerramentas(ferramentas: DefinicaoFerramenta[]): void {
  const vistos = new Set<string>();
  for (const f of ferramentas) {
    if (!NOME_VALIDO.test(f.nome)) {
      throw new Error(`Nome de ferramenta inválido: "${f.nome}"`);
    }
    if (vistos.has(f.nome)) {
      throw new Error(`Ferramenta duplicada: "${f.nome}"`);
    }
    if (f.parametros.type !== 'object') {
      throw new Error(`Parâmetros de "${f.nome}" precisam ser um JSON Schema type: object`);
    }
    vistos.add(f.nome);
  }
}

/** Blocos de texto vazios são rejeitados pela Anthropic; saem antes. */
function textoUtil(b: BlocoConversa): boolean {
  return b.tipo !== 'texto' || b.texto.trim() !== '';
}

// ---------- Anthropic ----------

export function ferramentasAnthropic(
  ferramentas: DefinicaoFerramenta[],
): Anthropic.Tool[] {
  return ferramentas.map((f) => ({
    name: f.nome,
    description: f.descricao,
    input_schema: f.parametros as Anthropic.Tool.InputSchema,
  }));
}

export function escolhaAnthropic(e: EscolhaFerramenta): Anthropic.ToolChoice {
  return e === 'obrigatoria' ? { type: 'any' } : e === 'nenhuma' ? { type: 'none' } : { type: 'auto' };
}

export function mensagensAnthropic(
  mensagens: MensagemComFerramentas[],
): Anthropic.MessageParam[] {
  return mensagens
    .map((m) => ({
      role: m.papel,
      content: m.blocos.filter(textoUtil).map((b): Anthropic.ContentBlockParam => {
        switch (b.tipo) {
          case 'texto':
            return { type: 'text', text: sanitizarUnicode(b.texto) };
          case 'chamada':
            return { type: 'tool_use', id: b.id, name: b.nome, input: b.entrada };
          case 'resultado':
            return {
              type: 'tool_result',
              tool_use_id: b.idChamada,
              content: sanitizarUnicode(b.conteudo),
              ...(b.erro ? { is_error: true } : {}),
            };
        }
      }),
    }))
    .filter((m) => m.content.length > 0);
}

export function respostaAnthropic(msg: Anthropic.Message): LlmToolsResult {
  const blocos: BlocoConversa[] = [];
  const chamadas: ChamadaFerramenta[] = [];
  for (const b of msg.content) {
    if (b.type === 'text') {
      blocos.push({ tipo: 'texto', texto: b.text });
    } else if (b.type === 'tool_use') {
      const entrada =
        b.input && typeof b.input === 'object' ? (b.input as Record<string, unknown>) : {};
      chamadas.push({ id: b.id, nome: b.name, entrada });
      blocos.push({ tipo: 'chamada', id: b.id, nome: b.name, entrada });
    }
  }
  const parada: MotivoParada =
    msg.stop_reason === 'tool_use'
      ? 'ferramenta'
      : msg.stop_reason === 'max_tokens'
        ? 'limite'
        : msg.stop_reason === 'refusal'
          ? 'recusa'
          : 'fim';
  return {
    texto: blocos
      .filter((b): b is { tipo: 'texto'; texto: string } => b.tipo === 'texto')
      .map((b) => b.texto)
      .join(''),
    chamadas,
    parada,
    mensagem: { papel: 'assistant', blocos },
  };
}

// ---------- OpenAI (Chat Completions) ----------

export function ferramentasOpenAi(
  ferramentas: DefinicaoFerramenta[],
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return ferramentas.map((f) => ({
    type: 'function',
    function: { name: f.nome, description: f.descricao, parameters: f.parametros },
  }));
}

export function escolhaOpenAi(
  e: EscolhaFerramenta,
): OpenAI.Chat.Completions.ChatCompletionToolChoiceOption {
  return e === 'obrigatoria' ? 'required' : e === 'nenhuma' ? 'none' : 'auto';
}

/**
 * Na OpenAI os resultados não são blocos da mensagem do usuário: cada um é
 * uma mensagem `role: tool`, e precisam vir logo depois do assistente que fez
 * as chamadas. O texto que acompanhava os resultados vira uma mensagem de
 * usuário em seguida.
 */
export function mensagensOpenAi(
  system: string,
  mensagens: MensagemComFerramentas[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const saida: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: sanitizarUnicode(system) },
  ];
  for (const m of mensagens) {
    const texto = m.blocos
      .filter((b): b is { tipo: 'texto'; texto: string } => b.tipo === 'texto')
      .map((b) => sanitizarUnicode(b.texto))
      .join('\n\n')
      .trim();
    if (m.papel === 'assistant') {
      const chamadas = m.blocos.filter(
        (b): b is Extract<BlocoConversa, { tipo: 'chamada' }> => b.tipo === 'chamada',
      );
      if (!texto && chamadas.length === 0) continue;
      saida.push({
        role: 'assistant',
        content: texto || null,
        ...(chamadas.length
          ? {
              tool_calls: chamadas.map((c) => ({
                id: c.id,
                type: 'function' as const,
                function: { name: c.nome, arguments: JSON.stringify(c.entrada) },
              })),
            }
          : {}),
      });
      continue;
    }
    for (const b of m.blocos) {
      if (b.tipo === 'resultado') {
        saida.push({
          role: 'tool',
          tool_call_id: b.idChamada,
          // A OpenAI não tem flag de erro: o prefixo leva a informação.
          content: sanitizarUnicode(b.erro ? `ERRO: ${b.conteudo}` : b.conteudo),
        });
      }
    }
    if (texto) saida.push({ role: 'user', content: texto });
  }
  return saida;
}

export function respostaOpenAi(
  res: OpenAI.Chat.Completions.ChatCompletion,
): LlmToolsResult {
  const choice = res.choices[0];
  const texto = choice?.message?.content || '';
  const chamadas: ChamadaFerramenta[] = [];
  for (const tc of choice?.message?.tool_calls ?? []) {
    if (tc.type !== 'function') continue;
    const bruto = tc.function.arguments || '{}';
    try {
      const v: unknown = JSON.parse(bruto);
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        chamadas.push({ id: tc.id, nome: tc.function.name, entrada: v as Record<string, unknown> });
      } else {
        chamadas.push({ id: tc.id, nome: tc.function.name, entrada: {}, argumentosInvalidos: bruto });
      }
    } catch {
      chamadas.push({ id: tc.id, nome: tc.function.name, entrada: {}, argumentosInvalidos: bruto });
    }
  }
  const motivo = choice?.finish_reason;
  const parada: MotivoParada =
    chamadas.length > 0 || motivo === 'tool_calls'
      ? 'ferramenta'
      : motivo === 'length'
        ? 'limite'
        : motivo === 'content_filter'
          ? 'recusa'
          : 'fim';
  const blocos: BlocoConversa[] = [
    ...(texto ? [{ tipo: 'texto' as const, texto }] : []),
    ...chamadas.map((c) => ({
      tipo: 'chamada' as const,
      id: c.id,
      nome: c.nome,
      entrada: c.entrada,
    })),
  ];
  return {
    texto,
    chamadas,
    parada,
    usage: res.usage
      ? { entrada: res.usage.prompt_tokens || 0, saida: res.usage.completion_tokens || 0 }
      : undefined,
    mensagem: { papel: 'assistant', blocos },
  };
}
