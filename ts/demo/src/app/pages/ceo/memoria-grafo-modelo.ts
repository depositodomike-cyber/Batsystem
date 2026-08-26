// ----------------------------------------------------------------------
// Modelo do grafo do Repositório — tipos, paleta e construção.
//
// Extraído de MemoriaGrafo.tsx para separar o QUE o grafo representa (aqui, sem
// React nem canvas) de COMO ele é desenhado (lá). A construção é uma função pura
// `ArquivoMd[] → Graph`, então dá para inspecionar e ajustar a derivação sem
// tocar na simulação.
//
// Duas camadas convivem:
//
//   • ENTIDADES (`pessoa` | `projeto` | `tag`) — o que o canvas mostra por
//     padrão. São o "mapa de relações": quem, onde e sobre o quê.
//   • CONTEÚDOS (`nota` | `pasta` | `tag`) — o grafo de arquivos original,
//     preservado inteiro em `construirGrafoConteudos`. Vira uma camada opcional
//     e o fallback de vaults sem entidades reconhecíveis.
//
// Um documento não precisa virar nó para aparecer: ele entra em `conteudos` da
// entidade e em `fontes` da relação, e o painel o revela sob demanda.
// ----------------------------------------------------------------------

import {
  montarInventario,
  parseNotaMd,
  tituloPadrao,
  type ArquivoMd,
  type ItemContexto,
} from "./memoria-inventario";
import { PASTA_MEMORIA } from "./memoria-pastas";
import {
  extrairTags,
  mencionaRotulo,
  normalizarTexto,
  slugTag,
} from "./grafo-tags";

// ---- Tipos ----

/** Camada primária: o que o usuário reconhece como "coisa", não como arquivo. */
export type EntKind = "pessoa" | "projeto" | "tag";
/** `nota`/`pasta`/`tag` são a camada de conteúdos (o grafo de arquivos original). */
// `tag-hub` é o hub de uma tag de frontmatter na camada de CONTEÚDOS. Nome
// distinto do kind `tag` (entidade) de propósito: são coisas diferentes e
// colidir os dois faria um hub de arquivo se passar por entidade.
// `categoria` é o tema macro descoberto pela IA no backend (vault_categorias).
// Fica FORA de `EntKind` de propósito: `EntKind` governa ehEntidade, o corte por
// relevância, `tagsDisponiveis` (alvos de "+ Relacionar") e as sementes — e a
// categoria teria comportamento errado em quase todos. Ela só compartilha com as
// entidades o fato de abrir o painel de contexto (ver `temContexto`).
export type Kind = "nota" | "pasta" | "tag-hub" | "categoria" | EntKind;
/** `relacao` é a aresta entidade↔entidade, sustentada por documentos (`fontes`). */
export type LinkTipo = "wikilink" | "tag" | "pasta" | "relacao";

export interface GNode {
  /**
   * Contrato de identidade: `nota` e `pessoa` usam o caminho relativo do .md —
   * o MESMO id que `ItemContexto.path` na Lista. É o que permite ir do nó ao
   * arquivo (lerNotaMemoria/salvarNotaMemoria). Hubs sintéticos usam prefixo
   * (`tag::`, `pasta::`) e não têm arquivo.
   */
  id: string;
  kind: Kind;
  pasta: string | null;
  tipo?: string;
  titulo: string;
  grau: number;
  /** Só entidade: paths dos .md que a mencionam, do mais recente ao mais antigo. */
  conteudos?: string[];
  /** Rótulo do badge no painel. Hoje "Tag" para tudo — ver ROTULO_ENTIDADE. */
  rotulo?: string;
  /** Só pessoa: caminho do .md próprio (=== id). Habilita "Abrir nota" sem heurística. */
  notaPath?: string;
  _peso?: number;
  _fase?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}
export interface GLink {
  source: string;
  target: string;
  tipo: LinkTipo;
  /** Só `relacao`: paths dos .md que sustentam a relação. O peso é o tamanho. */
  fontes?: string[];
  /**
   * Relação declarada pelo usuário na nota da tag, não inferida do texto.
   * Nunca é podada e é a única que pode ser removida pela interface — uma
   * relação de co-ocorrência só sai editando os documentos que a produzem.
   */
  manual?: boolean;
}
export interface Graph {
  nodes: GNode[];
  links: GLink[];
}

// ---- Cores (paleta de marca beculture) ----
export const PASTA_COR: Record<string, string> = {
  Reuniões: "#FFCA28",
  Insights: "#C084FC",
  Documentos: "#10B981",
  Notas: "#94A3B8",
  Pessoas: "#F472B6",
  Áudios: "#38BDF8",
  Estratégico: "#FB923C",
};
const PALETA = [
  "#A3E635",
  "#FACC15",
  "#818CF8",
  "#2DD4BF",
  "#FB7185",
  "#C4B5FD",
  "#FDBA74",
  "#F87171",
  "#5EEAD4",
  "#D8B4FE",
];
export const COR_TAG = "#22D3EE";
/** Pessoa reusa a cor fixa da pasta "Pessoas" — nenhuma cor nova no grafo. */
export const COR_PESSOA = PASTA_COR.Pessoas;
/** Categoria reusa a cor da pasta "Estratégico" — também nenhuma cor nova. */
export const COR_CATEGORIA = PASTA_COR.Estratégico;

