// ----------------------------------------------------------------------
// Grafo — componente standalone do grafo force-directed do Repositório.
//
// Extraído de ts/demo/src/app/pages/ceo/MemoriaGrafo.tsx (+ constantes de
// memoria-grafo-modelo.ts). Contém SÓ o motor visual: física, câmera
// (zoom/pan/pinça), desenho em <canvas> 2D, hit-test de nós e arestas,
// tooltip e seleção. Não lê pasta, não chama API, não depende de Tailwind,
// roteador nem de nenhum componente do app — a única dependência é React.
//
// Os dados entram prontos por `graph` (nós + arestas). Tudo o que o canvas
// produz sai por callbacks (`onSelecao`, `onClicarNota`) e o que o app manda
// para o canvas entra pelo ref imperativo (`GrafoHandle`).
//
// Documentação completa: README.md nesta mesma pasta.
// ----------------------------------------------------------------------

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

// ---- Tipos ----

/** Entidades: a camada primária ("coisas" que o usuário reconhece). */
export type EntKind = "pessoa" | "projeto" | "tag";
/**
 * `nota`/`pasta`/`tag-hub` são a camada de conteúdos (grafo de arquivos).
 * `categoria` é o tema macro: abre contexto como uma entidade, mas não é uma.
 */
export type Kind = "nota" | "pasta" | "tag-hub" | "categoria" | EntKind;
/** `relacao` é a aresta entidade↔entidade, sustentada por documentos (`fontes`). */
export type LinkTipo = "wikilink" | "tag" | "pasta" | "relacao";
/** Kinds cujo clique emite uma seleção de contexto. */
export type KindComContexto = EntKind | "categoria";

export interface GNode {
  /** Identificador único e estável (ex.: caminho do .md, `tag::slug`). */
  id: string;
  kind: Kind;
  /** Pasta de origem; define a cor de `nota`/`projeto`/`pasta`. `"Raiz"` = sem pasta. */
  pasta: string | null;
  tipo?: string;
  /** Rótulo desenhado no canvas e no tooltip. */
  titulo: string;
  /** Número de arestas. Base do raio de `nota`/`pasta`/`tag-hub`. */
  grau: number;
  /** Só entidades/categoria: ids dos conteúdos que a citam. Base do raio. */
  conteudos?: string[];
  /** Texto do badge repassado na seleção (ex.: "Tag"). */
  rotulo?: string;
  /** Arquivo próprio da entidade, quando existe. Repassado na seleção. */
  notaPath?: string;
  // Estado interno da simulação — preenchido pelo componente, ignore na entrada.
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
  /** Só `relacao`: ids dos documentos que sustentam a relação (peso = tamanho). */
  fontes?: string[];
  /** Relação declarada à mão (a única que a UI deveria permitir remover). */
  manual?: boolean;
}

export interface Graph {
  nodes: GNode[];
  links: GLink[];
}

/** Vizinho de uma entidade, resolvido no instante do clique. */
export interface RelacaoVizinha {
  id: string;
  titulo: string;
  rotulo: string;
  peso: number;
  manual?: boolean;
}

/**
 * O que foi selecionado no canvas. SEMPRE dado plano copiado no clique —
 * nunca um GNode vivo, que a simulação muta a cada quadro.
 */
export type Selecao =
  | {
      tipo: "entidade";
      id: string;
      titulo: string;
      rotulo: string;
      kind: KindComContexto;
      notaPath?: string;
      relacoes: RelacaoVizinha[];
      conteudos: string[];
    }
  | {
      tipo: "relacao";
      aId: string;
      aTitulo: string;
      bId: string;
      bTitulo: string;
      fontes: string[];
    };

/** Comandos imperativos (via `ref`) — mudam o canvas SEM re-semear o layout. */
export interface GrafoHandle {
  /** Seleciona o nó (como um clique). Ignora ids inexistentes ou ocultos. */
  selecionar(id: string): void;
  /** Recalcula a seleção do nó sem acordar a física (ex.: após ligar/desligar). */
  reselecionar(id: string): void;
  /** Adiciona uma aresta `relacao` manual entre dois nós existentes. */
  ligar(aId: string, bId: string): void;
  /** Remove a aresta manual entre dois nós (co-ocorrência não é removida). */
  desligar(aId: string, bId: string): void;
  /** Tira o realce e a aresta selecionada (não dispara `onSelecao`). */
  limparSelecao(): void;
  /** Volta ao enquadramento automático (mesmo efeito do duplo clique no vazio). */
  enquadrar(): void;
}

