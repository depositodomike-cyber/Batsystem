// ----------------------------------------------------------------------
// Prompts e parsers do PLANO DA PLANILHA.
//
// Espelha `ai/apresentacao/prompts.ts`, que é o molde do fluxo "planejar →
// revisar → gerar": a primeira chamada de IA não produz arquivo nenhum, produz
// a ESPECIFICAÇÃO que o usuário revisa e dirige.
//
// Duas diferenças de fundo em relação à apresentação, e as duas são deliberadas:
//
// 1) Nenhuma VISUALIZAÇÃO é planejada. O gerador de arquivo desta V1 não produz
//    gráfico nativo de Excel, e planejar o que não vai existir seria prometer
//    ao usuário uma coisa e entregar outra. Indicador continua existindo —
//    indicador aqui é célula com fórmula, não gráfico.
//
// 2) A LÓGICA vem antes da FÓRMULA. Em cada cálculo o modelo escreve primeiro
//    o raciocínio de negócio ("Orçamento planejado − Valor realizado") e só
//    depois, se fizer sentido, a fórmula. É o que permite a alguém sem Excel
//    validar a planilha antes de ela existir.
// ----------------------------------------------------------------------

/** Tipo de uma coluna — o que o gerador de arquivo sabe formatar. */
export type TipoColuna =
  | 'texto'
  | 'numero'
  | 'moeda'
  | 'percentual'
  | 'data'
  | 'lista';

const TIPOS_COLUNA: TipoColuna[] = [
  'texto',
  'numero',
  'moeda',
  'percentual',
  'data',
  'lista',
];

/** Papel de uma aba na planilha. */
export type TipoAba = 'dados' | 'resumo' | 'apoio';

const TIPOS_ABA: TipoAba[] = ['dados', 'resumo', 'apoio'];

export interface PlanoColuna {
  nome: string;
  tipo: TipoColuna;
  /** Para que serve, em uma linha. */
  descricao?: string;
  /** Coluna calculada: a lógica dela, em português. */
  formula?: string;
  /** Regra de preenchimento ("uma das áreas cadastradas", "maior que zero"). */
  validacao?: string;
}

/**
 * Um cálculo ou indicador.
 *
 * `logica` é obrigatória e `formula` é opcional de propósito: o que o usuário
 * revisa é a lógica; a fórmula só aparece atrás de "Ver detalhes".
 */
export interface PlanoCalculo {
  nome: string;
  logica: string;
  formula?: string;
}

export interface PlanoAba {
  /** Identidade estável: ajuste individual, reordenação e key no React. */
  id: string;
  tipo: TipoAba;
  nome: string;
  objetivo: string;
  colunas: PlanoColuna[];
  calculos: PlanoCalculo[];
  indicadores: PlanoCalculo[];
  validacoes: string[];
  /** Esta aba ganha autofiltro. */
  filtros: boolean;
  /** Nomes de outras abas de que esta depende. */
  dependencias: string[];
  /** Quais fontes do usuário alimentam esta aba. */
  fontes: string[];
  /** A aba traz dados demonstrativos, que o arquivo vai rotular como exemplo. */
  dadosExemplo: boolean;
}

export interface PlanoPlanilha {
  titulo: string;
  objetivo: string;
  abas: PlanoAba[];
  /** O que as fontes não cobriram, dito em português — nunca preenchido no chute. */
  limitacoes: string[];
}

/** Entrada do plano — o que a tela de configuração coletou. */
export interface PlanoPlanilhaInput {
  necessidade: string;
  nome?: string;
  /** '' = a IA decide. */
  detalhamento?: '' | 'resumido' | 'detalhado';
  /** 0 = a IA decide. */
  nAbas?: number;
  recursos?: {
    formulas: boolean;
    filtros: boolean;
    validacoes: boolean;
    formatacaoCondicional: boolean;
  };
  /** Bloco de referências já montado (memória + notas + uploads). */
  referencia?: string;
  /** Há fonte de dados de verdade? Muda a regra de invenção. */
  temFontes?: boolean;
}