/**
 * Rótulo do badge por tipo de entidade.
 *
 * Tudo que não é conteúdo se chama "Tag" na interface. Os kinds continuam
 * distintos por dentro — eles governam cor, tamanho, massa na física e as
 * regras de co-ocorrência —, mas essa distinção é de implementação e não
 * ajudava ninguém a ler o mapa. Para quem usa, o grafo tem tags e conteúdos.
 */
export const ROTULO_ENTIDADE: Record<EntKind, string> = {
  pessoa: "Tag",
  projeto: "Tag",
  tag: "Tag",
};

/** `true` para os kinds da camada primária. */
export function ehEntidade(kind: Kind): kind is EntKind {
  return kind === "pessoa" || kind === "projeto" || kind === "tag";
}

/** Categoria também se apresenta como "Tag" — ver ROTULO_ENTIDADE. */
export const ROTULO_CATEGORIA = "Tag";

/** Kinds que abrem o painel de contexto: as entidades e a categoria. */
export type KindComContexto = EntKind | "categoria";

/**
 * O clique neste nó revela contexto no painel?
 *
 * Separado de `ehEntidade` porque as duas perguntas divergiram: categoria abre
 * painel, mas não é entidade (não entra no corte por relevância, não é alvo de
 * relação manual e não conta para `temEntidades`).
 */
export function temContexto(kind: Kind): kind is KindComContexto {
  return ehEntidade(kind) || kind === "categoria";
}

// Mapa pasta→cor único (mesma lógica de montarCoresPastas do beculture).
export function montarCores(pastas: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const usados = new Set<string>();
  for (const p of pastas) {
    const fixa = PASTA_COR[p];
    if (fixa && !usados.has(fixa)) {
      map.set(p, fixa);
      usados.add(fixa);
    }
  }
  const pool = PALETA.filter((c) => !usados.has(c));
  let i = 0;
  for (const p of [...pastas].sort((a, b) => a.localeCompare(b))) {
    if (map.has(p)) continue;
    const cor = pool[i] || PALETA[i % PALETA.length];
    i++;
    map.set(p, cor);
    usados.add(cor);
  }
  return map;
}

// ---- Despacho por kind ----
//
// Os mapas abaixo são `satisfies Record<Kind, …>` de propósito, e não cadeias de
// `if` com um `return` final. Uma cadeia com fallback aceita um kind novo em
// silêncio e o entrega ao ramo errado — massa de folha para um hub, raio por
// grau para um nó que dimensiona por acervo. Com o mapa exaustivo, acrescentar
// um kind é ERRO DE COMPILAÇÃO aqui e em todo consumidor equivalente.

/** Acervo que a entidade carrega, saturado — a base do raio dela. */
function acervo(n: GNode): number {
  return Math.min(n.conteudos?.length ?? 0, 24);
}

/**
 * Raio por kind. Entidades dimensionam pelo acervo que carregam: quanto mais
 * conteúdo uma pessoa/projeto/tag reúne, maior o nó. `grau` não serve para elas
 * porque os documentos saíram do canvas — todas teriam grau parecido.
 */
const RAIO_POR_KIND = {
  pessoa: (n: GNode) => 8 + acervo(n) * 0.6,
  projeto: (n: GNode) => 8 + acervo(n) * 0.6,
  tag: (n: GNode) => 7 + acervo(n) * 0.6,
  // Categoria também dimensiona por acervo: é o hub mais abrangente do mapa.
  categoria: (n: GNode) => 9 + acervo(n) * 0.6,
  pasta: (n: GNode) => 10 + Math.min(n.grau, 20) * 0.7,
  "tag-hub": (n: GNode) => 7 + Math.min(n.grau, 16) * 0.6,
  nota: (n: GNode) => 6 + Math.min(n.grau, 8) * 1.6,
} satisfies Record<Kind, (n: GNode) => number>;

export function raio(n: GNode): number {
  return RAIO_POR_KIND[n.kind](n);
}

/** Massa na repulsão: hubs empurram mais que folhas. */
const PESO_POR_KIND = {
  // Massa de hub, como projeto e pasta. Com massa de folha (o que a antiga
  // cadeia de `if` daria por fallback) um hub ligado a muita coisa seria puxado
  // para o centro e o grafo enrolaria.
  categoria: 2.2,
  projeto: 2.2,
  pasta: 2.2,
  tag: 1.7,
  "tag-hub": 1.7,
  pessoa: 1.9,
  nota: 1,
} satisfies Record<Kind, number>;

