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

/**
 * Layouts que os renderizadores sabem desenhar. O plano só pode pedir um
 * destes — pedir "gráfico de barras" seria prometer o que o .pptx não entrega.
 */
export type TipoSlide =
  | 'capa'
  | 'secao'
  | 'conteudo'
  | 'destaque'
  | 'comparacao';

export const TIPOS_SLIDE: TipoSlide[] = [
  'capa',
  'secao',
  'conteudo',
  'destaque',
  'comparacao',
];

/**
 * Especificação semântica de um slide: o que ele precisa FAZER, não o texto
 * final. É o que o usuário revisa antes de aprovar a geração.
 */
export interface PlanoSlide {
  /** Identidade estável: ajuste individual, reordenação e key no frontend. */
  id: string;
  tipo: TipoSlide;
  titulo: string;
  /** Só na capa. */
  subtitulo?: string;
  /** O que este slide precisa alcançar. */
  objetivo?: string;
  /** Os pontos que vai cobrir — resumo, não o texto final do slide. */
  conteudo?: string[];
  /** Papel dele na progressão da apresentação. */
  narrativa?: string;
  /** Como deve aparecer. Coerente com `tipo`. */
  direcaoVisual?: string;
}

export interface Plano {
  titulo: string;
  subtitulo: string;
  slides: PlanoSlide[];
  /** Bloco "## 🔗 Conexões no Vault". */
  conexoes: string;
}