const DETALHAMENTO_LABEL: Record<string, string> = {
  resumido: 'Resumido (o mínimo que resolve; poucas colunas, poucos cálculos)',
  detalhado: 'Detalhado (cubra os casos de borda, categorias auxiliares e conferências)',
};

// ----------------------------------------------------------------------
// Plano
// ----------------------------------------------------------------------

export const SYSTEM_PLANO_PLANILHA = `Você é um projetista sênior de planilhas de trabalho, escrevendo em português do Brasil.
Sua tarefa é PLANEJAR uma planilha a partir de uma necessidade escrita em linguagem natural. Você NÃO gera o arquivo agora, e NÃO preenche dados.

A pessoa que vai ler este plano não sabe Excel. Ela precisa entender, lendo, se a planilha resolve o problema dela.

Princípios:
- Comece pelo problema, não pela estrutura. Cada aba existe para responder a alguma coisa — diga isso em "objetivo".
- Prefira poucas abas bem resolvidas. Uma base de lançamentos ("dados"), uma consolidação ("resumo") e, quando necessário, listas auxiliares ("apoio") costumam bastar.
- Em "calculos" e "indicadores", escreva SEMPRE a lógica de negócio em "logica" ("Orçamento planejado − Valor realizado"). É o que o usuário lê e aprova.
- Escreva TAMBÉM a "formula" sempre que a conta puder ser feita pela planilha. Sem ela, a coluna sai vazia no arquivo e o que você planejou não acontece. Regras da fórmula:
  * nomes de função em INGLÊS e argumentos separados por VÍRGULA (SUM, SUMIF, IF, IFERROR, ROUND, VLOOKUP, COUNTIF…), que é como o arquivo guarda;
  * escreva-a como ela fica na PRIMEIRA linha de dados, usando o número 2 (ex.: "=B2-C2"); ela será repetida linha a linha;
  * para puxar de outra aba, use o NOME da aba como está no plano: "=SUMIF(Lançamentos!B:B,A2,Lançamentos!D:D)";
  * cada cálculo e cada indicador vira uma COLUNA no arquivo. Se ele for uma coluna que você já listou em "colunas", repita ali o mesmo "nome"; se não, não precisa listá-lo duas vezes.
- "dependencias" traz o NOME de outras abas de que esta aba puxa dados. Uma aba de resumo quase sempre depende da base.
- NÃO planeje gráficos, dashboards visuais nem tabelas dinâmicas: esta versão não os gera, e prometer o que não sai é pior que não oferecer.
- NÃO invente dados. Estruturar colunas é seu trabalho; inventar números não é.

Sobre dados:
- Com FONTES disponíveis: baseie as colunas no que as fontes realmente têm e diga em "fontes" de qual delas a aba vem. Deixe "dadosExemplo" como false.
- Sem fontes: a planilha nasce estruturada e VAZIA. Marque "dadosExemplo": true apenas quando algumas linhas de exemplo ajudarem a entender o preenchimento — elas serão rotuladas como exemplo no arquivo.
- Em "limitacoes", liste o que você não conseguiu resolver com o que recebeu ("nenhuma fonte trouxe o orçamento por área; a coluna fica para preencher"). Lista vazia se não houver nada a dizer.

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON):
{
  "titulo": "Nome da planilha",
  "objetivo": "O que ela resolve, em uma frase",
  "abas": [
    {
      "tipo": "dados",
      "nome": "Lançamentos",
      "objetivo": "Base das movimentações do ano",
      "colunas": [
        { "nome": "Data", "tipo": "data", "descricao": "Data do lançamento" },
        { "nome": "Valor", "tipo": "moeda", "validacao": "maior que zero" }
      ],
      "calculos": [
        { "nome": "Saldo disponível", "logica": "Orçamento planejado − Valor realizado", "formula": "=B2-C2" }
      ],
      "indicadores": [
        { "nome": "% utilizado", "logica": "Valor realizado dividido pelo orçamento planejado", "formula": "=IFERROR(C2/B2,0)" }
      ],
      "validacoes": ["Área precisa existir na aba Configurações"],
      "filtros": true,
      "dependencias": [],
      "fontes": [],
      "dadosExemplo": false
    }
  ],
  "limitacoes": []
}`;