export function pesoDoKind(kind: Kind): number {
  return PESO_POR_KIND[kind];
}

/** Comprimento de repouso da mola, por tipo de aresta. */
export function repousoDoLink(tipo: LinkTipo): number {
  if (tipo === "pasta") return 58;
  if (tipo === "tag") return 66;
  if (tipo === "relacao") return 96;
  return 110;
}

// ----------------------------------------------------------------------
// Camada de conteúdos — o grafo de arquivos original, intacto.
// (espelha grafo() de lib/vault.js)
// ----------------------------------------------------------------------

export function construirGrafoConteudos(files: ArquivoMd[]): Graph {
  const notas = files.map((f) => {
    const { titulo, tags, body } = parseNotaMd(f.text);
    const base = tituloPadrao(f.name);
    const seg = f.path.split("/");
    const pasta = seg.length > 1 ? seg[0] : "Raiz";
    return { id: f.path, titulo: titulo || base, base, tags, body, pasta };
  });

  const indice = new Map<string, string>();
  for (const n of notas) {
    indice.set(n.base.toLowerCase(), n.id);
    if (n.titulo) indice.set(n.titulo.toLowerCase(), n.id);
  }

  const nodes: GNode[] = notas.map((n) => ({
    id: n.id,
    kind: "nota",
    pasta: n.pasta,
    tipo: "nota",
    titulo: n.titulo,
    grau: 0,
  }));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const notaNodes = [...nodes];

  const links: GLink[] = [];
  const vistos = new Set<string>();
  const ligar = (
    a: string | undefined,
    b: string | undefined,
    tipo: LinkTipo,
  ) => {
    if (!a || !b || a === b) return;
    const chave = [a, b].sort().join("::");
    if (vistos.has(chave)) return;
    vistos.add(chave);
    links.push({ source: a, target: b, tipo });
    const na = nodeById.get(a);
    const nb = nodeById.get(b);
    if (na) na.grau += 1;
    if (nb) nb.grau += 1;
  };

  const garantirHub = (
    id: string,
    kind: Kind,
    titulo: string,
    pasta: string | null = null,
  ) => {
    if (!nodeById.has(id)) {
      const hub: GNode = { id, kind, titulo, tipo: kind, pasta, grau: 0 };
      nodes.push(hub);
      nodeById.set(id, hub);
    }
    return id;
  };

  // 1) Wikilinks [[...]] — só conectam quando o alvo tem uma nota (.md) de fato.
  // Links não resolvidos ficam de fora desta camada, para não poluí-la com nós
  // soltos. (A camada de entidades faz o oposto de propósito — ver
  // `extrairTags`: lá o alvo sem nota É a entidade que interessa.)
  for (const n of notas) {
    for (const m of n.body.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const alvo = m[1].split("|")[0].split("#")[0].trim().toLowerCase();
      ligar(n.id, indice.get(alvo), "wikilink");
    }
  }

  // 2) Tags (hub só quando 2+ notas usam)
  const tagsPorNota = new Map<string, string[]>();
  const tagCount = new Map<string, number>();
  for (const n of notas) {
    const limpas = [
      ...new Set(n.tags.map((t) => String(t || "").trim()).filter(Boolean)),
    ];
    tagsPorNota.set(n.id, limpas);
    for (const t of limpas)
      tagCount.set(t.toLowerCase(), (tagCount.get(t.toLowerCase()) || 0) + 1);
  }
  for (const n of notaNodes) {
    for (const t of tagsPorNota.get(n.id) || []) {
      if ((tagCount.get(t.toLowerCase()) || 0) < 2) continue;
      ligar(
        n.id,
        garantirHub("tag::" + t.toLowerCase(), "tag-hub", "#" + t),
        "tag",
      );
    }
  }

  // 3) Pastas (hub só quando 2+ notas, pulando a Raiz)
  const pastaCount = new Map<string, number>();
  for (const n of notaNodes) {
    if (n.pasta && n.pasta !== "Raiz")
      pastaCount.set(n.pasta, (pastaCount.get(n.pasta) || 0) + 1);
  }
  for (const n of notaNodes) {
    if (!n.pasta || n.pasta === "Raiz" || (pastaCount.get(n.pasta) || 0) < 2)
      continue;
    ligar(
      n.id,
      garantirHub("pasta::" + n.pasta, "pasta", n.pasta, n.pasta),
      "pasta",
    );
  }

  return { nodes, links };
}

// ----------------------------------------------------------------------
// Camada de entidades — a tag é o nó.
//
// Um nó do canvas é um TERMO que recorre no vault (ver grafo-tags.ts). Quem
// compartilha o termo fica relacionado, e um arquivo com vários termos pertence
// a vários agrupamentos ao mesmo tempo. O arquivo não é nó: é conteúdo dentro
// das tags que o descrevem, revelado no painel.
//
// Pessoa/Projeto/Tag continuam existindo, mas como ATRIBUTO do nó — o que
// entra no grafo é decidido pela recorrência, não por uma taxonomia fixa. É o
// que faz o mesmo código funcionar num vault do produto (cheio de frontmatter)
// e num export de markdown puro.
// ----------------------------------------------------------------------

