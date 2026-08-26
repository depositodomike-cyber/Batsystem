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
  /** Confere a chave junto ao provedor. Nunca lança: classifica o resultado. */
  validateKey(apiKey: string): Promise<KeyCheck>;
}

// ---------- Checagem de chave ----------

/**
 * Resultado de conferir uma chave junto ao provedor.
 *
 * São três estados, e não um booleano, porque "não deu para conferir" é
 * diferente de "o provedor recusou". Só o segundo justifica barrar o cadastro;
 * tratar os dois como o mesmo `false` deixava o usuário sem conseguir conectar
 * chave boa quando a checagem esbarrava em rede, cota ou escopo da chave.
 */
export type KeyCheck =
  | { status: 'valida' }
  /** O provedor autenticou a requisição e recusou a chave (401). */
  | { status: 'invalida'; detalhe: string }
  /** Rede, cota, escopo restrito ou instabilidade — inconclusivo. */
  | { status: 'indeterminada'; detalhe: string };

/**
 * Frase legível dentro do corpo de erro dos dois SDKs. A Anthropic aninha em
 * `{ error: { message } }` e a OpenAI devolve `{ message }` direto; sem isso o
 * `err.message` chega ao usuário como o JSON cru da resposta.
 */
function mensagemDoCorpo(corpo: unknown): string | undefined {
  if (!corpo || typeof corpo !== 'object') return undefined;
  const erro = (corpo as { error?: unknown }).error ?? corpo;
  if (!erro || typeof erro !== 'object') return undefined;
  const msg = (erro as { message?: unknown }).message;
  return typeof msg === 'string' && msg.trim() ? msg.trim() : undefined;
}

/** Erro de qualquer um dos dois SDKs, normalizado em status HTTP + mensagem. */
function detalharErro(err: unknown): { http?: number; detalhe: string } {
  if (err instanceof Anthropic.APIError || err instanceof OpenAI.APIError) {
    return { http: err.status, detalhe: mensagemDoCorpo(err.error) ?? err.message };
  }
  if (err instanceof Error) return { detalhe: err.message };
  return { detalhe: String(err) };
}

/** Mensagens de cota/crédito: a chave é boa, mas o uso vai falhar mesmo assim. */
function pareceCota(detalhe: string): boolean {
  return /credit|balance|quota|billing|payment/i.test(detalhe);
}

/**
 * Traduz a falha de UMA chamada autenticada em veredito sobre a chave.
 *
 * O único status que prova chave ruim é 401. 400/404/413/422/429 significam que
 * a requisição chegou autenticada e travou por outro motivo (parâmetro, limite
 * de taxa) — a chave serve. 403 costuma ser escopo restrito da chave ou bloqueio
 * regional: inconclusivo, não recusado.
 */
function classificar(err: unknown): KeyCheck {
  const { http, detalhe } = detalharErro(err);
  if (http === 401) return { status: 'invalida', detalhe };
  if (http === 400 || http === 429) {
    // Sem crédito o provedor responde 400/429 com a chave já autenticada: é
    // chave válida, mas vale avisar antes que o primeiro chat falhe.
    return pareceCota(detalhe)
      ? { status: 'indeterminada', detalhe }
      : { status: 'valida' };
  }
  if (http === 404 || http === 413 || http === 422) return { status: 'valida' };
  return { status: 'indeterminada', detalhe };
}

/**
 * Última palavra sobre a chave: uma inferência mínima (1 token).
 *
 * `models.list()` exige um escopo próprio de leitura de modelos, que chaves
 * restritas não têm — elas geram texto normalmente e mesmo assim tomavam 401 na
 * listagem. Quando a listagem falha, quem decide é esta sonda; a mensagem da
 * listagem só sobrevive como detalhe caso a sonda também seja inconclusiva.
 */
async function sondarInferencia(
  chamada: () => Promise<unknown>,
  detalheDaListagem: string,
): Promise<KeyCheck> {
  try {
    await chamada();
    return { status: 'valida' };
  } catch (err) {
    const sonda = classificar(err);
    if (sonda.status !== 'indeterminada') return sonda;
    return { status: 'indeterminada', detalhe: sonda.detalhe || detalheDaListagem };
  }
}

/** Cliente da checagem: falha rápido em vez de segurar o cadastro por minutos. */
const CHECAGEM = { maxRetries: 1, timeout: 20_000 } as const;

/** Modelo mais barato de cada provedor, usado só como sonda de autenticação. */
const MODELO_SONDA = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
} as const;

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

  async validateKey(apiKey: string): Promise<KeyCheck> {
    const client = new Anthropic({ apiKey, ...CHECAGEM });
    try {
      // Grátis e sem gastar token — o caminho normal para uma chave comum.
      await client.models.list({ limit: 1 });
      return { status: 'valida' };
    } catch (err) {
      const pelaListagem = classificar(err);
      if (pelaListagem.status === 'valida') return pelaListagem;
      return sondarInferencia(
        () =>
          client.messages.create({
            model: MODELO_SONDA.anthropic,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        pelaListagem.detalhe,
      );
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

  async validateKey(apiKey: string): Promise<KeyCheck> {
    const client = new OpenAI({ apiKey, ...CHECAGEM });
    try {
      await client.models.list();
      return { status: 'valida' };
    } catch (err) {
      const pelaListagem = classificar(err);
      if (pelaListagem.status === 'valida') return pelaListagem;
      // Chave de projeto/restrita sem o escopo `model.read` toma 401 aqui e
      // ainda assim gera texto: quem decide é a sonda.
      return sondarInferencia(
        () =>
          client.chat.completions.create({
            model: MODELO_SONDA.openai,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        pelaListagem.detalhe,
      );
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
