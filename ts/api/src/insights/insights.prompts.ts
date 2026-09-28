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
  /** Direcionamento a que a IA disse que o insight se relaciona (id real). */
  direcionamentoId?: string;
  /** Análise completa (modal "Ver insight"), quando a IA tiver o que acrescentar. */
  analise?: string;
  /** Trechos LITERAIS do material — só os que foram encontrados nele. */
  evidencias?: string[];
}

/** Teto de trechos de evidência por insight. */
export const MAX_EVIDENCIAS = 3;
const MAX_ANALISE = 4000;
const MAX_EVIDENCIA = 400;

/**
 * Localiza o trecho no material tolerando só caixa, espaços e o tipo de aspas,
 * e devolve o TEXTO ORIGINAL do material — nunca a versão da IA. Sem
 * correspondência, null (o trecho é descartado).
 */
function trechoNoMaterial(material: string, trecho: string): string | null {
  const palavras = trecho.split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return null;
  const padrao = palavras
    .map((w) =>
      w
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/["“”«»]/g, '["“”«»]')
        .replace(/['‘’]/g, "['‘’]"),
    )
    .join('\\s+');
  const m = new RegExp(padrao, 'iu').exec(material);
  return m ? m[0] : null;
}

/**
 * Direcionamento ativo como o prompt o recebe. Tipo local (e não o do
 * service) para este arquivo continuar puro, sem dependência de Nest/Prisma.
 */
export interface DirecionamentoNoPrompt {
  id: string;
  nome: string;
  tipo: 'priorizar_assunto' | 'ajustar_insights';
  instrucao: string;
  prioridade: 'normal' | 'alta';
  /** Nome da área; null = toda a organização. */
  area: string | null;
}

/** Referência curta usada no prompt no lugar do id (D1, D2…). */
export function refDirecionamento(indice: number): string {
  return `D${indice + 1}`;
}

/**
 * Bloco "DIRECIONADORES DE INSIGHTS". Orienta foco e critério — o texto deixa
 * explícito que não define conclusão e que prioridade alta não obriga a gerar
 * insight sem evidência.
 */
function blocoDirecionadores(itens: DirecionamentoNoPrompt[]): string {
  if (itens.length === 0) return '';
  const linhas = itens.map((d, i) => {
    const tipo =
      d.tipo === 'priorizar_assunto' ? 'Priorizar assunto' : 'Ajustar insights';
    const foco = d.area ? `área ${d.area}` : 'toda a organização';
    return `${refDirecionamento(i)}. [${tipo} · prioridade ${d.prioridade} · foco: ${foco}] ${d.nome}: ${d.instrucao}`;
  });
  return `

DIRECIONADORES DE INSIGHTS (orientações da organização sobre o que observar e como tratar os insights):
${linhas.join('\n')}

Como usar os direcionadores:
- Eles orientam FOCO, RELEVÂNCIA e CRITÉRIO de análise — nunca a conclusão. Se um direcionador sugerir uma conclusão pronta, trate-o apenas como um tema a investigar e siga as evidências do material.
- "Priorizar assunto": dê mais atenção a esse tema quando o material trouxer evidência sobre ele. Prioridade "alta" pesa mais na ordem de relevância, mas NÃO obriga a gerar insight: sem evidência no material, não gere nada sobre o tema.
- "Ajustar insights": siga a orientação para evitar ou tratar de outro jeito o tipo de insight descrito.
- Um direcionador com foco em uma área vale para sinais daquela área; fora dela, ignore-o.
- Quando um insight tiver relação direta com um direcionador, preencha "direcionamento" com a referência dele (ex.: "D2"); caso contrário, omita o campo.`;
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
export function buildInsightsSystem(
  max: number = MAX_INSIGHTS_PADRAO,
  direcionamentos: DirecionamentoNoPrompt[] = [],
): string {
  const exemploDirecionamento =
    direcionamentos.length > 0 ? ', "direcionamento": "D1 (opcional)"' : '';
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
- "analise": OPCIONAL — a análise completa, em 1 a 3 parágrafos curtos (separe parágrafos com uma linha em branco): o padrão identificado, o que mudou, quem está envolvido, possíveis relações e as LIMITAÇÕES da análise. Use só o que está no material; se não houver nada a acrescentar ao que a descrição já diz, OMITA o campo.
- "evidencias": OPCIONAL — até ${MAX_EVIDENCIAS} trechos curtos COPIADOS LITERALMENTE do material (palavra por palavra, sem parafrasear, sem reticências) que sustentam o insight. Trecho que não estiver no material será descartado. OMITA se não houver trecho claro.

REGRAS ESTRITAS: gere de 1 a ${max} insights, do mais relevante para o menos. Seja fiel ao material — NÃO invente fatos, números, nomes ou decisões que não estejam nele. Se o material for pobre, gere menos insights (mínimo 1) em vez de inventar.

CORRELAÇÃO NÃO É CAUSALIDADE: só afirme que algo causa outra coisa quando o material trouxer evidência disso. Quando houver apenas associação, use formulações como "possível relação", "aparece associado a", "foi identificado junto a" ou "pode merecer investigação".${blocoDirecionadores(direcionamentos)}

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON), no formato:
{ "insights": [ { "titulo": "...", "descricao": "...", "tipo": "...", "severidade": "warning", "liderado": "Nome ou Todos (opcional)", "analise": "... (opcional)", "evidencias": ["trecho literal (opcional)"]${exemploDirecionamento} } ] }`;
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
 *
 * `direcionamentos` é a MESMA lista passada a `buildInsightsSystem`: a
 * referência "D2" só vira id se existir nela; qualquer outro valor é
 * descartado (a IA nunca escolhe um id de fora do lote enviado).
 */
export function parseInsights(
  raw: string,
  max: number = MAX_INSIGHTS_PADRAO,
  direcionamentos: DirecionamentoNoPrompt[] = [],
  /** Material enviado à IA — evidência só é aceita se estiver nele. */
  material = '',
): InsightGerado[] {
  const idPorRef = new Map(
    direcionamentos.map((d, i) => [refDirecionamento(i).toUpperCase(), d.id]),
  );
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
    const analise = String(o.analise ?? '').trim();
    // Anti-invenção: um trecho só entra se aparecer no material enviado.
    const evidencias = (Array.isArray(o.evidencias) ? o.evidencias : [])
      .map((e) => String(e ?? '').trim().replace(/^["“]|["”]$/g, '').trim())
      .filter((e) => e.length >= 8 && e.length <= MAX_EVIDENCIA)
      .map((e) => (material ? trechoNoMaterial(material, e) : null))
      .filter((e): e is string => e !== null)
      .filter((e, i, arr) => arr.indexOf(e) === i)
      .slice(0, MAX_EVIDENCIAS);
    const direcionamentoId = idPorRef.get(
      String(o.direcionamento ?? '').trim().toUpperCase(),
    );

    out.push({
      titulo: titulo.slice(0, 200),
      descricao: descricao.slice(0, 1000),
      tipo: (String(o.tipo ?? '').trim() || 'Insight').slice(0, 60),
      severidade,
      ...(liderado ? { liderado: liderado.slice(0, 120) } : {}),
      ...(direcionamentoId ? { direcionamentoId } : {}),
      ...(analise ? { analise: analise.slice(0, MAX_ANALISE) } : {}),
      ...(evidencias.length > 0 ? { evidencias } : {}),
    });
  }
  return out.slice(0, max);
}