/** Pastas que são encanamento de vault, nunca projeto. */
const PASTAS_IGNORADAS = new Set(
  [
    "templates",
    "template",
    "anexos",
    "attachments",
    "assets",
    "inbox",
    "arquivo",
    "arquivos",
    "archive",
    "trash",
    "lixeira",
    "daily notes",
    "daily",
  ].map((p) => p.toLowerCase()),
);

/** Gavetas por ação de IA ("Atas", "Documentos"…) — organização, não projeto. */
const PASTAS_CANONICAS = new Set<string>(Object.values(PASTA_MEMORIA));

/** Subpastas que denunciam uma pasta de grupo (ver memoria-grupos.ts). */
const SUBPASTAS_DE_GRUPO = new Set(["Conversas", "Documentos"]);

/**
 * Pasta das notas de tag — ver grafo-relacoes.ts.
 *
 * Uma nota aqui DECLARA as relações da sua tag; não é conteúdo. Entrasse na
 * co-ocorrência como documento comum, `Tags/OKRs.md` (que cita [[LMS]] e
 * [[Público-Alvo]]) ligaria LMS × Público-Alvo entre si — uma relação que
 * ninguém pediu, entre os vizinhos de OKRs — e não ligaria OKRs a nada, porque
 * o título não conta como menção.
 */
export const PASTA_TAGS = "Tags";

/** Cabeçalho do bloco de conexões (mesmo de conexoes-vault.ts, no backend). */
export const TITULO_CONEXOES = "## 🔗 Conexões no Vault";

function ehPastaDeProjeto(nome: string): boolean {
  if (!nome || nome === "Raiz") return false;
  if (PASTAS_CANONICAS.has(nome)) return false;
  if (PASTAS_IGNORADAS.has(nome.toLowerCase())) return false;
  return !/^[._]/.test(nome);
}

/** Alvos de [[wikilink]] de um corpo, já normalizados (sem alias nem heading). */
function alvosDeWikilink(body: string): string[] {
  const alvos: string[] = [];
  for (const m of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const alvo = m[1].split("|")[0].split("#")[0].trim();
    if (alvo) alvos.push(alvo);
  }
  return alvos;
}

/** Quantas tags o canvas comporta antes de virar ruído. */
const TETO_TAGS = 25;
const TETO_ARESTAS = 800;
const TETO_ARESTAS_POR_NO = 8;
/** Uma co-ocorrência única é coincidência; a partir de duas é relação. */
const MIN_FONTES = 2;
/** Quantas relações uma tag precisa ter para valer um nó no canvas. */
const MIN_RELACOES_TAG = 5;
/** Abaixo disto o corte é descartado — ver a salvaguarda em construirGrafoEntidades. */
const MIN_ENTIDADES_APOS_CORTE = 3;

interface Semente {
  slug: string;
  label: string;
  kind: EntKind;
  /** Caminho do .md próprio, quando a entidade tem um. */
  notaPath?: string;
}

/**
 * Entidades declaradas explicitamente pelo produto, que entram no grafo mesmo
 * sem recorrência: elas não são um termo que o texto sugere, são um registro
 * que alguém criou.
 *
 *   • pessoa  — nota classificada como "Pessoa" pelo inventário (pasta `Pessoas`,
 *               tag `pessoa` ou `tipo: pessoa`, escritos por garantirNotasDePessoas)
 *   • projeto — pasta de grupo (`<Grupo>/Conversas|Documentos`, ou nota com tag `grupo`)
 */
function sementesDeclaradas(itens: ItemContexto[]): Semente[] {
  const out: Semente[] = [];
  const vistos = new Set<string>();
  const add = (s: Semente) => {
    if (!s.slug || vistos.has(s.slug)) return;
    vistos.add(s.slug);
    out.push(s);
  };

  for (const it of itens) {
    if (it.tipo === "Pessoa") {
      add({
        slug: slugTag(it.titulo),
        label: it.titulo,
        kind: "pessoa",
        notaPath: it.path,
      });
    }
    const seg = it.path.split("/");
    const ehGrupo =
      (seg.length >= 3 && SUBPASTAS_DE_GRUPO.has(seg[1])) ||
      it.tags.some((t) => t.toLowerCase() === "grupo");
    if (ehGrupo && ehPastaDeProjeto(seg[0])) {
      add({ slug: slugTag(seg[0]), label: seg[0], kind: "projeto" });
    }
  }
  return out;
}

/**
 * Grafo de tags e relações a partir dos .md do vault.
 *
 * Relações são co-ocorrência: tags citadas pelo mesmo documento se ligam, e o
 * documento entra em `fontes`. Pessoa↔Pessoa fica de fora — participantes
 * frequentes co-ocorrem em tudo, dominariam por peso e não informariam nada.
 */