export function buildPlanoPlanilhaUser(input: PlanoPlanilhaInput): string {
  const qtd =
    input.nAbas && input.nAbas > 0
      ? `Quantidade de abas: exatamente ${input.nAbas}.`
      : 'Quantidade de abas: você decide (priorize clareza; nem fragmentado demais, nem tudo numa aba só).';
  const detalhe = input.detalhamento
    ? DETALHAMENTO_LABEL[input.detalhamento] || input.detalhamento
    : 'Automático (você escolhe a profundidade adequada à necessidade)';

  const r = input.recursos;
  const recursos = r
    ? [
        r.formulas ? 'fórmulas' : null,
        r.filtros ? 'filtros' : null,
        r.validacoes ? 'validações de dados' : null,
        r.formatacaoCondicional ? 'formatação condicional' : null,
      ]
        .filter(Boolean)
        .join(', ') || 'nenhum recurso automático — só a estrutura'
    : 'fórmulas, filtros, validações de dados, formatação condicional';

  return (
    `## NECESSIDADE\n${input.necessidade.trim().slice(0, 8000)}\n\n` +
    `## VARIÁVEIS\n` +
    (input.nome?.trim() ? `- Nome pedido: ${input.nome.trim()}\n` : '') +
    `- Nível de detalhamento: ${detalhe}\n` +
    `- ${qtd}\n` +
    `- Recursos preferidos: ${recursos}\n` +
    `- Fontes de dados: ${input.temFontes ? 'sim, veja REFERÊNCIAS' : 'nenhuma — a planilha nasce estruturada e vazia'}\n\n` +
    (input.referencia?.trim()
      ? `## REFERÊNCIAS (baseie-se nelas; não invente)\n${input.referencia.slice(0, 20000)}\n\n`
      : '') +
    `Planeje a planilha agora, respondendo APENAS o JSON no formato especificado.`
  );
}

// ----------------------------------------------------------------------
// Ajuste de UMA aba
// ----------------------------------------------------------------------

export const SYSTEM_AJUSTE_ABA = `Você é um projetista sênior de planilhas, escrevendo em português do Brasil.
Você recebe o PLANO de uma planilha, o ÍNDICE de uma aba e uma INSTRUÇÃO do usuário sobre aquela aba.

Sua tarefa: reescrever APENAS a aba indicada, aplicando a instrução.

Regras:
- Altere somente a aba pedida. O plano inteiro está aí para você entender as dependências — não o reescreva.
- Mantenha o "id" da aba exatamente como veio.
- Preserve o que a instrução não pediu para mudar.
- Continue sendo um PLANO: estrutura e lógica, nunca dados preenchidos.
- Não proponha gráficos, dashboards visuais nem tabelas dinâmicas.
- Em "impactos", liste em português as OUTRAS abas que este ajuste afeta e por quê ("O Dashboard usa esses dados e passa a mostrar a margem"). Você não as altera — quem decide é o usuário. Lista vazia se o ajuste não sair desta aba.

Responda SOMENTE com o JSON (sem cercas, sem texto fora do JSON):
{ "aba": { "id": "...", "tipo": "...", "nome": "...", "objetivo": "...", "colunas": [], "calculos": [], "indicadores": [], "validacoes": [], "filtros": true, "dependencias": [], "fontes": [], "dadosExemplo": false }, "impactos": [] }`;

export function buildAjusteAbaUser(
  plano: PlanoPlanilha,
  indice: number,
  instrucao: string,
): string {
  return (
    `## PLANO ATUAL (JSON)\n${JSON.stringify(plano)}\n\n` +
    `## ABA A AJUSTAR\nÍndice ${indice} (base 0) — "${plano.abas[indice]?.nome ?? ''}"\n\n` +
    `## INSTRUÇÃO DO USUÁRIO\n${instrucao.trim().slice(0, 2000)}\n\n` +
    `Reescreva SOMENTE essa aba aplicando a instrução. Responda apenas o JSON no formato especificado.`
  );
}

