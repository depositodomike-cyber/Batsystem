// Prompt de geração de INSIGHTS. A partir de um material já consolidado — uma
// ata/resumo de reunião salvo na Memória, um documento etc. — a IA destaca até
// `max` sinais estratégicos que merecem a atenção do líder. O teto varia por
// origem: uma reunião rende mais sinais que um documento de referência.
// Cada insight tem severidade (cor do card) e, quando o material aponta
// claramente para uma pessoa, o nome dela em `liderado`. Devolve JSON
// { insights: [...] }.

/** Uma das quatro severidades aceitas (espelha o enum InsightSeveridade). */
export type InsightSeveridade = 'secondary' | 'warning' | 'success' | 'light';

export const SEVERIDADES: InsightSeveridade[] = [
  'secondary',
  'warning',
  'success',
  'light',
];

export interface InsightGerado {
  titulo: string;
  descricao: string;
  tipo: string;
  severidade: InsightSeveridade;
  liderado?: string;
}

/** Teto de insights de um material de reunião (ata, resumo de áudio). */
export const MAX_INSIGHTS_PADRAO = 6;

/**
 * Teto de insights de um DOCUMENTO. Bem menor que o de reunião, de propósito:
 * um documento de referência rende poucos sinais de gestão, e cada upload
 * passa a custar uma chamada de IA a mais. É este o número a mexer se os
 * documentos da casa forem densos o bastante para justificar mais.
 */
export const MAX_INSIGHTS_DOCUMENTO = 2;

/**
 * Prompt de sistema. `max` é o teto do lote; o piso é sempre 1, para que
 * material pobre gere pouco em vez de render invenção.
 */
export function buildInsightsSystem(max: number = MAX_INSIGHTS_PADRAO): string {
  return `Você é um Business Partner sênior de gestão de pessoas e estratégia. A partir do MATERIAL fornecido (ata/resumo de reunião, documento ou anotações), destaque os INSIGHTS estratégicos que merecem a atenção do líder — em português do Brasil.

Um insight NÃO é um resumo nem uma tarefa: é um SINAL — algo relevante que se depreende do material (um risco, um padrão, uma conquista, um ponto a refletir) e a sua implicação para a gestão/negócio.

Para CADA insight defina:
- "titulo": frase curta e específica (máx. 10 palavras, sem aspas).
- "descricao": 1 a 2 frases explicando o sinal e a implicação para o líder.
- "tipo": rótulo curto do tema (ex.: "Rotatividade", "Engajamento", "Prazo", "Reconhecimento", "Processo").
- "severidade": UMA de exatamente estas quatro:
    - "secondary" = Ação necessária (algo que exige providência agora);
    - "warning"   = Atenção (sinal de alerta a acompanhar);
    - "success"   = Sucesso (algo positivo a reforçar/reconhecer);
    - "light"     = Para refletir (observação sem urgência).
- "liderado": OPCIONAL — nome da pessoa a que o insight se refere, EXATAMENTE como aparece no material; use "Todos" quando for sobre o time inteiro; OMITA o campo se for um insight geral do líder ou se não houver pessoa clara. Nunca invente nomes.

REGRAS ESTRITAS: gere de 1 a ${max} insights, do mais relevante para o menos. Seja fiel ao material — NÃO invente fatos, números, nomes ou decisões que não estejam nele. Se o material for pobre, gere menos insights (mínimo 1) em vez de inventar.

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{ "insights": [ { "titulo": "...", "descricao": "...", "tipo": "...", "severidade": "warning", "liderado": "Nome ou Todos (opcional)" } ] }`;
}

export function buildInsightsUser(
  titulo: string,
  conteudo: string,
  max: number = MAX_INSIGHTS_PADRAO,
): string {
  const cab = titulo?.trim() ? `## TÍTULO DO MATERIAL\n${titulo.trim()}\n\n` : '';
  return (
    cab +
    `## MATERIAL\n${String(conteudo).slice(0, 60000)}\n\n` +
    `Extraia no máximo ${max} INSIGHT(S) estratégico(s) no formato JSON pedido.`
  );
}

/**
 * Extrai a lista de insights do texto da IA, com validação e fallback robusto.
 * Descarta itens sem título/descrição e normaliza a severidade para uma das
 * quatro aceitas (default "light"). Nunca lança — devolve [] se nada válido.
 */
export function parseInsights(
  raw: string,
  max: number = MAX_INSIGHTS_PADRAO,
): InsightGerado[] {
  const txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const semFence = fence ? fence[1].trim() : txt;
  const first = semFence.indexOf('{');
  const last = semFence.lastIndexOf('}');
  if (first < 0 || last <= first) return [];

  let obj: unknown;
  try {
    obj = JSON.parse(semFence.slice(first, last + 1));
  } catch {
    return [];
  }

  const arr = Array.isArray((obj as { insights?: unknown }).insights)
    ? (obj as { insights: unknown[] }).insights
    : Array.isArray(obj)
      ? (obj as unknown[])
      : [];

  const out: InsightGerado[] = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const titulo = String(o.titulo ?? '').trim();
    const descricao = String(o.descricao ?? '').trim();
    if (!titulo || !descricao) continue;

    const sevRaw = String(o.severidade ?? '').trim().toLowerCase();
    const severidade = (SEVERIDADES as string[]).includes(sevRaw)
      ? (sevRaw as InsightSeveridade)
      : 'light';

    const liderado = String(o.liderado ?? '').trim();

    out.push({
      titulo: titulo.slice(0, 200),
      descricao: descricao.slice(0, 1000),
      tipo: (String(o.tipo ?? '').trim() || 'Insight').slice(0, 60),
      severidade,
      ...(liderado ? { liderado: liderado.slice(0, 120) } : {}),
    });
  }
  return out.slice(0, max);
}