/**
 * Categorias macro vindas do backend (descobertas pela IA). Entram por
 * PARÂMETRO para este módulo seguir puro — o cabeçalho de `grafo-tags.ts`
 * promete "nenhuma chamada de rede", e quem busca é a tela.
 */
export interface CategoriasDoVault {
  categorias: { slug: string; label: string; definicao: string | null }[];
  /** path → slugs das categorias daquela nota. */
  porPath: Record<string, string[]>;
}

export function construirGrafoEntidades(
  itens: ItemContexto[],
  files: ArquivoMd[],
  categorias?: CategoriasDoVault,
): Graph {
  const corpoPorPath = new Map(
    files.map((f) => [f.path, parseNotaMd(f.text).body]),
  );
  const itemPorPath = new Map(itens.map((i) => [i.path, i]));

  // ---- 0) Declarações de tag (pasta `Tags/`) ----
  // Lidas antes de tudo e mantidas FORA da co-ocorrência: são declaração, não
  // conteúdo. Cada uma dá à sua tag um `notaPath` e uma lista de alvos.
  const declaracoes = new Map<
    string,
    { path: string; label: string; alvos: string[] }
  >();
  for (const it of itens) {
    if (it.pasta !== PASTA_TAGS) continue;
    const slug = slugTag(it.titulo);
    if (!slug) continue;
    declaracoes.set(slug, {
      path: it.path,
      label: it.titulo,
      alvos: alvosDeWikilink(corpoPorPath.get(it.path) ?? ""),
    });
  }

  // Slug do título (e do nome do arquivo) → path. É por aqui que uma tag
  // "Checklists" absorve o `checklists.md`, em vez de os dois virarem nós
  // separados com o mesmo rótulo.
  const notaPorSlug = new Map<string, string>();
  for (const it of itens) {
    const base = tituloPadrao(it.path.split("/").pop() ?? "");
    for (const s of [slugTag(it.titulo), slugTag(base)]) {
      if (s && !notaPorSlug.has(s)) notaPorSlug.set(s, it.path);
    }
  }

  // Pastas de grupo, para classificar a tag como Projeto.
  const pastasDeGrupo = new Set<string>();
  for (const it of itens) {
    const seg = it.path.split("/");
    if (
      seg.length >= 3 &&
      SUBPASTAS_DE_GRUPO.has(seg[1]) &&
      ehPastaDeProjeto(seg[0])
    ) {
      pastasDeGrupo.add(slugTag(seg[0]));
    }
    if (
      it.tags.some((t) => t.toLowerCase() === "grupo") &&
      ehPastaDeProjeto(it.pasta)
    ) {
      pastasDeGrupo.add(slugTag(it.pasta));
    }
  }

  const nodes: GNode[] = [];
  const nodeById = new Map<string, GNode>();
  /** slug → id do nó, para resolver menções de volta ao nó. */
  const idPorSlug = new Map<string, string>();
  /** id do nó → paths que o mencionam, sem repetir. */
  const conteudosPorId = new Map<string, Set<string>>();

  const criar = (
    slug: string,
    label: string,
    kind: EntKind,
    notaPath?: string,
  ) => {
    const existente = idPorSlug.get(slug);
    if (existente) return existente;
    // Pessoa mantém o path como id — é o contrato que liga nó ↔ arquivo e o que
    // a Lista usa. As demais tags não têm arquivo garantido, então usam prefixo.
    const id = kind === "pessoa" && notaPath ? notaPath : "tag::" + slug;
    const n: GNode = {
      id,
      kind,
      pasta: notaPath ? (itemPorPath.get(notaPath)?.pasta ?? null) : null,
      titulo: label,
      rotulo: ROTULO_ENTIDADE[kind],
      notaPath,
      grau: 0,
      conteudos: [],
    };
    nodes.push(n);
    nodeById.set(id, n);
    idPorSlug.set(slug, id);
    conteudosPorId.set(id, new Set());
    return id;
  };

  // ---- 1) Sementes declaradas (entram sem depender de recorrência) ----
  for (const s of sementesDeclaradas(itens)) {
    criar(s.slug, s.label, s.kind, s.notaPath ?? notaPorSlug.get(s.slug));
  }

  // ---- 1b) Tags que o usuário declarou ----
  // Relacionar uma tag à mão é uma afirmação de que ela importa: entra no grafo
  // mesmo que o texto tenha deixado de citá-la o bastante para ser recorrente.
  for (const [slug, d] of declaracoes) {
    criar(slug, d.label, "tag", d.path);
  }

  // ---- 2) Tags extraídas do texto, por recorrência ----
  // As declarações ficam de fora da extração: elas são só uma lista de
  // wikilinks, e contá-las daria recorrência artificial às tags citadas e
  // colocaria a nota de declaração como "conteúdo" delas.
  const conteudoDoVault = files.filter(
    (f) => f.path.split("/")[0] !== PASTA_TAGS,
  );
  for (const t of extrairTags(conteudoDoVault)) {
    if (nodes.length >= TETO_TAGS && !idPorSlug.has(t.slug)) break;
    const notaPath = notaPorSlug.get(t.slug);
    const kind: EntKind = pastasDeGrupo.has(t.slug)
      ? "projeto"
      : notaPath && itemPorPath.get(notaPath)?.tipo === "Pessoa"
        ? "pessoa"
        : "tag";
    const id = criar(t.slug, t.label, kind, notaPath);
    const alvo = conteudosPorId.get(id)!;
    for (const p of t.arquivos) alvo.add(p);
  }

  // ---- 2b) Categorias macro (vocabulário descoberto pela IA) ----
  //
  // Entram DEPOIS de sementes, declarações e extração, e pulam slug já tomado.
  // É o guarda contra a IA emitir nome de projeto ou de pessoa como tema: se
  // "Plataforma V1" já é um assunto, ela continua sendo assunto — a categoria
  // não sequestra o nó. Não dependem de recorrência: é o que faz a primeira
  // nota de uma pasta vazia já ter onde se encaixar.
  const idsDeCategoria = new Set<string>();
  for (const c of categorias?.categorias ?? []) {
    if (!c.slug || idPorSlug.has(c.slug)) continue;
    const id = "categoria::" + c.slug;
    const n: GNode = {
      id,
      kind: "categoria",
      pasta: null,
      titulo: c.label,
      rotulo: ROTULO_CATEGORIA,
      grau: 0,
      conteudos: [],
    };
    nodes.push(n);
    nodeById.set(id, n);
    idPorSlug.set(c.slug, id);
    conteudosPorId.set(id, new Set());
    idsDeCategoria.add(id);
  }

  // ---- 3) Que tags cada documento menciona ----
  // As tags extraídas já sabem seus arquivos; falta cobrir as sementes, que
  // podem não ter recorrido no texto (uma pessoa citada uma vez só).
  //
  // Nomes próprios entram por MENÇÃO EM TEXTO PURO, e não só por frontmatter,
  // wikilink ou pasta: sem isso "Michael Silva" escrito no corpo de uma ata não
  // colocava a ata nos conteúdos dele, mesmo o nó dele já existindo. Só liga a
  // nós que JÁ existem — esta passada não cria entidade nenhuma.
  const nomeados = nodes
    .filter((n) => n.kind === "pessoa" || n.kind === "projeto")
    .map((n) => ({ id: n.id, rotulo: normalizarTexto(n.titulo) }));

  for (const it of itens) {
    // Declaração não é conteúdo de ninguém — nem da própria tag.
    if (it.pasta === PASTA_TAGS) continue;
    const body = corpoPorPath.get(it.path) ?? "";
    const mencoes = [
      ...it.tags,
      ...alvosDeWikilink(body),
      // Pasta de grupo: todo arquivo dentro dela pertence ao projeto.
      it.path.split("/")[0],
    ];
    for (const m of mencoes) {
      const id = idPorSlug.get(slugTag(m));
      if (id) conteudosPorId.get(id)!.add(it.path);
    }
    if (nomeados.length > 0) {
      const corpoNorm = normalizarTexto(body);
      for (const n of nomeados) {
        if (mencionaRotulo(corpoNorm, n.rotulo))
          conteudosPorId.get(n.id)!.add(it.path);
      }
    }

    // Categoria vem da classificação persistida, não do texto.
    //
    // Quando o slug colidiu com um nó que já existia, a categoria não foi
    // criada (2b) — mas a classificação continua valendo e o conteúdo vai para
    // o nó que ficou. "Comunicação" declarada como tag e proposta como
    // categoria são o mesmo conceito; descartar o vínculo deixaria a nota
    // órfã só por causa do nome. Só vale para nós de ASSUNTO: jogar um
    // conteúdo dentro de uma pessoa ou de um projeto por homonímia seria erro.
    for (const slug of categorias?.porPath[it.path] ?? []) {
      const id = idPorSlug.get(slug);
      if (!id) continue;
      const alvo = nodeById.get(id);
      if (alvo && (alvo.kind === "categoria" || alvo.kind === "tag")) {
        conteudosPorId.get(id)!.add(it.path);
      }
    }
  }

  // Conteúdos do mais recente ao mais antigo; a nota própria da entidade não
  // conta como conteúdo dela.
  for (const n of nodes) {
    const paths = [...(conteudosPorId.get(n.id) ?? [])].filter(
      (p) => p !== n.notaPath,
    );
    paths.sort(
      (a, b) =>
        (itemPorPath.get(b)?.modificadoEm ?? 0) -
        (itemPorPath.get(a)?.modificadoEm ?? 0),
    );
    n.conteudos = paths;
  }

  // ---- 4) Relações por co-ocorrência ----
  const tagsPorDoc = new Map<string, string[]>();
  for (const n of nodes) {
    for (const p of n.conteudos ?? []) {
      const lista = tagsPorDoc.get(p);
      if (lista) lista.push(n.id);
      else tagsPorDoc.set(p, [n.id]);
    }
  }

  const rel = new Map<string, { a: string; b: string; fontes: string[] }>();
  for (const [path, ids] of tagsPorDoc) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const na = nodeById.get(ids[i])!;
        const nb = nodeById.get(ids[j])!;
        // Pessoa↔Pessoa satura o grafo sem informar: dois participantes
        // frequentes co-ocorrem em tudo. A relação útil é entre kinds
        // diferentes ("Mike × V2", "Mike × Arquitetura").
        if (na.kind === "pessoa" && nb.kind === "pessoa") continue;
        // Categoria↔Categoria pelo MESMO motivo, e com força ainda maior: temas
        // macro dividem quase todo documento, e ligá-los entre si viraria um
        // novelo de arestas óbvias ("Produto × Estratégia" com peso 20). A
        // relação que informa é Categoria×Assunto ("Produto × Plataforma V1").
        if (na.kind === "categoria" && nb.kind === "categoria") continue;
        const [a, b] = [na.id, nb.id].sort();
        const chave = a + "::" + b;
        const atual = rel.get(chave);
        if (atual) atual.fontes.push(path);
        else rel.set(chave, { a, b, fontes: [path] });
      }
    }
  }

  // ---- 5) Relações declaradas pelo usuário ----
  // Entram ANTES da poda e não passam por ela: uma relação criada à mão tem uma
  // fonte só (a própria declaração) e seria descartada por `MIN_FONTES`.
  const porNo = new Map<string, number>();
  const links: GLink[] = [];
  const manuais = new Set<string>();
  for (const [slug, d] of declaracoes) {
    const origem = idPorSlug.get(slug);
    if (!origem) continue;
    for (const alvo of d.alvos) {
      const destino = idPorSlug.get(slugTag(alvo));
      // Alvo sem tag no grafo é ignorado em silêncio, como todo wikilink não
      // resolvido: se a tag voltar, a relação reaparece sozinha.
      if (!destino || destino === origem) continue;
      const [a, b] = [origem, destino].sort();
      const chave = a + "::" + b;
      if (manuais.has(chave)) continue;
      manuais.add(chave);
      porNo.set(a, (porNo.get(a) ?? 0) + 1);
      porNo.set(b, (porNo.get(b) ?? 0) + 1);
      links.push({
        source: a,
        target: b,
        tipo: "relacao",
        fontes: [d.path],
        manual: true,
      });
      nodeById.get(a)!.grau += 1;
      nodeById.get(b)!.grau += 1;
    }
  }

  // ---- 6) Poda: mantém as relações de co-ocorrência mais sustentadas ----
  const candidatas = [...rel.values()]
    .filter((r) => r.fontes.length >= MIN_FONTES)
    .filter((r) => !manuais.has(r.a + "::" + r.b))
    .sort((a, b) => b.fontes.length - a.fontes.length);

  for (const r of candidatas) {
    if (links.length >= TETO_ARESTAS) break;
    const ca = porNo.get(r.a) ?? 0;
    const cb = porNo.get(r.b) ?? 0;
    if (ca >= TETO_ARESTAS_POR_NO || cb >= TETO_ARESTAS_POR_NO) continue;
    porNo.set(r.a, ca + 1);
    porNo.set(r.b, cb + 1);
    links.push({ source: r.a, target: r.b, tipo: "relacao", fontes: r.fontes });
    nodeById.get(r.a)!.grau += 1;
    nodeById.get(r.b)!.grau += 1;
  }

  // ---- 7) Corte por relevância ----
  // Uma tag que se liga a pouca coisa não ajuda a ler o mapa: ocupa espaço e
  // não conta história nenhuma. Só as tags passam pelo corte — Pessoas e
  // Projetos são entidades declaradas, não termos inferidos do texto.
  //
  // Tag que o usuário relacionou à mão fica, qualquer que seja o grau: ele já
  // disse que ela importa, e essas relações nascem justamente com grau baixo.
  const comRelacaoManual = new Set<string>();
  for (const l of links) {
    if (!l.manual) continue;
    comRelacaoManual.add(l.source);
    comRelacaoManual.add(l.target);
  }
  const fica = (n: GNode) =>
    n.kind !== "tag" ||
    n.grau >= MIN_RELACOES_TAG ||
    comRelacaoManual.has(n.id);

  const temSubstancia = (n: GNode) =>
    n.grau > 0 || (n.conteudos?.length ?? 0) > 0;
  const cortados = nodes.filter((n) => fica(n) && temSubstancia(n));

  // SALVAGUARDA — o corte não pode esvaziar a camada de entidades.
  //
  // Num vault onde as tags se conectam pouco, o limiar derruba todas: o grafo
  // fica sem entidade nenhuma, `temEntidades` vira false e o consumidor cai no
  // fallback da camada de conteúdos — que É o grafo de arquivos antigo, com o
  // comportamento antigo (clique abre o .md, sem painel de contexto). O corte
  // acabaria produzindo exatamente o oposto do que pretende.
  //
  // Quando isso aconteceria, o corte simplesmente não se aplica: um mapa com
  // tags pouco conectadas ainda é um mapa de temas, e é melhor que voltar ao
  // mapa de arquivos.
  // `ehEntidade` e não `temContexto`: categoria não conta aqui. Ela existe
  // sempre que houver classificação, então contá-la faria a salvaguarda achar
  // que há entidades mesmo num vault sem termo recorrente nenhum — e o corte
  // passaria a se aplicar justamente no caso que a salvaguarda protege.
  const restantes = cortados.filter((n) => ehEntidade(n.kind));
  const corteViavel =
    restantes.length >= MIN_ENTIDADES_APOS_CORTE &&
    restantes.some((n) => n.grau > 0);
  const vivos = corteViavel
    ? cortados
    : nodes.filter(temSubstancia);
  // Um corte em cascata (remover, recalcular graus, remover de novo) esvaziaria
  // o grafo aos poucos e o resultado dependeria da ordem. Uma passada só é
  // previsível: o que sobra são os nós que passavam no critério ANTES do corte.
  const idsVivos = new Set(vivos.map((n) => n.id));
  const arestasVivas = links.filter(
    (l) => idsVivos.has(l.source) && idsVivos.has(l.target),
  );
  return { nodes: vivos, links: arestasVivas };
}

