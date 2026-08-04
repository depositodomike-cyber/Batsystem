// Prompts do "Criar apresentação" — etapa 1 (roteiro editável). Portado, em
// espírito, do beculture/Confi (lib/claude.js). A IA devolve um roteiro em JSON
// estrito (slides ou capítulos), que o usuário edita antes de gerar o arquivo.
// O campo `conexoes` traz o bloco "## 🔗 Conexões no Vault" (conexoes-vault.ts),
// anexado à nota quando a apresentação é salva na Memória.

import {
  blocoTitulosVault,
  normalizarConexoes,
  regraConexoesVaultCampo,
} from '../conexoes-vault';

export type Formato = 'pptx' | 'slides-html' | 'book-html';
export type Tom = 'executivo' | 'didatico' | 'inspirador' | 'comercial' | 'tecnico';

export interface RoteiroInput {
  tema: string;
  formato: Formato;
  nSlides?: number; // 0 = a IA decide
  publico?: string;
  objetivo?: string;
  tom?: string;
  idioma?: string;
  referencia?: string;
  /** Títulos das notas do vault — alvos possíveis dos [[wikilinks]]. */
  titulosVault?: string[];
}

export interface SlideItem {
  titulo: string;
  bullets: string[];
  notas?: string;
}
export interface CapituloItem {
  titulo: string;
  paragrafos: string[];
}
export interface Roteiro {
  titulo: string;
  subtitulo: string;
  slides?: SlideItem[]; // formatos de slides
  capitulos?: CapituloItem[]; // book-html
  /** Bloco "## 🔗 Conexões no Vault" — anexado à nota ao salvar na Memória. */
  conexoes: string;
}

const TOM_LABEL: Record<string, string> = {
  executivo: 'Executivo (direto, foco em decisão e resultado)',
  didatico: 'Didático (explica com clareza, passo a passo)',
  inspirador: 'Inspirador (narrativa, visão, motivação)',
  comercial: 'Comercial (proposta de valor, benefícios, CTA)',
  tecnico: 'Técnico (preciso, com detalhes e dados)',
};

export const SYSTEM_ROTEIRO_SLIDES = `Você é um estrategista sênior de apresentações executivas, escrevendo em português do Brasil (salvo se outro idioma for pedido).
Sua tarefa é criar o ROTEIRO (estrutura editável) de uma apresentação de slides a partir de um tema e das variáveis do usuário.

Princípios:
- Uma ideia central por slide. Título curto e específico (não genérico).
- 3 a 5 bullets por slide, cada um objetivo e autossuficiente (sem encher linguiça).
- Comece por um slide de capa/abertura e termine por um slide de fechamento (síntese + próximos passos/CTA conforme o objetivo).
- Progressão lógica: contexto → problema/oportunidade → desenvolvimento → evidências → conclusão.
- Respeite o público, o objetivo e o tom informados. Seja concreto; evite floreio e obviedades.
- Em "notas", escreva 1–3 frases de apoio ao apresentador (o que falar naquele slide).
- Se REFERÊNCIAS forem fornecidas, use-as como base factual; não invente dados.

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{
  "titulo": "Título da apresentação",
  "subtitulo": "Subtítulo curto",
  "slides": [
    { "titulo": "Título do slide", "bullets": ["ponto 1", "ponto 2"], "notas": "apoio ao apresentador" }
  ],
  "conexoes": "O bloco de Conexões no Vault em Markdown"
}${regraConexoesVaultCampo('conexoes')}`;

export const SYSTEM_ROTEIRO_BOOK = `Você é um autor e editor sênior, escrevendo em português do Brasil (salvo se outro idioma for pedido). Escreva um GUIA/BOOK aprofundado sobre o tema — um documento de LEITURA (não slides), denso e bem estruturado em capítulos.

Princípios:
- Cada capítulo tem um título claro e vários parágrafos de texto corrido (prosa), não bullets.
- Progressão didática: fundamentos → desenvolvimento → aplicação → conclusão.
- Profundidade real: explique, exemplifique, contextualize. Nada de encher linguiça.
- Respeite público, objetivo e tom. Se houver REFERÊNCIAS, baseie-se nelas; não invente dados.

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{
  "titulo": "Título do guia",
  "subtitulo": "Subtítulo curto",
  "capitulos": [
    { "titulo": "Título do capítulo", "paragrafos": ["parágrafo 1", "parágrafo 2"] }
  ],
  "conexoes": "O bloco de Conexões no Vault em Markdown"
}${regraConexoesVaultCampo('conexoes')}`;

