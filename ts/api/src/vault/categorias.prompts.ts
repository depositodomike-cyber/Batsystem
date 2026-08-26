// ----------------------------------------------------------------------
// Prompts e parsers da classificação de notas em categorias macro.
//
// São DUAS chamadas com papéis distintos, e não uma por nota:
//
//   • VOCABULÁRIO — uma vez por repositório, sobre uma visão condensada do
//     acervo. A IA propõe os temas macro que aquele acervo tem.
//   • ATRIBUIÇÃO — por nota, recebendo o vocabulário como LISTA FECHADA.
//
// Classificar cada nota isoladamente produziria deriva de vocabulário
// ("Gestão de Pessoas", "Pessoas", "RH", "Gestão de pessoal") e uma categoria
// por documento — que é exatamente o que a categoria existe para evitar. A
// escapatória é o campo `novas`, e uma proposta só entra no vocabulário quando
// 2+ notas a propõem (ver VaultCategoria.propostas).
//
// Os parsers seguem o padrão de `parseInsights` (src/insights/insights.prompts.ts):
// tiram a cerca de código, acham o objeto, validam campo a campo e NUNCA lançam.
// ----------------------------------------------------------------------

/** Categoria proposta pela IA, antes de virar linha no banco. */
export interface CategoriaProposta {
  slug: string;
  label: string;
  definicao: string;
}

const MAX_LABEL = 40;
const MAX_DEFINICAO = 200;
/** Teto do vocabulário. Acima disso a categoria deixa de ser macro. */
export const MAX_VOCABULARIO = 14;
/** Categorias por nota. Mais que isso e a nota "pertence a tudo". */
const MAX_POR_NOTA = 3;
/** Propostas novas por nota — a escapatória tem de ser estreita. */
const MAX_NOVAS = 2;

/**
 * Chave de merge. Espelha `slugTag` do front
 * (ts/demo/src/app/pages/ceo/grafo-tags.ts) — as duas implementações têm de
 * concordar, senão o grafo não encontra a categoria que o backend gravou.
 */