export interface GrafoDoVault {
  /** Camada primária. Vazia quando não há termo recorrente no vault. */
  entidades: Graph;
  /** Camada de conteúdos — o grafo de arquivos original, sempre disponível. */
  conteudos: Graph;
  /** Inventário compartilhado com a Lista, indexado por path pelo consumidor. */
  itens: ItemContexto[];
  /** `true` quando há tags suficientes para o canvas abrir só com elas. */
  temEntidades: boolean;
}

/** Ponto de entrada único: lê os .md uma vez e devolve as duas camadas. */
export function construirGrafoDoVault(
  files: ArquivoMd[],
  categorias?: CategoriasDoVault,
): GrafoDoVault {
  const itens = montarInventario(files);
  const entidades = construirGrafoEntidades(itens, files, categorias);
  return {
    entidades,
    conteudos: construirGrafoConteudos(files),
    itens,
    // Com as tags vindas do texto, um vault sem nenhum termo recorrente é raro
    // de verdade. Quando acontece, a camada de conteúdos assume e o grafo abre
    // como sempre, em vez de vir vazio.
    //
    // Categoria NÃO conta: ela existe sempre que houver classificação, e
    // contá-la tornaria esta condição sempre verdadeira — matando o fallback
    // para a camada de conteúdos exatamente no vault que precisa dele.
    temEntidades:
      entidades.nodes.some((n) => ehEntidade(n.kind)) &&
      entidades.links.length > 0,
  };
}