export function buildRoteiroUser(input: RoteiroInput): string {
  const {
    tema,
    formato,
    nSlides = 0,
    publico,
    objetivo,
    tom,
    idioma,
    referencia,
    titulosVault = [],
  } = input;
  const isBook = formato === 'book-html';
  const unidade = isBook ? 'capítulos' : 'slides';
  const qtd =
    nSlides && nSlides > 0
      ? `Gere aproximadamente ${nSlides} ${unidade}.`
      : `Você decide a quantidade de ${unidade} (priorize clareza; nem curto demais, nem inflado).`;
  const tomKey = tom && TOM_LABEL[tom] ? TOM_LABEL[tom] : tom || '(não informado)';
  return (
    `## VARIÁVEIS\n` +
    `- Tema: ${tema}\n` +
    `- Público-alvo: ${publico || '(não informado)'}\n` +
    `- Objetivo: ${objetivo || '(não informado — priorize clareza e decisão)'}\n` +
    `- Tom: ${tomKey}\n` +
    `- Idioma: ${idioma || 'Português do Brasil'}\n` +
    `- ${qtd}\n\n` +
    (referencia && referencia.trim()
      ? `## REFERÊNCIAS (baseie-se nelas; não invente)\n${referencia.slice(0, 20000)}\n\n`
      : '') +
    blocoTitulosVault(titulosVault) +
    `\nGere o roteiro agora, respondendo APENAS o JSON no formato especificado, com o campo "conexoes" preenchido.`
  );
}

/** Extrai e valida o JSON do roteiro devolvido pela IA. */
export function parseRoteiro(raw: string, formato: Formato): Roteiro {
  let txt = (raw || '').trim();
  // Remove cercas ```json ... ``` se a IA insistir.
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  // Recorta do primeiro { ao último } para tolerar preâmbulo/sufixo.
  const first = txt.indexOf('{');
  const last = txt.lastIndexOf('}');
  if (first >= 0 && last > first) txt = txt.slice(first, last + 1);
  let data: unknown;
  try {
    data = JSON.parse(txt);
  } catch {
    throw new Error('A IA não devolveu um roteiro válido. Tente novamente.');
  }
  const obj = (data ?? {}) as Record<string, unknown>;
  const titulo = String(obj.titulo || 'Apresentação').slice(0, 200);
  const subtitulo = String(obj.subtitulo || '').slice(0, 300);
  const conexoes = normalizarConexoes(String(obj.conexoes || ''));

  if (formato === 'book-html') {
    const caps = Array.isArray(obj.capitulos) ? obj.capitulos : [];
    const capitulos: CapituloItem[] = caps
      .map((c) => {
        const co = (c ?? {}) as Record<string, unknown>;
        const paragrafos = Array.isArray(co.paragrafos)
          ? co.paragrafos.map((p) => String(p)).filter(Boolean)
          : [];
        return { titulo: String(co.titulo || '').slice(0, 200), paragrafos };
      })
      .filter((c) => c.titulo || c.paragrafos.length);
    if (!capitulos.length) throw new Error('A IA não devolveu capítulos. Tente novamente.');
    return { titulo, subtitulo, capitulos, conexoes };
  }

  const arr = Array.isArray(obj.slides) ? obj.slides : [];
  const slides: SlideItem[] = arr
    .map((s) => {
      const so = (s ?? {}) as Record<string, unknown>;
      const bullets = Array.isArray(so.bullets)
        ? so.bullets.map((b) => String(b)).filter(Boolean)
        : [];
      return {
        titulo: String(so.titulo || '').slice(0, 200),
        bullets,
        notas: so.notas ? String(so.notas).slice(0, 600) : undefined,
      };
    })
    .filter((s) => s.titulo || s.bullets.length);
  if (!slides.length) throw new Error('A IA não devolveu slides. Tente novamente.');
  return { titulo, subtitulo, slides, conexoes };
}