// ----------------------------------------------------------------------
// Parsers
//
// O modelo erra: devolve texto em volta do JSON, troca lista por string, omite
// campo. Nada aqui confia na resposta — cada campo é coagido ao tipo que o
// resto do fluxo espera, e o único erro que sobe é "não veio plano nenhum".
// ----------------------------------------------------------------------

/** Recorta o JSON de uma resposta (cercas ```json, preâmbulo, sufixo). */
function extrairJson(raw: string): Record<string, unknown> {
  let txt = (raw || '').trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  const first = txt.indexOf('{');
  const last = txt.lastIndexOf('}');
  if (first >= 0 && last > first) txt = txt.slice(first, last + 1);
  try {
    const data: unknown = JSON.parse(txt);
    return data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function textoOpcional(v: unknown, max: number): string | undefined {
  const t = texto(v, max);
  return t || undefined;
}

function listaDeTexto(v: unknown, max = 200, limite = 30): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => texto(x, max))
    .filter(Boolean)
    .slice(0, limite);
}

/** `aba-1`, `aba-2`… quando o modelo não devolve id. */
function idDaAba(i: number): string {
  return `aba-${i + 1}`;
}

function parseTipoAba(v: unknown): TipoAba {
  const t = String(v ?? '').trim().toLowerCase();
  return (TIPOS_ABA as string[]).includes(t) ? (t as TipoAba) : 'dados';
}

function parseTipoColuna(v: unknown): TipoColuna {
  const t = String(v ?? '').trim().toLowerCase();
  return (TIPOS_COLUNA as string[]).includes(t) ? (t as TipoColuna) : 'texto';
}

function parseColunas(v: unknown): PlanoColuna[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        nome: texto(o.nome, 80),
        tipo: parseTipoColuna(o.tipo),
        descricao: textoOpcional(o.descricao, 240),
        formula: textoOpcional(o.formula, 400),
        validacao: textoOpcional(o.validacao, 240),
      };
    })
    .filter((c) => c.nome)
    .slice(0, 40);
}

function parseCalculos(v: unknown): PlanoCalculo[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        nome: texto(o.nome, 120),
        logica: texto(o.logica, 400),
        formula: textoOpcional(o.formula, 400),
      };
    })
    .filter((c) => c.nome || c.logica)
    .slice(0, 30);
}

/** Uma aba do plano. Exportada porque o endpoint de ajuste devolve só uma. */
export function parsePlanoAba(a: unknown, i = 0): PlanoAba {
  const o = (a ?? {}) as Record<string, unknown>;
  const id = texto(o.id, 60);
  return {
    id: id || idDaAba(i),
    tipo: parseTipoAba(o.tipo),
    nome: texto(o.nome, 80),
    objetivo: texto(o.objetivo, 400),
    colunas: parseColunas(o.colunas),
    calculos: parseCalculos(o.calculos),
    indicadores: parseCalculos(o.indicadores),
    validacoes: listaDeTexto(o.validacoes, 240, 20),
    // Ausente vira `true`: filtro é o padrão de uma aba de trabalho, e a
    // ausência do campo quase sempre é esquecimento do modelo, não recusa.
    filtros: o.filtros === undefined ? true : Boolean(o.filtros),
    dependencias: listaDeTexto(o.dependencias, 80, 10),
    fontes: listaDeTexto(o.fontes, 160, 10),
    dadosExemplo: Boolean(o.dadosExemplo),
  };
}