export interface GrafoProps {
  /** Dados. Trocar a REFERÊNCIA re-semeia o layout — memoize no consumidor. */
  graph: Graph;
  /** Tema escuro. Muda paleta de rótulos/arestas/fundo (re-semeia o layout). */
  dark?: boolean;
  /** Modo "pensando": respiração, agitação e pulsos correndo pelas arestas. */
  animando?: boolean;
  /** Kinds escondidos. Alternar NÃO re-semeia: só remarca visibilidade. */
  kindsOcultos?: readonly Kind[];
  /** Sobrescreve a cor fixa por kind. `null` = cor derivada da pasta. */
  corPorKind?: Partial<Record<Kind, string | null>>;
  /** Clique em entidade/categoria ou em uma aresta. */
  onSelecao?: (s: Selecao) => void;
  /** Clique em um nó `nota` (camada de conteúdos). */
  onClicarNota?: (id: string, titulo: string) => void;
  /** Texto do tooltip de aresta. Padrão: "A × B · N conteúdos". */
  tooltipRelacao?: (a: GNode, b: GNode, fontes: string[]) => string;
  /** Cor de fundo do container. Padrão: #f8fafc (claro) / #0b1220 (escuro). */
  fundo?: string;
  className?: string;
  style?: CSSProperties;
  /** Overlays (painel, legenda, estados vazios). Ficam por cima do canvas. */
  children?: ReactNode;
}

// ---- Paleta ----

