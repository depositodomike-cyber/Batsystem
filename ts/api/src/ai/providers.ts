import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { AiProvider } from '@prisma/client';
import { sanitizarUnicode } from './texto-seguro';

/** Tokens consumidos por uma chamada ao modelo (entrada inclui cache). */
export interface LlmUsage {
  entrada: number;
  saida: number;
}

export interface LlmStreamParams {
  apiKey: string;
  model: string;
  system: string;
  messages: { role: 'user' | 'assistant'; text: string }[];
  /**
   * Chamado uma vez, ao final do stream, com o consumo de tokens da resposta.
   * Best-effort: se o provedor não expuser usage, simplesmente não é chamado.
   */
  onUsage?: (usage: LlmUsage) => void;
}

export interface LlmCompleteParams {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}

export interface LlmCompleteResult {
  text: string;
  /** true quando a resposta foi cortada por atingir o limite de tokens. */
  truncated: boolean;
  /** Tokens consumidos, quando o provedor os expõe. */
  usage?: LlmUsage;
}

/** Fonte da web citada por uma resposta com busca. */
export interface WebFonte {
  titulo: string;
  url: string;
}

export interface LlmWebResult {
  text: string;
  /** Páginas citadas pela resposta (deduplicadas por URL). */
  fontes: WebFonte[];
  truncated: boolean;
  /** Tokens consumidos, quando o provedor os expõe. */
  usage?: LlmUsage;
}

export interface LlmProvider {
  /** Streaming de texto da resposta. */
  streamChat(params: LlmStreamParams): AsyncGenerator<string>;
  /** Resposta única (não-streaming) para relatórios longos, ex.: Análise. */
  complete(params: LlmCompleteParams): Promise<LlmCompleteResult>;
  /**
   * Resposta única com busca na web (fontes citadas). Opcional: nem todo
   * provedor oferece busca — quem não implementa cai no `complete` sem fontes.
   */
  completeWeb?(params: LlmCompleteParams): Promise<LlmWebResult>;
  /** true se a chave autentica; false se inválida (401); lança em outros erros. */
  validateKey(apiKey: string): Promise<boolean>;
}

/**
 * Último filtro antes do texto virar JSON de request. Textos montados a partir
 * de notas, anexos e referências do usuário podem conter surrogates órfãos
 * (ver texto-seguro.ts) — a API responderia 400 "no low surrogate in string".
 */
function sanear<T extends LlmStreamParams | LlmCompleteParams>(p: T): T {
  return {
    ...p,
    system: sanitizarUnicode(p.system),
    ...('user' in p ? { user: sanitizarUnicode(p.user) } : {}),
    ...('messages' in p
      ? { messages: p.messages.map((m) => ({ ...m, text: sanitizarUnicode(m.text) })) }
      : {}),
  };
}

// ---------- Anthropic (Claude) ----------