export function parsePlanoPlanilha(raw: string): PlanoPlanilha {
  const obj = extrairJson(raw);
  const arr = Array.isArray(obj.abas) ? obj.abas : [];
  const abas = arr
    .map((a, i) => parsePlanoAba(a, i))
    .filter((a) => a.nome || a.objetivo || a.colunas.length);
  if (!abas.length) {
    throw new Error('A IA não devolveu um plano válido. Tente novamente.');
  }
  return {
    titulo: texto(obj.titulo, 200) || 'Planilha',
    objetivo: texto(obj.objetivo, 400),
    abas: abas.slice(0, 12),
    limitacoes: listaDeTexto(obj.limitacoes, 400, 12),
  };
}

/** Resposta do ajuste: a aba reescrita e os impactos que ela declara. */
export function parseAjusteAba(
  raw: string,
  indice: number,
): { aba: PlanoAba; impactos: string[] } {
  const obj = extrairJson(raw);
  // O modelo às vezes devolve a aba na raiz, sem o envelope. Os dois casos
  // valem: o que interessa é o objeto que tem "nome" ou "colunas".
  const bruta =
    obj.aba && typeof obj.aba === 'object' ? (obj.aba as unknown) : obj;
  const aba = parsePlanoAba(bruta, indice);
  if (!aba.nome && !aba.colunas.length && !aba.objetivo) {
    throw new Error('A IA não devolveu a aba ajustada. Tente novamente.');
  }
  return { aba, impactos: listaDeTexto(obj.impactos, 300, 8) };
}

// ----------------------------------------------------------------------
// Conteúdo — o plano aprovado vira linhas
//
// Segunda chamada de IA do fluxo, no papel de `SYSTEM_SLIDES_DO_PLANO` da
// apresentação: o plano já foi revisado pelo usuário, aqui ele é EXECUTADO.
//
// A regra que manda nesta etapa é a de não inventar dado. A IA declara, por
// aba, de onde as linhas vieram — e o construtor do arquivo trata "exemplo"
// diferente de "fontes", com aviso na própria aba. Misturar os dois em
// silêncio seria o pior defeito que esta funcionalidade poderia ter.
// ----------------------------------------------------------------------

/** De onde saíram as linhas de uma aba. */
export type OrigemDados = 'fontes' | 'exemplo' | 'vazia';

const ORIGENS: OrigemDados[] = ['fontes', 'exemplo', 'vazia'];

/** Uma célula: texto, número, ou nada. */
export type Celula = string | number | null;

export interface ConteudoAba {
  /** Casa com `PlanoAba.id`. */
  id: string;
  origem: OrigemDados;
  /** Uma linha por registro, na ORDEM das colunas do plano. */
  linhas: Celula[][];
}

export interface ConteudoPlanilha {
  abas: ConteudoAba[];
}

/** Teto de linhas por aba — o arquivo é um começo de trabalho, não um dump. */
export const MAX_LINHAS = 200;

export const SYSTEM_CONTEUDO_PLANILHA = `Você preenche planilhas a partir de um plano já aprovado, escrevendo em português do Brasil.
Você recebe o PLANO (abas, colunas, cálculos) e, quando houver, as REFERÊNCIAS com os dados do usuário. Devolve as LINHAS de cada aba.

REGRA MAIS IMPORTANTE — não invente dados:
- Valor que veio das REFERÊNCIAS: use, e marque a aba com "origem": "fontes".
- Sem referência para a aba: ou devolva "linhas": [] com "origem": "vazia", ou, se o plano marcou aquela aba como demonstrativa, devolva poucas linhas ilustrativas com "origem": "exemplo".
- NUNCA misture dado real com dado inventado na mesma aba. Nunca apresente exemplo como se fosse real.

Formato das linhas:
- Uma linha é um array com um valor por coluna, na MESMA ORDEM das colunas do plano. Não pule nem reordene colunas.
- Coluna que o plano define com "formula" é calculada pela própria planilha: mande null nessa posição.
- Número é número puro: 1200.5, e não "R$ 1.200,50". Sem separador de milhar, sem símbolo de moeda.
- Percentual é fração: 0.35 para 35%.
- Data é texto no formato AAAA-MM-DD.
- Texto vazio é null, não "".
- No máximo ${MAX_LINHAS} linhas por aba. Se as referências tiverem mais, traga as mais representativas.

Abas de consolidação e de apoio:
- Aba que consolida (uma linha por área, por mês, por categoria…) PRECISA das linhas da dimensão dela, senão as fórmulas não têm onde acontecer. Traga uma linha por item, preenchendo a coluna que identifica o item e deixando as calculadas em null.
- Os itens têm que ser os MESMOS que aparecem nas outras abas: as mesmas áreas, as mesmas categorias. Uma consolidação que fala de área que não existe na base não soma nada.
- Aba de apoio (listas auxiliares) traz os valores que as outras abas usam — é dela que sai o menu suspenso.

Responda SOMENTE com JSON válido (sem cercas de código, sem texto fora do JSON):
{
  "abas": [
    { "id": "aba-1", "origem": "exemplo", "linhas": [["2027-01-05", "Marketing", "Mídia paga", 12000, null]] }
  ]
}`;