/**
 * Une as duas camadas num só grafo.
 *
 * Deduplica por id E por rótulo: um nó de conteúdo com o mesmo nome de uma tag
 * (o `checklists.md` da tag "Checklists", o hub `pasta::X` do projeto "X") é
 * absorvido pela tag, que herda o caminho do arquivo. Sem isso os dois
 * apareceriam lado a lado com o mesmo texto e não haveria como distingui-los.
 */
export function unirCamadas(entidades: Graph, conteudos: Graph): Graph {
  const nodes = [...entidades.nodes];
  const ids = new Set(nodes.map((n) => n.id));
  const porRotulo = new Map<string, GNode>();
  for (const n of nodes) {
    const s = slugTag(n.titulo);
    if (s && !porRotulo.has(s)) porRotulo.set(s, n);
  }

  /** id da camada de conteúdos → id do nó que ficou com ele. */
  const absorvido = new Map<string, string>();
  for (const n of conteudos.nodes) {
    if (ids.has(n.id)) {
      absorvido.set(n.id, n.id);
      continue;
    }
    const dono = porRotulo.get(slugTag(n.titulo));
    if (dono) {
      absorvido.set(n.id, dono.id);
      // A tag passa a saber qual arquivo carrega o mesmo nome, e o painel ganha
      // o botão "Abrir nota".
      if (!dono.notaPath && n.kind === "nota") dono.notaPath = n.id;
      continue;
    }
    nodes.push(n);
    ids.add(n.id);
  }

  const links = [...entidades.links];
  const vistos = new Set(
    entidades.links.map((l) => [l.source, l.target].sort().join("::")),
  );
  for (const l of conteudos.links) {
    const s = absorvido.get(l.source) ?? l.source;
    const t = absorvido.get(l.target) ?? l.target;
    if (s === t || !ids.has(s) || !ids.has(t)) continue;
    const chave = [s, t].sort().join("::");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    links.push({ ...l, source: s, target: t });
  }
  return { nodes, links };
}