export interface SlideItem {
  /** Ausente = `conteudo`: arquivo gerado antes dos layouts segue válido. */
  tipo?: TipoSlide;
  titulo: string;
  /** capa e secao. */
  subtitulo?: string;
  /** conteudo. */
  bullets?: string[];
  /** destaque: números grandes com rótulo. */
  destaques?: { valor: string; rotulo: string }[];
  /** comparacao: duas colunas. */
  colunas?: { titulo: string; itens: string[] }[];
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

// ------------------------------------------------------------------- PLANO
// Etapa 1 do fluxo novo: a IA projeta a apresentação (o que cada slide FAZ),
// o usuário revisa e dirige, e só depois a IA escreve o conteúdo final.

/** Descrição dos layouts — a IA só pode planejar o que o renderizador desenha. */
const CATALOGO_TIPOS = `Tipos de slide disponíveis (use SOMENTE estes):
- "capa": abertura. Tem titulo e subtitulo. Um por apresentação, sempre o primeiro.
- "secao": transição entre blocos. Só titulo (e subtitulo curto opcional). Use para separar partes.
- "conteudo": o slide comum. Título + 3 a 5 pontos.
- "destaque": até 3 números/indicadores grandes com rótulo. Use quando houver métrica que mereça protagonismo.
- "comparacao": duas colunas (ex.: antes/depois, atual/desejado). Use quando o ponto for o contraste.`;

export const SYSTEM_PLANO = `Você é um estrategista sênior de apresentações executivas, escrevendo em português do Brasil (salvo se outro idioma for pedido).
Sua tarefa é PLANEJAR uma apresentação: definir o que cada slide precisa fazer. Você NÃO escreve o texto final dos slides agora.

${CATALOGO_TIPOS}

Princípios:
- Uma ideia central por slide. Título curto e específico, nunca genérico.
- Progressão clara: contexto → problema/oportunidade → desenvolvimento → evidências → conclusão.
- Varie os tipos. Uma apresentação inteira de "conteudo" é um relatório, não uma apresentação.
- Em "conteudo", liste de 2 a 5 pontos — RESUMO do que o slide vai cobrir, não o texto pronto.
- Em "objetivo", diga o que o slide precisa alcançar. Em "narrativa", o papel dele na progressão.
- Em "direcaoVisual", descreva como o slide deve aparecer, COERENTE com o tipo escolhido.
- Respeite público, objetivo e tom. Se houver REFERÊNCIAS, baseie-se nelas; não invente dados.

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON):
{
  "titulo": "Título da apresentação",
  "subtitulo": "Subtítulo curto",
  "slides": [
    {
      "tipo": "conteudo",
      "titulo": "Título do slide",
      "objetivo": "O que este slide precisa alcançar",
      "conteudo": ["ponto que vai cobrir", "outro ponto"],
      "narrativa": "Papel dele na progressão",
      "direcaoVisual": "Como deve aparecer"
    }
  ],
  "conexoes": "O bloco de Conexões no Vault em Markdown"
}${regraConexoesVaultCampo('conexoes')}`;

export const SYSTEM_AJUSTE = `Você é um estrategista sênior de apresentações executivas, escrevendo em português do Brasil.
Você recebe o PLANO de uma apresentação, o ÍNDICE de um slide e uma INSTRUÇÃO do usuário sobre aquele slide.

Sua tarefa: reescrever APENAS o slide indicado, aplicando a instrução.

${CATALOGO_TIPOS}

Regras:
- Altere somente o slide pedido. O plano completo está aí para você entender o contexto e a progressão — não o reescreva.
- Pode mudar o "tipo" do slide se a instrução pedir (ex.: "transforme em comparação", "faça virar transição").
- Preserve o que a instrução não pediu para mudar.
- Mantenha o "id" do slide exatamente como veio.
- Continue sendo um PLANO: resumo da intenção, não o texto final do slide.

Responda SOMENTE com o JSON do slide (sem cercas, sem texto fora do JSON):
{ "id": "...", "tipo": "...", "titulo": "...", "objetivo": "...", "conteudo": ["..."], "narrativa": "...", "direcaoVisual": "..." }`;

export const SYSTEM_SLIDES_DO_PLANO = `Você é um redator sênior de apresentações executivas, escrevendo em português do Brasil (salvo se outro idioma for pedido).
Você recebe um PLANO aprovado pelo usuário e deve EXECUTÁ-LO: escrever o conteúdo final de cada slide.

Regras:
- Siga o plano slide a slide, na ordem, sem acrescentar nem remover slides.
- Respeite o "tipo" de cada slide — ele define o formato do conteúdo:
  - "capa": preencha titulo e subtitulo.
  - "secao": preencha titulo (e subtitulo curto, se ajudar). Sem bullets.
  - "conteudo": 3 a 5 bullets objetivos e autossuficientes.
  - "destaque": até 3 itens em "destaques", cada um { "valor": "38%", "rotulo": "o que esse número é" }. O valor é curto.
  - "comparacao": exatamente 2 itens em "colunas", cada um { "titulo": "...", "itens": ["...", "..."] }.
- Use "objetivo", "narrativa" e "direcaoVisual" do plano como direção de escrita.
- Em "notas", 1 a 3 frases de apoio ao apresentador.
- Não invente dados. Se o plano pede um número que você não tem, escreva o indicador sem forjar o valor.

Responda SOMENTE com JSON válido:
{
  "titulo": "...",
  "subtitulo": "...",
  "slides": [
    { "tipo": "conteudo", "titulo": "...", "bullets": ["..."], "notas": "..." }
  ],
  "conexoes": ""
}`;

export const SYSTEM_CAPITULOS_DO_PLANO = `Você é um autor e editor sênior, escrevendo em português do Brasil (salvo se outro idioma for pedido).
Você recebe um PLANO aprovado pelo usuário e deve EXECUTÁ-LO: escrever os capítulos de um guia de LEITURA (prosa, não bullets).

Regras:
- Um capítulo por item do plano, na ordem, sem acrescentar nem remover.
- Use "objetivo", "conteudo" e "narrativa" de cada item como direção do que escrever.
- Vários parágrafos por capítulo. Profundidade real: explique, exemplifique, contextualize.
- Não invente dados.

Responda SOMENTE com JSON válido:
{ "titulo": "...", "subtitulo": "...", "capitulos": [ { "titulo": "...", "paragrafos": ["..."] } ], "conexoes": "" }`;

/** Variáveis + referências — o cabeçalho compartilhado por plano e roteiro. */
function blocoVariaveis(input: RoteiroInput, unidade: string): string {
  const { tema, nSlides = 0, publico, objetivo, tom, idioma, referencia } = input;
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
      : '')
  );
}

