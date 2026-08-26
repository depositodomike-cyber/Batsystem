// ----------------------------------------------------------------------
// Extração de tags do texto das notas.
//
// O grafo precisava de metadados (frontmatter, tags, pastas de grupo,
// [[wikilinks]]) para saber o que era entidade. Um vault importado de fora não
// tem nada disso — um export de 18 .md sem frontmatter nenhum produzia duas
// entidades e caía no mapa de arquivos.
//
// Aqui a estrutura vem do TEXTO: termos que recorrem em vários arquivos viram
// tags, e a tag é o nó de agrupamento. Quem compartilha uma tag fica
// relacionado; um arquivo com várias tags pertence a vários agrupamentos ao
// mesmo tempo. É o mesmo critério para vault do produto e vault importado.
//
// Roda no navegador, sobre texto já em memória, uma vez por carregamento —
// nenhuma chamada de rede.
// ----------------------------------------------------------------------

import { ehTagDeTipo, parseNotaMd, type ArquivoMd } from "./memoria-inventario";

/** Chave de merge: sem acento, sem caixa, sem pontuação. */
export function slugTag(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Sem acento e sem caixa, mas PRESERVANDO os separadores — ao contrário do slug. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Caractere que continua uma palavra (com acento já removido pela normalização). */
const LETRA = /[\p{L}\p{N}_]/u;

/** Comprimento mínimo de um rótulo para valer como menção — evita casar sigla curta em tudo. */
const MIN_ROTULO = 3;

/**
 * O rótulo aparece no texto como palavra inteira?
 *
 * Ambos os argumentos já devem vir de `normalizarTexto`. A fronteira é testada à
 * mão porque `\b` do JS é ASCII: `\bJosé\b` falharia justamente nos nomes
 * acentuados. Fazer `indexOf` em texto normalizado também evita escapar
 * metacaracteres de regex que aparecem em nomes ("Assunção (RH)").
 */
export function mencionaRotulo(textoNorm: string, rotuloNorm: string): boolean {
  if (rotuloNorm.length < MIN_ROTULO) return false;
  let i = textoNorm.indexOf(rotuloNorm);
  while (i !== -1) {
    const antes = i > 0 ? textoNorm[i - 1] : "";
    const depois = textoNorm[i + rotuloNorm.length] ?? "";
    if (!LETRA.test(antes) && !LETRA.test(depois)) return true;
    i = textoNorm.indexOf(rotuloNorm, i + 1);
  }
  return false;
}

// Palavras que nunca viram tag: funcionais (PT/EN) e genéricos de documento.
// Em minúsculas e sem acento — comparadas depois do slug.
const STOPWORDS = new Set(
  (
    "a o e de da do das dos em no na nos nas um uma uns umas para por com sem sob sobre entre ate apos " +
    "como que se ao aos as os ou mas nem nao sim ja mais menos muito pouco todo toda todos todas cada " +
    "qual quais quando onde quem cujo este esta estes estas esse essa isso aquilo seu sua seus suas meu " +
    "minha nosso nossa ser estar ter haver fazer poder dever ir vir dar ver saber querer sao foi era tem " +
    "ha vai deve pode precisa apenas tambem ainda entao assim porem contudo alem depois antes " +
    "the of and to in for on with an is are be this that it as at by or from we you they " +
    // genéricos de documento — dizem respeito ao formato, não ao tema
    "pagina paginas item itens exemplo exemplos parte partes caso casos ponto pontos forma formas " +
    "tipo tipos nivel niveis area areas etapa etapas passo passos secao secoes tabela lista listas " +
    "texto textos titulo subtitulo objetivo objetivos contexto resumo introducao conclusao visao geral " +
    "estrutura foco criterio criterios regra regras modelo modelos cor cores hierarquia plataforma " +
    "tarefa tarefas pesquisa detalhe detalhes valor valores nome nomes campo campos status acao acoes " +
    "uso opcao opcoes versao versoes total resultado resultados problema problemas solucao ideia ideias " +
    "observacao importante atencao referencia referencias fonte fontes anexo anexos"
  ).split(/\s+/),
);

const MIN_CHARS = 3;
const MAX_CHARS = 42;
const MAX_PALAVRAS = 4;

/** Sigla ou acrônimo: OKRs, LMS, CTA, MVP. */
function ehSigla(t: string): boolean {
  return /^[A-Z][A-Z0-9]{1,}s?$/.test(t);
}

/** Código de referência interno (BC-R01, BC-MAP, RF-12) — não é tema. */
function ehCodigo(t: string): boolean {
  return /^[A-Z]{2,}[-_]?[A-Z]*\d*$/.test(t) && /[-_\d]/.test(t);
}

/** camelCase colado — quase sempre lixo de parsing de link ou tabela. */
function ehColado(t: string): boolean {
  return !/\s/.test(t) && /[a-z][A-Z]/.test(t) && t.length > 14;
}

function limpar(s: string): string {
  return s
    .replace(/[*_`~]/g, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/^[\s.,;:!?"'()[\]—–·]+|[\s.,;:!?"'()[\]—–·]+$/g, "")
    .trim();
}

/**
 * O termo pode virar tag?
 *
 * `forte` marca candidatos vindos de heading, negrito, wikilink ou frontmatter —
 * lugares onde alguém deliberadamente destacou o termo. Uma palavra isolada só
 * passa por aí (ou sendo sigla): capturada solta do corpo, quase sempre é uma
 * palavra comum que só está em maiúscula por abrir a frase.
 */
function ehCandidato(t: string, forte: boolean): boolean {
  if (t.length < MIN_CHARS || t.length > MAX_CHARS) return false;
  if (/^[\d\W]/.test(t)) return false; // começa com número ou pontuação
  if (ehColado(t) || ehCodigo(t)) return false;
  // Rótulo de TIPO de conteúdo ("documento", "reunião", "transcrição") diz
  // respeito ao formato, não ao tema. Reusa a taxonomia do inventário — é
  // por aqui que um `[[Documento]]` órfão deixa de virar nó.
  if (ehTagDeTipo(t)) return false;
  const palavras = t.split(/\s+/);
  if (palavras.length > MAX_PALAVRAS) return false;
  const s = slugTag(t);
  if (!s || STOPWORDS.has(s)) return false;
  if (palavras.every((w) => STOPWORDS.has(slugTag(w)))) return false;
  if (palavras.length === 1 && !forte && !ehSigla(t)) return false;
  return true;
}

export interface TagCandidata {
  slug: string;
  /** Rótulo exibido — a grafia mais "própria" entre as ocorrências. */
  label: string;
  /** Paths dos .md em que o termo aparece, do mais recente ao mais antigo. */
  arquivos: string[];
  /** Total de ocorrências (desempate do ranking). */
  ocorrencias: number;
}

interface Acumulador {
  label: string;
  arquivos: Set<string>;
  ocorrencias: number;
  /** Vezes que o termo apareceu como heading. */
  headings: number;
  /** Vezes que apareceu em qualquer outro lugar (negrito, wikilink, corpo). */
  fora: number;
}

/** Fatia um heading em partes: "Benchmark — Público-Alvo" dá dois candidatos. */
function partesDoHeading(texto: string): string[] {
  return texto.split(/\s+[—–]\s+|\s+·\s+|:\s+/);
}

/**
 * Varre um corpo de markdown e devolve os candidatos com o nível de sinal.
 * Exportada para dar para inspecionar a extração de uma nota isolada.
 */
export function candidatosDoTexto(
  body: string,
): { termo: string; forte: boolean; heading?: boolean }[] {
  const out: { termo: string; forte: boolean; heading?: boolean }[] = [];
  const semCodigo = body.replace(/```[\s\S]*?```/g, "");

  for (const m of semCodigo.matchAll(/^#{1,4}\s+(.+)$/gm)) {
    for (const parte of partesDoHeading(m[1]))
      out.push({ termo: parte, forte: true, heading: true });
  }
  for (const m of semCodigo.matchAll(/\*\*([^*\n]{3,42})\*\*/g)) {
    out.push({ termo: m[1], forte: true });
  }
  for (const m of semCodigo.matchAll(/\[\[([^\]\n|#]+)/g)) {
    out.push({ termo: m[1], forte: true });
  }

  // Nomes próprios: capitalizadas no MEIO da frase. O recorte `[^.!?:\n]\s+`
  // antes do termo é o que separa nome próprio de palavra que só está em
  // maiúscula por abrir a frase ou o item de lista.
  const corpo = semCodigo.replace(/^#{1,4}\s+.+$/gm, "");
  const NOME =
    /(^|[^.!?:\n]\s+)([A-ZÁÂÃÀÉÊÍÓÔÕÚÜÇ][\wÀ-ÿ-]{2,}(?:\s+(?:de|do|da|dos|das|e)?\s*[A-ZÁÂÃÀÉÊÍÓÔÕÚÜÇ][\wÀ-ÿ-]{2,}){0,3})/g;
  for (const m of corpo.matchAll(NOME)) out.push({ termo: m[2], forte: false });

  return out;
}

/**
 * Tags recorrentes do vault, da mais recorrente para a menos.
 *
 * Recorrência é o critério de agrupamento: um termo que aparece num arquivo só
 * não relaciona nada. O piso acompanha o tamanho do vault para que 2 citações
 * em 500 arquivos não pesem o mesmo que 2 em 12.
 */
export function extrairTags(files: ArquivoMd[]): TagCandidata[] {
  const acc = new Map<string, Acumulador>();
  const registrar = (
    bruto: string,
    path: string,
    forte: boolean,
    heading = false,
  ) => {
    const t = limpar(bruto);
    if (!ehCandidato(t, forte)) return;
    const s = slugTag(t);
    let atual = acc.get(s);
    if (!atual) {
      atual = {
        label: t,
        arquivos: new Set(),
        ocorrencias: 0,
        headings: 0,
        fora: 0,
      };
      acc.set(s, atual);
    }
    atual.arquivos.add(path);
    atual.ocorrencias += 1;
    if (heading) atual.headings += 1;
    else atual.fora += 1;
    // Fica com a grafia capitalizada: `[[Design Tokens]]` ganha de `design tokens`.
    if (/^[a-z]/.test(atual.label) && /^[A-Z]/.test(t)) atual.label = t;
  };

  const recencia = new Map<string, number>();
  for (const f of files) {
    recencia.set(f.path, f.modificadoEm);
    const { tags, body } = parseNotaMd(f.text);
    // Tags de frontmatter, quando o vault as tem, são o sinal mais forte.
    for (const t of tags) registrar(t, f.path, true);
    for (const c of candidatosDoTexto(body))
      registrar(c.termo, f.path, c.forte, c.heading);
  }

  // Piso ABSOLUTO, não proporcional ao vault.
  //
  // Era `Math.max(2, Math.ceil(files.length * 0.08))`. Com piso relativo um
  // assunto presente em 3 arquivos PERDIA o nó quando o vault passava de 38 —
  // sem nada ter mudado nele. O grafo se reorganizava por uma razão invisível ao
  // usuário, e um tema estabelecido simplesmente desaparecia.
  //
  // Fica em 2 (e não em 3) porque 3 removeria agora tags que já existem, o que
  // seria a mesma quebra pelo outro lado. Os filtros de candidato
  // (`ehCandidato`, STOPWORDS, exigência de sinal `forte` para palavra isolada)
  // já sustentam esse piso. A contrapartida é que, num vault grande, a oferta de
  // assuntos cresce e a pressão passa a ser no TETO de exibição (`TETO_TAGS`) —
  // que hoje corta com `break`, e é o próximo ponto a resolver.
  const MINIMO_ARQUIVOS = 2;
  return [...acc.entries()]
    .filter(([, c]) => c.arquivos.size >= MINIMO_ARQUIVOS)
    // Se um termo recorre em vários arquivos mas SÓ como título de seção, ele
    // descreve a estrutura do documento ("Próximos passos", "Validações em
    // aberto"), não o tema. Tema de verdade também é citado no corpo.
    .filter(([, c]) => c.fora > 0 || c.arquivos.size < 3)
    .map(([slug, c]) => ({
      slug,
      label: c.label,
      arquivos: [...c.arquivos].sort(
        (a, b) => (recencia.get(b) ?? 0) - (recencia.get(a) ?? 0),
      ),
      ocorrencias: c.ocorrencias,
    }))
    .sort(
      (a, b) =>
        b.arquivos.length - a.arquivos.length || b.ocorrencias - a.ocorrencias,
    );
}