export function slugCategoria(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * As três proibições valem para os dois prompts: cada uma corresponde a uma
 * camada que o grafo já preenche por outro caminho, e deixá-las passar
 * duplicaria nós.
 */
const REGRAS_COMUNS = `REGRAS:
- Categoria é TEMA MACRO, do tipo que classifica dezenas de documentos ao longo do tempo. Ex.: "Produto", "Estratégia", "Gestão de Pessoas", "Comunicação", "Administrativo", "Produtividade".
- NUNCA use nome de pessoa (ex.: "Michael Silva"). Pessoas são outra camada.
- NUNCA use nome de produto, projeto, versão ou funcionalidade (ex.: "Plataforma V1", "Design Tokens"). Assuntos específicos são outra camada.
- NUNCA use rótulo de FORMATO do arquivo (ex.: "Documento", "Reunião", "Ata", "E-mail", "Transcrição").
- Rótulos em português, de 1 a 4 palavras, sem "#" e sem aspas.`;

// ---------- 1) Vocabulário ----------

export const SYSTEM_VOCABULARIO = `Você organiza o acervo de conhecimento de uma empresa. Recebe uma amostra dos documentos e devolve o conjunto de CATEGORIAS MACRO que descreve esse acervo.

${REGRAS_COMUNS}
- Devolva de 6 a ${MAX_VOCABULARIO} categorias, das mais abrangentes para as menos.
- As categorias juntas devem cobrir praticamente todo o acervo, sem se sobreporem muito.

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON):
{ "categorias": [ { "label": "...", "definicao": "uma frase curta sobre o que entra aqui" } ] }`;

/** Visão condensada de uma nota — título e um trecho, para caber no contexto. */
export interface ResumoNota {
  titulo: string;
  trecho: string;
}

export function buildVocabularioUser(resumos: ResumoNota[]): string {
  const corpo = resumos
    .map((r, i) => `${i + 1}. ${r.titulo}\n${r.trecho}`)
    .join('\n\n');
  return (
    `## AMOSTRA DO ACERVO (${resumos.length} documentos)\n${corpo.slice(0, 50000)}\n\n` +
    `Devolva as CATEGORIAS MACRO no formato JSON pedido.`
  );
}

// ---------- 2) Atribuição ----------

export const SYSTEM_ATRIBUICAO = `Você classifica um documento nas categorias macro já existentes do acervo.

${REGRAS_COMUNS}
- Escolha de 1 a ${MAX_POR_NOTA} categorias DA LISTA fornecida, usando o rótulo exato.
- Só se NENHUMA da lista servir, proponha até ${MAX_NOVAS} em "novas". Propor é exceção: prefira sempre a lista.

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON):
{ "categorias": ["Rótulo exato da lista"], "novas": [ { "label": "...", "definicao": "..." } ] }`;

export function buildAtribuicaoUser(
  vocabulario: { label: string; definicao: string | null }[],
  nota: { titulo: string; conteudo: string },
): string {
  const lista = vocabulario
    .map((c) => `- ${c.label}${c.definicao ? `: ${c.definicao}` : ''}`)
    .join('\n');
  return (
    `## CATEGORIAS DISPONÍVEIS\n${lista || '(vocabulário vazio — proponha em "novas")'}\n\n` +
    `## DOCUMENTO\n### ${nota.titulo}\n${nota.conteudo.slice(0, 20000)}\n\n` +
    `Classifique o documento no formato JSON pedido.`
  );
}

// ---------- Parsers ----------

/** Objeto JSON dentro da resposta, tolerando cerca de código e texto em volta. */
function extrairObjeto(raw: string): Record<string, unknown> | null {
  const txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const semFence = fence ? fence[1].trim() : txt;
  const first = semFence.indexOf('{');
  const last = semFence.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  try {
    const obj: unknown = JSON.parse(semFence.slice(first, last + 1));
    return obj && typeof obj === 'object'
      ? (obj as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Uma entrada `{label, definicao}` validada, ou null se imprestável. */
function lerProposta(item: unknown): CategoriaProposta | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as Record<string, unknown>;
  const label = String(o.label ?? '')
    .trim()
    .replace(/^["'#]+|["']+$/g, '')
    .slice(0, MAX_LABEL);
  const slug = slugCategoria(label);
  if (!slug) return null;
  // Uma palavra de 1–2 letras vira slug mas não é categoria de nada.
  if (slug.length < 3) return null;
  if (label.split(/\s+/).length > 4) return null;
  return {
    slug,
    label,
    definicao: String(o.definicao ?? '')
      .trim()
      .slice(0, MAX_DEFINICAO),
  };
}

/** Dedup por slug, preservando a ordem de chegada. */
function unicasPorSlug(itens: CategoriaProposta[]): CategoriaProposta[] {
  const vistos = new Set<string>();
  const out: CategoriaProposta[] = [];
  for (const c of itens) {
    if (vistos.has(c.slug)) continue;
    vistos.add(c.slug);
    out.push(c);
  }
  return out;
}

/** Vocabulário proposto pela IA. Devolve [] quando nada aproveitável. */
export function parseVocabulario(raw: string): CategoriaProposta[] {
  const obj = extrairObjeto(raw);
  const arr = Array.isArray(obj?.categorias) ? obj.categorias : [];
  const itens = arr
    .map(lerProposta)
    .filter((c): c is CategoriaProposta => c !== null);
  return unicasPorSlug(itens).slice(0, MAX_VOCABULARIO);
}

export interface Atribuicao {
  /** Slugs que casaram com o vocabulário conhecido. */
  slugs: string[];
  /** Categorias que a IA propôs por não achar nenhuma que servisse. */
  novas: CategoriaProposta[];
}

/**
 * Atribuição de UMA nota. `conhecidos` é o conjunto de slugs do vocabulário:
 * rótulo que não casa com ele é descartado em silêncio — a lista é fechada, e o
 * canal para propor é o `novas`.
 */
export function parseAtribuicao(
  raw: string,
  conhecidos: Set<string>,
): Atribuicao {
  const obj = extrairObjeto(raw);
  if (!obj) return { slugs: [], novas: [] };

  const brutos = Array.isArray(obj.categorias) ? obj.categorias : [];
  const slugs: string[] = [];
  for (const b of brutos) {
    const s = slugCategoria(String(b ?? ''));
    if (s && conhecidos.has(s) && !slugs.includes(s)) slugs.push(s);
    if (slugs.length >= MAX_POR_NOTA) break;
  }

  const novasArr = Array.isArray(obj.novas) ? obj.novas : [];
  const novas = unicasPorSlug(
    novasArr.map(lerProposta).filter((c): c is CategoriaProposta => c !== null),
  )
    // Se já é conhecida, não é proposta — é uma atribuição que veio no campo errado.
    .filter((c) => !conhecidos.has(c.slug))
    .slice(0, MAX_NOVAS);

  return { slugs, novas };
}