export function buildPlanoUser(input: RoteiroInput): string {
  const unidade = input.formato === 'book-html' ? 'capítulos' : 'slides';
  return (
    blocoVariaveis(input, unidade) +
    blocoTitulosVault(input.titulosVault ?? []) +
    `\nPlaneje a apresentação agora, respondendo APENAS o JSON no formato especificado, com o campo "conexoes" preenchido.`
  );
}

export function buildAjusteUser(
  plano: Plano,
  indice: number,
  instrucao: string,
): string {
  return (
    `## PLANO ATUAL (JSON)\n${JSON.stringify(plano)}\n\n` +
    `## SLIDE A AJUSTAR\nÍndice ${indice} (base 0) — "${plano.slides[indice]?.titulo ?? ''}"\n\n` +
    `## INSTRUÇÃO DO USUÁRIO\n${instrucao.trim().slice(0, 2000)}\n\n` +
    `Reescreva SOMENTE esse slide aplicando a instrução. Responda apenas o JSON do slide.`
  );
}

export function buildSlidesDoPlanoUser(
  plano: Plano,
  input: Omit<RoteiroInput, 'tema'> & { tema?: string },
): string {
  const unidade = input.formato === 'book-html' ? 'capítulos' : 'slides';
  return (
    blocoVariaveis({ ...input, tema: input.tema || plano.titulo }, unidade) +
    `## PLANO APROVADO (JSON)\n${JSON.stringify(plano)}\n\n` +
    `Execute o plano agora, respondendo APENAS o JSON no formato especificado.`
  );
}

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
    .map(parseSlideItem)
    .filter(
      (s) =>
        s.titulo ||
        s.bullets?.length ||
        s.destaques?.length ||
        s.colunas?.length,
    );
  if (!slides.length) throw new Error('A IA não devolveu slides. Tente novamente.');
  return { titulo, subtitulo, slides, conexoes };
}

// ---------------------------------------------------------------- utilitários

function listaDeTexto(v: unknown, max = 300): string[] {
  return Array.isArray(v)
    ? v
        .map((x) => String(x ?? '').trim().slice(0, max))
        .filter(Boolean)
    : [];
}

function textoOpcional(v: unknown, max: number): string | undefined {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : undefined;
}

function parseTipo(v: unknown): TipoSlide {
  const s = String(v ?? '').trim().toLowerCase();
  return (TIPOS_SLIDE as string[]).includes(s) ? (s as TipoSlide) : 'conteudo';
}

/** Um slide do roteiro final, com os campos de cada layout. */
function parseSlideItem(s: unknown): SlideItem {
  const so = (s ?? {}) as Record<string, unknown>;
  const destaques = Array.isArray(so.destaques)
    ? so.destaques
        .map((d) => {
          const o = (d ?? {}) as Record<string, unknown>;
          return {
            valor: String(o.valor ?? '').trim().slice(0, 24),
            rotulo: String(o.rotulo ?? '').trim().slice(0, 120),
          };
        })
        .filter((d) => d.valor || d.rotulo)
        .slice(0, 3)
    : [];
  const colunas = Array.isArray(so.colunas)
    ? so.colunas
        .map((c) => {
          const o = (c ?? {}) as Record<string, unknown>;
          return {
            titulo: String(o.titulo ?? '').trim().slice(0, 120),
            itens: listaDeTexto(o.itens),
          };
        })
        .filter((c) => c.titulo || c.itens.length)
        .slice(0, 2)
    : [];
  return {
    tipo: parseTipo(so.tipo),
    titulo: String(so.titulo ?? '').trim().slice(0, 200),
    subtitulo: textoOpcional(so.subtitulo, 300),
    bullets: listaDeTexto(so.bullets),
    ...(destaques.length ? { destaques } : {}),
    ...(colunas.length ? { colunas } : {}),
    notas: textoOpcional(so.notas, 600),
  };
}