/** Extrai o usage de uma resposta do SDK Anthropic (entrada = input + cache). */
function anthropicUsage(usage?: {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): LlmUsage | undefined {
  if (!usage) return undefined;
  return {
    entrada:
      (usage.input_tokens || 0) +
      (usage.cache_read_input_tokens || 0) +
      (usage.cache_creation_input_tokens || 0),
    saida: usage.output_tokens || 0,
  };
}

class AnthropicProvider implements LlmProvider {
  async *streamChat(params: LlmStreamParams) {
    const { apiKey, model, system, messages, onUsage } = sanear(params);
    const client = new Anthropic({ apiKey });
    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
    });
    // O usage chega em partes: input no `message_start`, output (cumulativo) no
    // `message_delta`. Acumulamos e reportamos uma vez ao final.
    let entrada = 0;
    let saida = 0;
    for await (const event of stream) {
      if (event.type === 'message_start') {
        const u = anthropicUsage(event.message.usage);
        if (u) {
          entrada = u.entrada;
          saida = u.saida;
        }
      } else if (event.type === 'message_delta') {
        if (event.usage?.output_tokens != null) saida = event.usage.output_tokens;
      } else if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
    onUsage?.({ entrada, saida });
  }

  async complete(params: LlmCompleteParams): Promise<LlmCompleteResult> {
    const { apiKey, model, system, user, maxTokens } = sanear(params);
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return {
      text,
      truncated: msg.stop_reason === 'max_tokens',
      usage: anthropicUsage(msg.usage),
    };
  }

  async completeWeb(params: LlmCompleteParams): Promise<LlmWebResult> {
    const { apiKey, model, system, user, maxTokens } = sanear(params);
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: system }],
      messages: [{ role: 'user', content: user }],
      // Ferramenta de servidor da Anthropic: a busca é executada pela própria
      // API e as páginas usadas voltam como citações nos blocos de texto.
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Coleta as fontes: das citações dos blocos de texto e, como reforço, dos
    // blocos de resultado da própria ferramenta. Dedup por URL.
    const fontesMap = new Map<string, string>();
    for (const block of msg.content) {
      const cites = (block as {
        citations?: Array<{ type?: string; url?: string; title?: string | null }>;
      }).citations;
      if (Array.isArray(cites)) {
        for (const c of cites) {
          if (c.url) fontesMap.set(c.url, (c.title || c.url).trim());
        }
      }
      if ((block as { type?: string }).type === 'web_search_tool_result') {
        const results = (block as {
          content?: Array<{ url?: string; title?: string | null }>;
        }).content;
        if (Array.isArray(results)) {
          for (const r of results) {
            if (r.url && !fontesMap.has(r.url)) {
              fontesMap.set(r.url, (r.title || r.url).trim());
            }
          }
        }
      }
    }
    const fontes: WebFonte[] = [...fontesMap].map(([url, titulo]) => ({ titulo, url }));
    return {
      text,
      fontes,
      truncated: msg.stop_reason === 'max_tokens',
      usage: anthropicUsage(msg.usage),
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      await new Anthropic({ apiKey }).models.list();
      return true;
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) return false;
      throw err;
    }
  }
}

// ---------- OpenAI (GPT) ----------

class OpenAiProvider implements LlmProvider {
  async *streamChat(params: LlmStreamParams) {
    const { apiKey, model, system, messages, onUsage } = sanear(params);
    const client = new OpenAI({ apiKey });
    const stream = await client.chat.completions.create({
      model,
      stream: true,
      // Pede o bloco de usage no chunk final (senão o SDK não o inclui em stream).
      stream_options: { include_usage: true },
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role, content: m.text })),
      ],
    });
    let usage: LlmUsage | undefined;
    for await (const chunk of stream) {
      if (chunk.usage) {
        usage = {
          entrada: chunk.usage.prompt_tokens || 0,
          saida: chunk.usage.completion_tokens || 0,
        };
      }
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
    if (usage) onUsage?.(usage);
  }

  async complete(params: LlmCompleteParams): Promise<LlmCompleteResult> {
    const { apiKey, model, system, user, maxTokens } = sanear(params);
    const client = new OpenAI({ apiKey });
    const res = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const choice = res.choices[0];
    return {
      text: choice?.message?.content || '',
      truncated: choice?.finish_reason === 'length',
      usage: res.usage
        ? { entrada: res.usage.prompt_tokens || 0, saida: res.usage.completion_tokens || 0 }
        : undefined,
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      await new OpenAI({ apiKey }).models.list();
      return true;
    } catch (err) {
      if (err instanceof OpenAI.AuthenticationError) return false;
      throw err;
    }
  }
}

const PROVIDERS: Record<AiProvider, LlmProvider> = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAiProvider(),
};

export function getProvider(provider: AiProvider): LlmProvider {
  return PROVIDERS[provider];
}

// ---------- Catálogo exposto ao front ----------

export interface ProviderInfo {
  id: AiProvider;
  name: string;
  models: { id: string; name: string }[];
}

export const PROVIDER_CATALOG: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    models: [
      { id: 'claude-opus-4-8', name: 'Claude Opus 4.8' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
    ],
  },
];

/** Lista de modelos válidos por provedor (para validação leve). */
export function isKnownModel(provider: AiProvider, model: string): boolean {
  const info = PROVIDER_CATALOG.find((p) => p.id === provider);
  return !!info && info.models.some((m) => m.id === model);
}