export function buildConteudoUser(
  plano: PlanoPlanilha,
  referencia: string,
): string {
  const abas = plano.abas
    .map((a, i) => {
      const colunas = a.colunas
        .map(
          (c, n) =>
            `${n + 1}. ${c.nome} (${c.tipo})${c.formula ? ' — CALCULADA, mande null' : ''}`,
        )
        .join('\n');
      return (
        `### Aba ${i + 1} — id "${a.id}" — ${a.nome}\n` +
        `Objetivo: ${a.objetivo}\n` +
        `Colunas, nesta ordem:\n${colunas || '(sem colunas)'}\n` +
        `Demonstrativa: ${a.dadosExemplo ? 'sim' : 'não'}`
      );
    })
    .join('\n\n');

  return (
    `## PLANO APROVADO\n${abas}\n\n` +
    (referencia.trim()
      ? `## REFERÊNCIAS (é daqui que os dados reais saem)\n${referencia.slice(0, 20000)}\n\n`
      : `## REFERÊNCIAS\nNenhuma. Nenhum valor desta planilha pode ser apresentado como real.\n\n`) +
    `Devolva as linhas de cada aba, respondendo APENAS o JSON no formato especificado.`
  );
}

function parseCelula(v: unknown): Celula {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'string') {
    const t = v.trim().slice(0, 500);
    return t || null;
  }
  return null;
}

/**
 * Conteúdo devolvido pela IA, coagido ao formato do construtor.
 *
 * Nunca lança: uma aba que o modelo esqueceu vira aba vazia, e o arquivo sai
 * com a estrutura de qualquer jeito. Planilha estruturada e sem linha é um
 * resultado legítimo; erro de geração, não.
 */
export function parseConteudoPlanilha(
  raw: string,
  plano: PlanoPlanilha,
): ConteudoPlanilha {
  const obj = extrairJson(raw);
  const arr = Array.isArray(obj.abas) ? obj.abas : [];
  const porId = new Map<string, ConteudoAba>();

  for (const item of arr) {
    const o = (item ?? {}) as Record<string, unknown>;
    const id = texto(o.id, 60);
    if (!id) continue;
    const origemBruta = String(o.origem ?? '').trim().toLowerCase();
    const origem = (ORIGENS as string[]).includes(origemBruta)
      ? (origemBruta as OrigemDados)
      : 'exemplo';
    const linhas = (Array.isArray(o.linhas) ? o.linhas : [])
      .filter((l): l is unknown[] => Array.isArray(l))
      .slice(0, MAX_LINHAS)
      .map((l) => l.map(parseCelula));
    porId.set(id, {
      id,
      // Sem linha nenhuma, a origem declarada não descreve nada — e dizer
      // "exemplo" numa aba vazia assustaria à toa.
      origem: linhas.length ? origem : 'vazia',
      linhas,
    });
  }

  return {
    abas: plano.abas.map(
      (a) => porId.get(a.id) ?? { id: a.id, origem: 'vazia', linhas: [] },
    ),
  };
}