/** Id estável do slide do plano, quando a IA não devolve um. */
function idDoPlano(i: number): string {
  return `ps${i}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extrai o PLANO do JSON devolvido pela IA.
 *
 * Tolerante de propósito, no padrão de `parseMelhorado`: o plano é o começo do
 * fluxo, e explodir um 500 aqui obrigaria o usuário a refazer a configuração
 * inteira. Slide sem nada aproveitável é descartado; se sobrar zero, aí sim a
 * chamada falha — não há o que revisar.
 */
export function parsePlano(raw: string): Plano {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  const first = txt.indexOf('{');
  const last = txt.lastIndexOf('}');
  if (first >= 0 && last > first) txt = txt.slice(first, last + 1);
  let data: unknown = {};
  try {
    data = JSON.parse(txt);
  } catch {
    data = {};
  }
  const obj = (data ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(obj.slides) ? obj.slides : [];
  const slides = arr
    .map((s, i) => parsePlanoSlide(s, i))
    .filter((s) => s.titulo || s.objetivo || s.conteudo?.length);
  if (!slides.length) {
    throw new Error('A IA não devolveu um plano válido. Tente novamente.');
  }
  return {
    titulo: String(obj.titulo || 'Apresentação').slice(0, 200),
    subtitulo: String(obj.subtitulo || '').slice(0, 300),
    slides,
    conexoes: normalizarConexoes(String(obj.conexoes || '')),
  };
}

/** Um slide do plano. Exportado porque o endpoint de ajuste devolve só um. */
export function parsePlanoSlide(s: unknown, i = 0): PlanoSlide {
  const so = (s ?? {}) as Record<string, unknown>;
  const id = String(so.id ?? '').trim();
  return {
    id: id || idDoPlano(i),
    tipo: parseTipo(so.tipo),
    titulo: String(so.titulo ?? '').trim().slice(0, 200),
    subtitulo: textoOpcional(so.subtitulo, 300),
    objetivo: textoOpcional(so.objetivo, 400),
    conteudo: listaDeTexto(so.conteudo),
    narrativa: textoOpcional(so.narrativa, 400),
    direcaoVisual: textoOpcional(so.direcaoVisual, 400),
  };
}

// ----------------------------------------------------------------------
// Identidade visual extraída de um documento
//
// O usuário anexa o manual de marca (PDF ou Word) e a IA devolve dele o que o
// renderizador sabe usar. É a única forma de um documento virar cor no arquivo:
// `designTheme()` lê `cores.*` em #RRGGBB e mais nada — uma descrição em prosa,
// por melhor que seja, não muda um pixel do .pptx.
// ----------------------------------------------------------------------

/** O que a extração devolve — um subconjunto do DesignSystem que o front usa. */
export interface IdentidadeExtraida {
  nome: string;
  tom: string;
  cores: {
    primaria: string;
    secundaria: string;
    acento: string;
    fundo: string;
    superficie: string;
    texto: string;
    textoSuave: string;
  };
  fonteTitulo: string;
  fonteCorpo: string;
  /** O que a IA não achou no documento e teve de deduzir. Mostrado ao usuário. */
  observacoes: string;
}

export const SYSTEM_IDENTIDADE = `Você lê manuais de marca e extrai deles uma identidade visual utilizável, escrevendo em português do Brasil.

Receberá o texto de um documento (manual de marca, brandbook, guia de estilo ou apresentação institucional). Devolva a identidade visual que ele descreve.

Regras:
- CORES em hexadecimal de 6 dígitos com "#" (ex.: "#1A2B3C"). Nunca rgb(), nunca nomes, nunca 3 dígitos — o renderizador descarta silenciosamente qualquer outro formato e a apresentação sai na paleta errada.
- Se o documento traz Pantone/CMYK/RGB sem hexadecimal, converta para hexadecimal.
- "fundo" e "superficie" são o plano de fundo dos slides; "texto" precisa ter contraste alto contra "fundo". Se o manual só descreve cores de marca, escolha um fundo e um texto coerentes com elas e diga isso em "observacoes".
- FONTES: o nome da família, sem peso nem variação ("Helvetica Neue", não "Helvetica Neue Bold 700").
- Não invente o que o documento não sugere. O que você deduziu, registre em "observacoes", em uma frase.
- Se o documento não for um manual de marca e não houver nada de identidade visual nele, devolva "cores" vazio e explique em "observacoes".

Responda APENAS com JSON, sem texto em volta, neste formato:
{
  "nome": "nome da marca",
  "tom": "tom de voz em poucas palavras",
  "cores": {
    "primaria": "#RRGGBB", "secundaria": "#RRGGBB", "acento": "#RRGGBB",
    "fundo": "#RRGGBB", "superficie": "#RRGGBB",
    "texto": "#RRGGBB", "textoSuave": "#RRGGBB"
  },
  "fonteTitulo": "nome da família",
  "fonteCorpo": "nome da família",
  "observacoes": "o que foi deduzido, ou vazio"
}`;

export function buildIdentidadeUser(texto: string, origem: string): string {
  return (
    `## DOCUMENTO: ${origem || 'sem nome'}\n\n` +
    // Mesmo teto do bloco de referências do plano: o resto do prompt precisa
    // caber junto, e manual de marca costuma ter muita página de exemplo.
    texto.slice(0, 20000) +
    `\n\nExtraia a identidade visual agora, respondendo APENAS o JSON.`
  );
}