export const PASTA_COR: Record<string, string> = {
  Reuniões: "#FFCA28",
  Insights: "#C084FC",
  Documentos: "#10B981",
  Notas: "#94A3B8",
  Pessoas: "#F472B6",
  Áudios: "#38BDF8",
  Estratégico: "#FB923C",
};
export const PALETA = [
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
export const COR_PESSOA = PASTA_COR.Pessoas;
export const COR_CATEGORIA = PASTA_COR.Estratégico;
const COR_NEUTRA = "#94A3B8";

/** Cor fixa por kind; `null` significa "a cor vem da pasta do nó". */
export const COR_POR_KIND = {
  tag: COR_TAG,
  "tag-hub": COR_TAG,
  pessoa: COR_PESSOA,
  categoria: COR_CATEGORIA,
  projeto: null,
  pasta: null,
  nota: null,
} satisfies Record<Kind, string | null>;

/** Mapa pasta→cor único: cores fixas de PASTA_COR primeiro, depois PALETA. */
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
// `satisfies Record<Kind, …>`: um kind novo vira erro de compilação aqui, em
// vez de cair em silêncio num fallback errado.

export function ehEntidade(kind: Kind): kind is EntKind {
  return kind === "pessoa" || kind === "projeto" || kind === "tag";
}

export function temContexto(kind: Kind): kind is KindComContexto {
  return ehEntidade(kind) || kind === "categoria";
}

const acervo = (n: GNode) => Math.min(n.conteudos?.length ?? 0, 24);

const RAIO_POR_KIND = {
  pessoa: (n: GNode) => 8 + acervo(n) * 0.6,
  projeto: (n: GNode) => 8 + acervo(n) * 0.6,
  tag: (n: GNode) => 7 + acervo(n) * 0.6,
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

// ---- Componente ----

type Aresta = {
  source: GNode;
  target: GNode;
  tipo: LinkTipo;
  fontes?: string[];
  manual?: boolean;
};

const tooltipPadrao = (a: GNode, b: GNode, fontes: string[]) => {
  const n = fontes.length;
  return (
    `${a.titulo} × ${b.titulo}` +
    (n ? ` · ${n} ${n === 1 ? "conteúdo" : "conteúdos"}` : "")
  );
};

const ESTILO_TOOLTIP: CSSProperties = {
  position: "fixed",
  zIndex: 60,
  display: "none",
  pointerEvents: "none",
  padding: "4px 8px",
  borderRadius: 6,
  font: "12px Inter, system-ui, sans-serif",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)",
};

export const Grafo = forwardRef<GrafoHandle, GrafoProps>(function Grafo(
  {
    graph,
    dark = false,
    animando = false,
    kindsOcultos,
    corPorKind,
    onSelecao,
    onClicarNota,
    tooltipRelacao,
    fundo,
    className,
    style,
    children,
  },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  // Canal React → canvas. O loop lê estes refs a cada quadro; passá-los como
  // deps do effect remontaria a simulação e jogaria os nós de volta ao seed().
  const animandoRef = useRef(animando);
  animandoRef.current = animando;
  const ocultosChave = [...(kindsOcultos ?? [])].sort().join("|");
  const ocultosRef = useRef(ocultosChave);
  ocultosRef.current = ocultosChave;
  const coresRef = useRef(corPorKind);
  coresRef.current = corPorKind;
  // Canal canvas → React: reatribuído a cada render, lido na hora do clique.
  const onSelecaoRef = useRef(onSelecao);
  onSelecaoRef.current = onSelecao;
  const onClicarNotaRef = useRef(onClicarNota);
  onClicarNotaRef.current = onClicarNota;
  const tooltipRef = useRef(tooltipRelacao ?? tooltipPadrao);
  tooltipRef.current = tooltipRelacao ?? tooltipPadrao;

  const comandosRef = useRef<GrafoHandle | null>(null);
  useImperativeHandle(
    ref,
    () => ({
      selecionar: (id) => comandosRef.current?.selecionar(id),
      reselecionar: (id) => comandosRef.current?.reselecionar(id),
      ligar: (a, b) => comandosRef.current?.ligar(a, b),
      desligar: (a, b) => comandosRef.current?.desligar(a, b),
      limparSelecao: () => comandosRef.current?.limparSelecao(),
      enquadrar: () => comandosRef.current?.enquadrar(),
    }),
    [],
  );

  // ---- Simulação ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (graph.nodes.length === 0) {
      const dprc = window.devicePixelRatio || 1;
      canvas.width = wrap.clientWidth * dprc;
      canvas.height = wrap.clientHeight * dprc;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      comandosRef.current = null;
      return;
    }

    // Paleta dependente do tema.
    const LABEL = dark ? "rgba(226,232,240,.7)" : "rgba(51,65,85,.85)";
    const LABEL_HL = dark ? "#FFFFFF" : "#0f172a";
    const PASTA_FILL = dark ? "rgba(15,23,42,.85)" : "rgba(248,250,252,.92)";
    const corLink = (tipo: LinkTipo, a: number): string => {
      if (tipo === "wikilink") return `rgba(255,202,40,${a})`;
      if (tipo === "tag") return `rgba(34,211,238,${a})`;
      return dark ? `rgba(148,163,184,${a})` : `rgba(100,116,139,${a})`;
    };

    const pastasPresentes = [
      ...new Set(
        graph.nodes
          .filter((n) => n.kind === "nota" || n.kind === "projeto")
          .map((n) => n.pasta)
          .filter((p): p is string => !!p && p !== "Raiz"),
      ),
    ];
    const corPasta = montarCores(pastasPresentes);
    const nodeColor = (n: GNode): string => {
      const custom = coresRef.current?.[n.kind];
      const fixa = custom !== undefined ? custom : COR_POR_KIND[n.kind];
      if (fixa) return fixa;
      if (n.pasta && n.pasta !== "Raiz")
        return corPasta.get(n.pasta) || PASTA_COR[n.pasta] || COR_NEUTRA;
      return COR_NEUTRA;
    };

    let W = 0;
    let H = 0;
    let dpr = 1;
    let raf = 0;
    let t = 0;
    let buscando = false;

    // Cópia local: a simulação muta x/y/vx/vy sem tocar no objeto do consumidor.
    const nodes: GNode[] = graph.nodes.map((n, i) => ({
      ...n,
      _peso: pesoDoKind(n.kind),
      _fase: (i * 0.618) % 6.283,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    }));
    const idx = new Map(nodes.map((n) => [n.id, n]));
    const links: Aresta[] = graph.links
      .map((l) => ({
        source: idx.get(l.source)!,
        target: idx.get(l.target)!,
        tipo: l.tipo,
        fontes: l.fontes,
        manual: l.manual,
      }))
      .filter((l) => l.source && l.target);

    // ---- Visibilidade por FLAG ----
    // Nunca recria `nodes`/`links`: ligar/desligar um kind preserva o layout.
    const visiveis = new Set<GNode>();
    const nosVisiveis: GNode[] = [];
    const arestasVisiveis: Aresta[] = [];
    let ocultosAplicados = "";
    function aplicarFiltros(chave: string) {
      const ocultos = new Set(chave ? chave.split("|") : []);
      visiveis.clear();
      nosVisiveis.length = 0;
      for (const n of nodes) {
        if (ocultos.has(n.kind)) continue;
        visiveis.add(n);
        nosVisiveis.push(n);
      }
      arestasVisiveis.length = 0;
      for (const l of links) {
        if (visiveis.has(l.source) && visiveis.has(l.target))
          arestasVisiveis.push(l);
      }
    }
    ocultosAplicados = ocultosRef.current;
    aplicarFiltros(ocultosAplicados);

    let dragging: GNode | null = null;
    let hover: GNode | null = null;
    let highlighted = new Set<string>();
    let arestaHover: Aresta | null = null;
    let arestaSob: Aresta | null = null;
    let arestaSelecionada: Aresta | null = null;

    /** Peso da relação — só entra na tolerância de clique, não no traço. */
    const espessura = (l: Aresta) =>
      1 + Math.min(l.fontes?.length ?? 1, 8) * 0.25;
    const mouse = { x: 0, y: 0, down: false, moved: false };
    const mouseW = { x: 0, y: 0 };

    // ---- Câmera ----
    // Mundo ilimitado; a câmera reenquadra para o grafo caber inteiro.
    const view = { scale: 1, ox: 0, oy: 0 };
    let autoFit = true;
    let panning = false;
    const panStart = { x: 0, y: 0, ox: 0, oy: 0 };

    function computeFit(): { scale: number; ox: number; oy: number } | null {
      if (!nosVisiveis.length || !W || !H) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of nosVisiveis) {
        const r = raio(n) + 24; // glow + rótulo
        if (n.x! - r < minX) minX = n.x! - r;
        if (n.y! - r < minY) minY = n.y! - r;
        if (n.x! + r > maxX) maxX = n.x! + r;
        if (n.y! + r > maxY) maxY = n.y! + r;
      }
      const bw = Math.max(1, maxX - minX);
      const bh = Math.max(1, maxY - minY);
      let scale = Math.min(W / bw, H / bh) * 0.9;
      scale = Math.max(0.03, Math.min(scale, 1.4));
      const cxw = (minX + maxX) / 2;
      const cyw = (minY + maxY) / 2;
      return { scale, ox: W / 2 - cxw * scale, oy: H / 2 - cyw * scale };
    }

    // ---- Sono da física ----
    let quieto = 0;
    const MOV_MIN = 0.05;
    const FRAMES_PARADO = 45;
    const acordar = () => {
      quieto = 0;
    };

    function seed() {
      // Usa as dimensões reais do container: com W=H=0 todos os nós nasceriam
      // em (0,0), a direção da repulsão seria nula e o grafo colapsaria.
      const w = W || wrap!.clientWidth || 1000;
      const h = H || wrap!.clientHeight || 700;
      for (const n of nodes) {
        n.x = w / 2 + (Math.random() - 0.5) * Math.min(w, 900);
        n.y = h / 2 + (Math.random() - 0.5) * Math.min(h, 700);
      }
    }

    function step(): number {
      const C = 3600 + nosVisiveis.length * 12; // repulsão adaptativa
      const K = 0.013; // rigidez das molas
      const G = 0.009; // gravidade ao centro
      const DAMP = 0.9;
      const VMAX = 14;

      for (let i = 0; i < nosVisiveis.length; i++) {
        const a = nosVisiveis[i];
        for (let j = i + 1; j < nosVisiveis.length; j++) {
          const b = nosVisiveis[j];
          const dx = a.x! - b.x!;
          const dy = a.y! - b.y!;
          const d2 = dx * dx + dy * dy || 0.01;
          const f = (C / d2) * (a._peso || 1) * (b._peso || 1);
          const d = Math.sqrt(d2);
          a.vx! += (dx / d) * f;
          a.vy! += (dy / d) * f;
          b.vx! -= (dx / d) * f;
          b.vy! -= (dy / d) * f;
        }
      }
      for (const l of arestasVisiveis) {
        const dx = l.target.x! - l.source.x!;
        const dy = l.target.y! - l.source.y!;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - repousoDoLink(l.tipo)) * K;
        l.source.vx! += (dx / d) * f;
        l.source.vy! += (dy / d) * f;
        l.target.vx! -= (dx / d) * f;
        l.target.vy! -= (dy / d) * f;
      }
      const cx = W / 2;
      const cy = H / 2;
      let maxMov = 0;
      for (const n of nosVisiveis) {
        n.vx! += (cx - n.x!) * G;
        n.vy! += (cy - n.y!) * G;
        if (buscando) {
          n.vx! += (Math.random() - 0.5) * 0.9;
          n.vy! += (Math.random() - 0.5) * 0.9;
        }
        if (n === dragging) {
          n.x = mouseW.x;
          n.y = mouseW.y;
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx! *= DAMP;
        n.vy! *= DAMP;
        const sp = Math.sqrt(n.vx! * n.vx! + n.vy! * n.vy!);
        if (sp > VMAX) {
          n.vx = (n.vx! / sp) * VMAX;
          n.vy = (n.vy! / sp) * VMAX;
        }
        const x0 = n.x!;
        const y0 = n.y!;
        n.x! += n.vx!;
        n.y! += n.vy!;
        maxMov = Math.max(maxMov, Math.abs(n.x! - x0), Math.abs(n.y! - y0));
      }
      return maxMov;
    }

    /** Assenta o layout em rajada (até 3000 passos) antes do 1º quadro. */
    function preaquecer() {
      if (!nosVisiveis.length || !W || !H) return;
      if (buscando || dragging) {
        acordar();
        return;
      }
      let parados = 0;
      for (let i = 0; i < 3000; i++) {
        if (step() < MOV_MIN) {
          if (++parados >= 10) break;
        } else parados = 0;
      }
      quieto = FRAMES_PARADO;
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const poucos = nosVisiveis.length <= 40;
      // `inv` mantém traços e rótulos com tamanho constante na tela.
      const inv = 1 / view.scale;

      ctx.save();
      if (buscando) {
        const esc = 1 + Math.sin(t * 1.6) * 0.12;
        ctx.translate(W / 2, H / 2);
        ctx.scale(esc, esc);
        ctx.translate(-W / 2, -H / 2);
      }
      ctx.translate(view.ox, view.oy);
      ctx.scale(view.scale, view.scale);

      const brilho = buscando ? 0.14 + (Math.sin(t * 3) + 1) * 0.13 : 0;
      for (const l of arestasVisiveis) {
        const ativo =
          l === arestaSelecionada ||
          l === arestaHover ||
          highlighted.has(l.source.id) ||
          highlighted.has(l.target.id) ||
          l.source === hover ||
          l.target === hover;
        const dim = l.tipo === "wikilink" ? 0.18 : 0.12;
        const base = ativo ? 0.6 : dark ? dim : dim * 1.7;
        ctx.strokeStyle = corLink(l.tipo, Math.min(base + brilho, 0.85));
        ctx.lineWidth = (ativo ? 1.6 : 1) * inv;
        ctx.setLineDash(
          l.tipo === "pasta"
            ? [2 * inv, 4 * inv]
            : l.tipo === "tag" || l.tipo === "relacao"
              ? [5 * inv, 4 * inv]
              : [],
        );
        ctx.beginPath();
        ctx.moveTo(l.source.x!, l.source.y!);
        ctx.lineTo(l.target.x!, l.target.y!);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      if (buscando) {
        ctx.shadowColor = "#FFCA28";
        ctx.shadowBlur = 10 * view.scale;
        ctx.fillStyle = "rgba(255,213,79,.95)";
        for (let k = 0; k < arestasVisiveis.length; k++) {
          const l = arestasVisiveis[k];
          const f = (t * 0.55 + k * 0.17) % 1;
          ctx.beginPath();
          ctx.arc(
            l.source.x! + (l.target.x! - l.source.x!) * f,
            l.source.y! + (l.target.y! - l.source.y!) * f,
            2.2 * inv,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      for (const n of nosVisiveis) {
        const cor = nodeColor(n);
        const r = raio(n);
        const destaque = highlighted.has(n.id) || n === hover;
        ctx.shadowColor = cor;
        let blur = destaque ? 22 : highlighted.size ? 4 : 12;
        blur += buscando
          ? 9 + Math.sin(t * 4 + (n._fase || 0)) * 7
          : Math.sin(t * 1.4 + (n._fase || 0)) * 2.2;
        ctx.shadowBlur = Math.max(0, blur) * view.scale;
        ctx.globalAlpha = highlighted.size && !destaque ? 0.35 : 1;
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, r, 0, Math.PI * 2);
        if (n.kind === "pasta" || n.kind === "projeto") {
          ctx.fillStyle = PASTA_FILL;
          ctx.fill();
          ctx.lineWidth = 2.2 * inv;
          ctx.strokeStyle = cor;
          ctx.stroke();
        } else {
          ctx.fillStyle = cor;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Hubs/entidades sempre rotulados; notas só com poucos nós ou em destaque.
        const hub = n.kind !== "nota";
        if (hub || poucos || destaque) {
          ctx.fillStyle = destaque ? LABEL_HL : hub ? cor : LABEL;
          ctx.font =
            (hub ? "600 " : "") + `${11 * inv}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          const rotulo = n.titulo || "";
          ctx.fillText(
            rotulo.length > 26 ? rotulo.slice(0, 25) + "…" : rotulo,
            n.x!,
            n.y! + r + 13 * inv,
          );
        }
      }

      ctx.restore();
    }

    function loop() {
      t += 0.016;
      const anim = animandoRef.current;
      if (anim !== buscando) {
        buscando = anim;
        acordar();
      }
      if (ocultosRef.current !== ocultosAplicados) {
        ocultosAplicados = ocultosRef.current;
        aplicarFiltros(ocultosAplicados);
        if (arestaSelecionada && !arestasVisiveis.includes(arestaSelecionada))
          arestaSelecionada = null;
        arestaHover = null;
        autoFit = true;
        acordar();
      }
      const dormindo = quieto >= FRAMES_PARADO && !dragging && !buscando;
      if (!dormindo) {
        const mov = step();
        if (mov < MOV_MIN && !dragging && !buscando) quieto++;
        else quieto = 0;
      }
      if (autoFit) {
        const f = computeFit();
        if (f) {
          const k = 0.08;
          view.scale += (f.scale - view.scale) * k;
          view.ox += (f.ox - view.ox) * k;
          view.oy += (f.oy - view.oy) * k;
        }
      }
      draw();
      raf = requestAnimationFrame(loop);
    }

    function resize() {
      dpr = window.devicePixelRatio || 1;
      W = wrap!.clientWidth;
      H = wrap!.clientHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      preaquecer();
      if (autoFit) {
        const f = computeFit();
        if (f) Object.assign(view, f);
      }
    }

    // ---- Hit-test ----
    function posMouse(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function toWorld(sx: number, sy: number) {
      return { x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale };
    }
    function noEm(wx: number, wy: number): GNode | null {
      const tol = 6 / view.scale;
      for (let i = nosVisiveis.length - 1; i >= 0; i--) {
        const n = nosVisiveis[i];
        const dx = n.x! - wx;
        const dy = n.y! - wy;
        if (dx * dx + dy * dy <= (raio(n) + tol) ** 2) return n;
      }
      return null;
    }
    /** Distância ponto→segmento; perto das pontas, o nó ganha o clique. */
    function arestaEm(wx: number, wy: number): Aresta | null {
      const tol = 6 / view.scale;
      let melhor: Aresta | null = null;
      let melhorD = Infinity;
      for (const l of arestasVisiveis) {
        const ax = l.source.x!;
        const ay = l.source.y!;
        const bx = l.target.x!;
        const by = l.target.y!;
        const dx = bx - ax;
        const dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1e-6) continue;
        let u = ((wx - ax) * dx + (wy - ay) * dy) / len2;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        const d = Math.hypot(wx - (ax + dx * u), wy - (ay + dy * u));
        if (d > tol + espessura(l) * 0.5 * (1 / view.scale)) continue;
        if (Math.hypot(wx - ax, wy - ay) < raio(l.source) + tol) continue;
        if (Math.hypot(wx - bx, wy - by) < raio(l.target) + tol) continue;
        if (d < melhorD) {
          melhorD = d;
          melhor = l;
        }
      }
      return melhor;
    }

    // ---- Ponteiros (mouse, toque e caneta) ----
    const ponteiros = new Map<number, { x: number; y: number }>();
    let pinca: { dist: number; scale: number; wx: number; wy: number } | null =
      null;
    const distancia = () => {
      const [a, b] = [...ponteiros.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const centro = () => {
      const [a, b] = [...ponteiros.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    function onDown(e: PointerEvent) {
      const p = posMouse(e);
      ponteiros.set(e.pointerId, p);
      if (ponteiros.size === 2) {
        const c = centro();
        const w = toWorld(c.x, c.y);
        pinca = { dist: distancia(), scale: view.scale, wx: w.x, wy: w.y };
        dragging = null;
        panning = false;
        autoFit = false;
        return;
      }
      if (ponteiros.size > 2) return;

      const w = toWorld(p.x, p.y);
      mouse.x = p.x;
      mouse.y = p.y;
      mouseW.x = w.x;
      mouseW.y = w.y;
      mouse.down = true;
      mouse.moved = false;
      dragging = noEm(w.x, w.y);
      arestaSob = dragging ? null : arestaEm(w.x, w.y);
      if (dragging) {
        acordar();
      } else {
        panning = true;
        autoFit = false;
        panStart.x = p.x;
        panStart.y = p.y;
        panStart.ox = view.ox;
        panStart.oy = view.oy;
      }
    }
    function onMove(e: PointerEvent) {
      const p = posMouse(e);
      if (ponteiros.has(e.pointerId)) ponteiros.set(e.pointerId, p);

      if (pinca && ponteiros.size === 2) {
        const ns = Math.max(
          0.03,
          Math.min(4, (pinca.scale * distancia()) / (pinca.dist || 1)),
        );
        const c = centro();
        view.scale = ns;
        view.ox = c.x - pinca.wx * ns;
        view.oy = c.y - pinca.wy * ns;
        return;
      }

      if (mouse.down) mouse.moved = true;
      mouse.x = p.x;
      mouse.y = p.y;
      if (panning) {
        view.ox = panStart.ox + (p.x - panStart.x);
        view.oy = panStart.oy + (p.y - panStart.y);
        canvas!.style.cursor = "grabbing";
        return;
      }
      const w = toWorld(p.x, p.y);
      mouseW.x = w.x;
      mouseW.y = w.y;
      hover = dragging || noEm(w.x, w.y);
      arestaHover =
        hover || mouse.down || panning || buscando ? null : arestaEm(w.x, w.y);
      const tip = tipRef.current;
      if (tip) {
        if (hover && !dragging) {
          tip.style.display = "block";
          tip.style.left = `${e.clientX + 12}px`;
          tip.style.top = `${e.clientY + 12}px`;
          tip.textContent = hover.titulo;
        } else if (arestaHover) {
          tip.style.display = "block";
          tip.style.left = `${e.clientX + 12}px`;
          tip.style.top = `${e.clientY + 12}px`;
          tip.textContent = tooltipRef.current(
            arestaHover.source,
            arestaHover.target,
            arestaHover.fontes ?? [],
          );
        } else {
          tip.style.display = "none";
        }
      }
      canvas!.style.cursor =
        hover || arestaHover ? "pointer" : mouse.down ? "grabbing" : "grab";
    }
    function onUp(e?: PointerEvent) {
      if (e) ponteiros.delete(e.pointerId);
      if (ponteiros.size < 2) pinca = null;
      if (ponteiros.size > 0) return;

      if (dragging && !mouse.moved) acionar(dragging);
      else if (arestaSob && !mouse.moved) acionarRelacao(arestaSob);
      arestaSob = null;
      dragging = null;
      panning = false;
      mouse.down = false;
      // No toque não há hover: solta o realce e o tooltip ao levantar o dedo.
      if (e && e.pointerType !== "mouse") {
        hover = null;
        arestaHover = null;
        const tip = tipRef.current;
        if (tip) tip.style.display = "none";
      }
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      autoFit = false;
      const p = posMouse(e);
      const w = toWorld(p.x, p.y);
      const ns = Math.max(
        0.03,
        Math.min(4, view.scale * Math.exp(-e.deltaY * 0.0015)),
      );
      view.scale = ns;
      view.ox = p.x - w.x * ns;
      view.oy = p.y - w.y * ns;
    }
    function onDbl(e: MouseEvent) {
      const p = posMouse(e);
      const w = toWorld(p.x, p.y);
      if (!noEm(w.x, w.y)) autoFit = true;
    }

    // ---- Seleção ----
    function vizinhosDe(n: GNode): RelacaoVizinha[] {
      const out: RelacaoVizinha[] = [];
      for (const l of arestasVisiveis) {
        const outro =
          l.source === n ? l.target : l.target === n ? l.source : null;
        if (!outro || !ehEntidade(outro.kind)) continue;
        out.push({
          id: outro.id,
          titulo: outro.titulo,
          rotulo: outro.rotulo ?? "",
          peso: l.fontes?.length ?? 1,
          manual: l.manual,
        });
      }
      return out.sort((a, b) => b.peso - a.peso);
    }

    function acionar(n: GNode) {
      const ids = new Set<string>([n.id]);
      for (const l of arestasVisiveis) {
        if (l.source.id === n.id) ids.add(l.target.id);
        else if (l.target.id === n.id) ids.add(l.source.id);
      }
      highlighted = ids;
      arestaSelecionada = null;

      if (temContexto(n.kind)) {
        onSelecaoRef.current?.({
          tipo: "entidade",
          id: n.id,
          titulo: n.titulo,
          rotulo: n.rotulo ?? "",
          kind: n.kind,
          notaPath: n.notaPath,
          relacoes: vizinhosDe(n),
          conteudos: n.conteudos ?? [],
        });
        return;
      }
      // Hubs de pasta/tag só destacam; `nota` avisa o consumidor.
      if (n.kind === "nota") onClicarNotaRef.current?.(n.id, n.titulo);
    }

    function acionarRelacao(l: Aresta) {
      highlighted = new Set([l.source.id, l.target.id]);
      arestaSelecionada = l;
      onSelecaoRef.current?.({
        tipo: "relacao",
        aId: l.source.id,
        aTitulo: l.source.titulo,
        bId: l.target.id,
        bTitulo: l.target.titulo,
        fontes: l.fontes ?? [],
      });
    }

    // ---- Comandos imperativos ----
    // Arestas manuais entram/saem por aqui, não por `graph`: trocar `graph`
    // remontaria o effect e re-semearia todos os nós.
    comandosRef.current = {
      selecionar(id) {
        const n = idx.get(id);
        if (!n || !visiveis.has(n)) return;
        acionar(n);
        acordar();
      },
      reselecionar(id) {
        const n = idx.get(id);
        if (n && visiveis.has(n)) acionar(n);
      },
      ligar(aId, bId) {
        const a = idx.get(aId);
        const b = idx.get(bId);
        if (!a || !b || a === b) return;
        const existe = links.some(
          (l) =>
            (l.source === a && l.target === b) ||
            (l.source === b && l.target === a),
        );
        if (existe) return;
        const nova: Aresta = {
          source: a,
          target: b,
          tipo: "relacao",
          fontes: [],
          manual: true,
        };
        links.push(nova);
        a.grau += 1;
        b.grau += 1;
        if (visiveis.has(a) && visiveis.has(b)) arestasVisiveis.push(nova);
        acordar();
      },
      desligar(aId, bId) {
        const casa = (l: Aresta) =>
          l.manual &&
          ((l.source.id === aId && l.target.id === bId) ||
            (l.source.id === bId && l.target.id === aId));
        for (const lista of [links, arestasVisiveis]) {
          for (let i = lista.length - 1; i >= 0; i--) {
            if (casa(lista[i])) lista.splice(i, 1);
          }
        }
        const a = idx.get(aId);
        const b = idx.get(bId);
        if (a) a.grau = Math.max(0, a.grau - 1);
        if (b) b.grau = Math.max(0, b.grau - 1);
        if (arestaSelecionada && casa(arestaSelecionada))
          arestaSelecionada = null;
        acordar();
      },
      limparSelecao() {
        highlighted = new Set();
        arestaSelecionada = null;
      },
      enquadrar() {
        autoFit = true;
      },
    };

    seed();
    resize();
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDbl);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      comandosRef.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDbl);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (tipRef.current) tipRef.current.style.display = "none";
    };
  }, [graph, dark]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: fundo ?? (dark ? "#0b1220" : "#f8fafc"),
        ...style,
      }}
    >
      {/* `touchAction: none`: sem isso o navegador consome o gesto (rolagem/
          zoom da página) e o pan/pinça do grafo nunca recebe os eventos. */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          touchAction: "none",
        }}
      />
      {children}
      <div
        ref={tipRef}
        style={{
          ...ESTILO_TOOLTIP,
          background: dark ? "#f1f5f9" : "#111827",
          color: dark ? "#0f172a" : "#ffffff",
        }}
      />
    </div>
  );
});

export default Grafo;