/** `#RRGGBB` ou string vazia — o mesmo formato que `designTheme()` aceita. */
function corHex(v: unknown): string {
  const m = /^#?([\da-f]{6})$/i.exec(String(v ?? '').trim());
  return m ? `#${m[1].toUpperCase()}` : '';
}

/**
 * Nunca lança: um documento ruim não pode derrubar o fluxo da apresentação.
 * Devolve `null` quando não veio cor nenhuma aproveitável — quem chama decide o
 * que dizer ao usuário.
 */
export function parseIdentidade(raw: string): IdentidadeExtraida | null {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  const first = txt.indexOf('{');
  const last = txt.lastIndexOf('}');
  if (first >= 0 && last > first) txt = txt.slice(first, last + 1);

  let data: unknown = {};
  try {
    data = JSON.parse(txt);
  } catch {
    return null;
  }

  const obj = (data ?? {}) as Record<string, unknown>;
  const c = (obj.cores ?? {}) as Record<string, unknown>;

  const cores = {
    primaria: corHex(c.primaria),
    secundaria: corHex(c.secundaria),
    acento: corHex(c.acento),
    fundo: corHex(c.fundo),
    superficie: corHex(c.superficie),
    texto: corHex(c.texto),
    textoSuave: corHex(c.textoSuave),
  };

  // Sem primária e sem fundo não há o que aplicar: o arquivo sairia idêntico ao
  // neutro, e dizer que "extraiu a identidade" seria mentira.
  if (!cores.primaria && !cores.fundo) return null;

  return {
    nome: String(obj.nome ?? '').trim().slice(0, 80),
    tom: String(obj.tom ?? '').trim().slice(0, 120),
    cores,
    fonteTitulo: String(obj.fonteTitulo ?? '').trim().slice(0, 60),
    fonteCorpo: String(obj.fonteCorpo ?? '').trim().slice(0, 60),
    observacoes: String(obj.observacoes ?? '').trim().slice(0, 400),
  };
}
