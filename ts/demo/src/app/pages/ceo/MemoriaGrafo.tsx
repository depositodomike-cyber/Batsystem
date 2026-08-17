// Import Dependencies
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import clsx from "clsx";
import { ArrowPathIcon, FolderIcon } from "@heroicons/react/24/outline";

// Local Imports
import { Page } from "@/components/shared/Page";
import { Button, Spinner } from "@/components/ui";
import { SugerirPosUploadModal } from "./SugerirPosUpload";
import { NotaMemoriaModal } from "./NotaMemoriaModal";
import { RepositorioViewSelect } from "./RepositorioViewSelect";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useRepositorioAtivo } from "@/app/pages/prototypes/contas/model/context";
import { syncVault, getVaultStatus } from "@/services/api/vault";
import { buscandoMemoria, onBuscaMemoria } from "@/utils/memoriaBusca";
import {
  escolherPastaContexto,
  lerArquivosMd,
  notasParaVault,
  parseNotaMd,
  pastaContextoSalva,
  pastaEhCopia,
  permissaoDeLeitura,
  tituloPadrao,
  type ArquivoMd,
  type FSDirHandle,
} from "./memoria-inventario";

// ----------------------------------------------------------------------
// Memória — grafo force-directed migrado do beculture/Confi (graph.js + a
// função grafo() de lib/vault.js). O grafo é construído a partir da pasta que
// o usuário seleciona: lê os arquivos .md, extrai [[wikilinks]], tags e pastas
// e monta nós/arestas com a MESMA lógica do beculture. Roda 100% no navegador
// (File System Access API), sem backend.
//
// A leitura da pasta (handle, permissão, varredura dos .md, frontmatter) vem de
// memoria-inventario.ts — o mesmo módulo que alimenta a Lista do Repositório, para
// as duas telas mostrarem sempre o mesmo conjunto de notas.
// ----------------------------------------------------------------------

type Kind = "nota" | "pasta" | "tag";
type LinkTipo = "wikilink" | "tag" | "pasta";

interface GNode {
  id: string;
  kind: Kind;
  pasta: string | null;
  tipo?: string;
  titulo: string;
  grau: number;
  _peso?: number;
  _fase?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}
interface GLink {
  source: string;
  target: string;
  tipo: LinkTipo;
}
interface Graph {
  nodes: GNode[];
  links: GLink[];
}

// ---- Cores (paleta de marca beculture) ----
const PASTA_COR: Record<string, string> = {
  Reuniões: "#FFCA28",
  Insights: "#C084FC",
  Documentos: "#10B981",
  Notas: "#94A3B8",
  Pessoas: "#F472B6",
  Áudios: "#38BDF8",
  Estratégico: "#FB923C",
};
const PALETA = ["#A3E635", "#FACC15", "#818CF8", "#2DD4BF", "#FB7185", "#C4B5FD", "#FDBA74", "#F87171", "#5EEAD4", "#D8B4FE"];
const COR_TAG = "#22D3EE";

// Mapa pasta→cor único (mesma lógica de montarCoresPastas do beculture).
function montarCores(pastas: string[]): Map<string, string> {
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

function raio(n: GNode): number {
  if (n.kind === "pasta") return 10 + Math.min(n.grau, 20) * 0.7;
  if (n.kind === "tag") return 7 + Math.min(n.grau, 16) * 0.6;
  return 6 + Math.min(n.grau, 8) * 1.6;
}

// ----------------------------------------------------------------------
// Construção do grafo (espelha grafo() de lib/vault.js).
// ----------------------------------------------------------------------

function buildGraph(files: ArquivoMd[]): Graph {
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

  const nodes: GNode[] = notas.map((n) => ({ id: n.id, kind: "nota", pasta: n.pasta, tipo: "nota", titulo: n.titulo, grau: 0 }));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const notaNodes = [...nodes];

  const links: GLink[] = [];
  const vistos = new Set<string>();
  const ligar = (a: string | undefined, b: string | undefined, tipo: LinkTipo) => {
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

  const garantirHub = (id: string, kind: Kind, titulo: string, pasta: string | null = null) => {
    if (!nodeById.has(id)) {
      const hub: GNode = { id, kind, titulo, tipo: kind, pasta, grau: 0 };
      nodes.push(hub);
      nodeById.set(id, hub);
    }
    return id;
  };

  // 1) Wikilinks [[...]] — só conectam quando o alvo tem uma nota (.md) de fato.
  // Links não resolvidos ficam de fora do grafo de propósito, para não poluí-lo
  // com nós soltos de entidades sem nota própria.
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
    const limpas = [...new Set(n.tags.map((t) => String(t || "").trim()).filter(Boolean))];
    tagsPorNota.set(n.id, limpas);
    for (const t of limpas) tagCount.set(t.toLowerCase(), (tagCount.get(t.toLowerCase()) || 0) + 1);
  }
  for (const n of notaNodes) {
    for (const t of tagsPorNota.get(n.id) || []) {
      if ((tagCount.get(t.toLowerCase()) || 0) < 2) continue;
      ligar(n.id, garantirHub("tag::" + t.toLowerCase(), "tag", "#" + t), "tag");
    }
  }

  // 3) Pastas (hub só quando 2+ notas, pulando a Raiz)
  const pastaCount = new Map<string, number>();
  for (const n of notaNodes) {
    if (n.pasta && n.pasta !== "Raiz") pastaCount.set(n.pasta, (pastaCount.get(n.pasta) || 0) + 1);
  }
  for (const n of notaNodes) {
    if (!n.pasta || n.pasta === "Raiz" || (pastaCount.get(n.pasta) || 0) < 2) continue;
    ligar(n.id, garantirHub("pasta::" + n.pasta, "pasta", n.pasta, n.pasta), "pasta");
  }

  return { nodes, links };
}

// ----------------------------------------------------------------------

export default function MemoriaGrafo() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const { isDark } = useThemeContext();
  const repositorioId = useRepositorioAtivo()?.id ?? null;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  const [graph, setGraph] = useState<Graph>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(false);
  // Pergunta pós-upload: só dispara quando o usuário escolhe uma pasta (upload
  // de fato), nunca na restauração automática ao abrir a página.
  const [sugerirOpen, setSugerirOpen] = useState(false);
  const [sugerirTitulo, setSugerirTitulo] = useState("");
  // Nó clicado: abre o .md correspondente para leitura/edição. O id do nó é o
  // caminho relativo do arquivo dentro da pasta, então basta repassá-lo.
  const [nota, setNota] = useState<{ path: string; titulo: string } | null>(null);
  // Estado da sincronização dos .md com o backend (o que a IA consulta).
  const [sync, setSync] = useState<{
    state: "idle" | "syncing" | "done" | "error";
    done: number;
    total: number;
  }>({ state: "idle", done: 0, total: 0 });
  // Busca da barra de prompt em andamento (modo Memória) — anima o grafo.
  const [buscaIA, setBuscaIA] = useState(buscandoMemoria);
  useEffect(() => onBuscaMemoria(setBuscaIA), []);

  // Enquanto lê a pasta, sincroniza com a IA ou responde uma busca, o grafo
  // "pensa": respira, pulsa as arestas e faz os dados correrem pelas conexões.
  // Vai por ref porque a simulação (canvas) não pode remontar a cada mudança.
  const animandoRef = useRef(false);
  animandoRef.current = loading || sync.state === "syncing" || buscaIA;

  // Envia os .md ao backend para que o /ai/prompt possa consultá-los. Roda em
  // segundo plano após montar o grafo — não bloqueia a visualização.
  const syncToBackend = useCallback(async (files: ArquivoMd[]) => {
    setSync({ state: "syncing", done: 0, total: files.length });
    try {
      const r = await syncVault(notasParaVault(files), (done, total) =>
        setSync({ state: "syncing", done, total }),
      );
      setSync({ state: "done", done: r.total, total: r.total });
      toast.success("Repositório sincronizado", {
        description: `${r.total} notas disponíveis para a IA.`,
      });
    } catch {
      setSync({ state: "error", done: 0, total: 0 });
      toast.error("Falha ao sincronizar o Repositório com a IA.", {
        description: "O grafo foi montado, mas as notas não chegaram ao servidor.",
      });
    }
  }, []);

  const loadFromHandle = useCallback(
    async (handle: FSDirHandle, opts?: { fromUpload?: boolean }) => {
      setLoading(true);
      try {
        const files = await lerArquivosMd(handle);
        const g = buildGraph(files);
        setGraph(g);
        const notas = g.nodes.filter((n) => n.kind === "nota").length;
        if (files.length === 0) {
          toast("Nenhuma nota .md encontrada", { description: `A pasta “${handle.name}” não tem arquivos .md.` });
        } else {
          toast("Repositório carregado", { description: `${notas} notas · ${g.links.length} conexões` });
          void syncToBackend(files);
          // Só pergunta quando o carregamento veio de um upload do usuário.
          if (opts?.fromUpload) {
            setSugerirTitulo(handle.name);
            setSugerirOpen(true);
          }
        }
      } catch {
        toast("Falha ao ler a pasta", { description: "Não foi possível ler os arquivos da pasta." });
      } finally {
        setLoading(false);
      }
    },
    [syncToBackend],
  );

  const pickFolder = useCallback(async () => {
    const escolha = await escolherPastaContexto();
    if (!escolha.ok) {
      // Cancelar a seleção não merece aviso; navegador sem suporte, sim.
      if (escolha.reason === "unsupported") {
        toast("Navegador sem suporte", {
          description: "Este navegador não permite selecionar pastas.",
        });
      }
      return;
    }
    await loadFromHandle(escolha.dir, { fromUpload: true });
  }, [loadFromHandle]);

  // Sincronização manual (botão "Sincronizar"): relê a pasta já escolhida e
  // reenvia as notas ao backend. Se não houver pasta guardada — ou a permissão
  // tiver sido revogada — cai no seletor de pasta. `requestPermission` só pode
  // ser chamado a partir de um gesto do usuário, e o clique no botão é um.
  const sincronizar = useCallback(async () => {
    const handle = await pastaContextoSalva();
    // Uma cópia é um retrato do momento da seleção: sincronizar precisa dos
    // arquivos de agora, e sem handle a única forma de relê-los é o seletor.
    if (
      !handle ||
      pastaEhCopia(handle) ||
      !(await permissaoDeLeitura(handle, { pedir: true }))
    ) {
      await pickFolder();
      return;
    }
    await loadFromHandle(handle);
  }, [loadFromHandle, pickFolder]);

  // Ao abrir, mostra quantas notas já estão no servidor (sync anterior), para
  // o usuário saber que a IA já tem contexto mesmo sem re-selecionar a pasta.
  useEffect(() => {
    let alive = true;
    getVaultStatus()
      .then((s) => {
        if (!alive || s.total <= 0) return;
        setSync((prev) =>
          prev.state === "idle"
            ? { state: "done", done: s.total, total: s.total }
            : prev,
        );
      })
      .catch(() => {
        /* sem sessão ou API fora — silencioso */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Restaura a pasta do repositório ativo. Ao trocar de repo, limpa o grafo.
  useEffect(() => {
    let cancelado = false;

    (async () => {
      const handle = await pastaContextoSalva(repositorioId);
      if (cancelado) return;
      if (handle && (await permissaoDeLeitura(handle))) {
        await loadFromHandle(handle);
        return;
      }
      setGraph({ nodes: [], links: [] });
      setNota(null);
      setSync({ state: "idle", done: 0, total: 0 });
    })();

    return () => {
      cancelado = true;
    };
  }, [loadFromHandle, repositorioId]);

  // ---- Simulação (canvas) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (graph.nodes.length === 0) {
      // Sem dados: limpa o canvas (o overlay de instrução aparece por cima).
      const dprc = window.devicePixelRatio || 1;
      canvas.width = wrap.clientWidth * dprc;
      canvas.height = wrap.clientHeight * dprc;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Paleta dependente do tema (o grafo respeita o fundo light/dark).
    const LABEL = isDark ? "rgba(226,232,240,.7)" : "rgba(51,65,85,.85)";
    const LABEL_HL = isDark ? "#FFFFFF" : "#0f172a";
    const PASTA_FILL = isDark ? "rgba(15,23,42,.85)" : "rgba(248,250,252,.92)";
    const corLink = (tipo: LinkTipo, a: number): string => {
      if (tipo === "wikilink") return `rgba(255,202,40,${a})`;
      if (tipo === "tag") return `rgba(34,211,238,${a})`;
      return isDark ? `rgba(148,163,184,${a})` : `rgba(100,116,139,${a})`;
    };

    // Cor por pasta (única) a partir das pastas presentes.
    const pastasPresentes = [...new Set(graph.nodes.filter((n) => n.kind === "nota").map((n) => n.pasta).filter((p): p is string => !!p && p !== "Raiz"))];
    const corPasta = montarCores(pastasPresentes);
    const nodeColor = (n: GNode): string => {
      if (n.kind === "tag") return COR_TAG;
      if (n.pasta && n.pasta !== "Raiz") return corPasta.get(n.pasta) || PASTA_COR[n.pasta] || "#94A3B8";
      return "#94A3B8";
    };

    let W = 0;
    let H = 0;
    let dpr = 1;
    let raf = 0;
    let t = 0;
    // Sincronizando / buscando: espelha animandoRef a cada quadro (o loop lê o
    // ref uma vez e física e desenho consultam esta cópia).
    let buscando = false;

    const nodes: GNode[] = graph.nodes.map((n, i) => ({
      ...n,
      _peso: n.kind === "pasta" ? 2.2 : n.kind === "tag" ? 1.7 : 1,
      _fase: (i * 0.618) % 6.283,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    }));
    const idx = new Map(nodes.map((n) => [n.id, n]));
    const links = graph.links
      .map((l) => ({ source: idx.get(l.source)!, target: idx.get(l.target)!, tipo: l.tipo }))
      .filter((l) => l.source && l.target);

    let dragging: GNode | null = null;
    let hover: GNode | null = null;
    let highlighted = new Set<string>();
    const mouse = { x: 0, y: 0, down: false, moved: false };
    // Coordenadas do mouse em espaço-mundo (após a câmera). O arrasto de nó
    // precisa disso; sem converter, o nó "pula" quando há zoom/pan.
    const mouseW = { x: 0, y: 0 };

    // ---- Câmera (zoom/pan) ----
    // O grafo vive em espaço-mundo ilimitado; a câmera projeta esse mundo na
    // tela. Em vez de prender os nós nas bordas (o que os enfileirava numa
    // reta), deixamos o grafo crescer à vontade e ajustamos zoom/offset para
    // que ele caiba sempre inteiro na viewport.
    const view = { scale: 1, ox: 0, oy: 0 };
    let autoFit = true; // desligado quando o usuário dá zoom/pan manualmente
    let panning = false;
    const panStart = { x: 0, y: 0, ox: 0, oy: 0 };

    // Enquadramento alvo: bounding box de todos os nós → escala/offset que o
    // centraliza na tela com uma margem. Nunca amplia demais grafos pequenos.
    function computeFit(): { scale: number; ox: number; oy: number } | null {
      if (!nodes.length || !W || !H) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of nodes) {
        const r = raio(n) + 24; // inclui glow + rótulo
        if (n.x! - r < minX) minX = n.x! - r;
        if (n.y! - r < minY) minY = n.y! - r;
        if (n.x! + r > maxX) maxX = n.x! + r;
        if (n.y! + r > maxY) maxY = n.y! + r;
      }
      const bw = Math.max(1, maxX - minX);
      const bh = Math.max(1, maxY - minY);
      let scale = Math.min(W / bw, H / bh) * 0.9; // 10% de folga
      scale = Math.max(0.03, Math.min(scale, 1.4));
      const cxw = (minX + maxX) / 2;
      const cyw = (minY + maxY) / 2;
      return { scale, ox: W / 2 - cxw * scale, oy: H / 2 - cyw * scale };
    }

    let quieto = 0;
    const MOV_MIN = 0.05;
    const FRAMES_PARADO = 45;
    const acordar = () => {
      quieto = 0;
    };

    function seed() {
      // `seed()` roda antes de `resize()` definir W/H, então usamos as dimensões
      // reais do container aqui. Sem isso, W=H=0 → todos os nós nascem em (0,0),
      // e como a repulsão usa a direção entre nós (dx/d), posições idênticas dão
      // direção nula: os nós nunca se separam e o grafo colapsa num ponto.
      const w = W || wrap!.clientWidth || 1000;
      const h = H || wrap!.clientHeight || 700;
      for (const n of nodes) {
        n.x = w / 2 + (Math.random() - 0.5) * Math.min(w, 900);
        n.y = h / 2 + (Math.random() - 0.5) * Math.min(h, 700);
      }
    }

    function step(): number {
      // Repulsão adaptativa: grafos grandes precisam espalhar mais.
      const C = 3600 + nodes.length * 12;
      const K = 0.013;
      const G = 0.009;
      const DAMP = 0.9;
      const VMAX = 14;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
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
      for (const l of links) {
        const dx = l.target.x! - l.source.x!;
        const dy = l.target.y! - l.source.y!;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const rest = l.tipo === "pasta" ? 58 : l.tipo === "tag" ? 66 : 110;
        const f = (d - rest) * K;
        l.source.vx! += (dx / d) * f;
        l.source.vy! += (dy / d) * f;
        l.target.vx! -= (dx / d) * f;
        l.target.vy! -= (dy / d) * f;
      }
      const cx = W / 2;
      const cy = H / 2;
      let maxMov = 0;
      for (const n of nodes) {
        n.vx! += (cx - n.x!) * G;
        n.vy! += (cy - n.y!) * G;
        // Agitação durante a busca/sync: o grafo nunca assenta enquanto pensa.
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
        // Sem clamp nas bordas: o grafo cresce livre e a câmera reenquadra.
        n.x! += n.vx!;
        n.y! += n.vy!;
        maxMov = Math.max(maxMov, Math.abs(n.x! - x0), Math.abs(n.y! - y0));
      }
      return maxMov;
    }

    function preaquecer() {
      if (!nodes.length || !W || !H) return;
      // Pensando (ou arrastando): a física fica ao vivo — assentar em rajada
      // com a agitação ligada nunca converge e só queimaria os 3000 passos.
      if (buscando || dragging) {
        acordar();
        return;
      }
      let parados = 0;
      for (let i = 0; i < 3000; i++) {
        const mov = step();
        if (mov < MOV_MIN) {
          if (++parados >= 10) break;
        } else parados = 0;
      }
      quieto = FRAMES_PARADO;
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const poucos = nodes.length <= 40;
      // `inv` mantém traços/rótulos com espessura constante na tela,
      // independentemente do zoom (senão somem quando o grafo se afasta).
      const inv = 1 / view.scale;

      ctx.save();
      // Enquanto pensa, o grafo inteiro "respira": expande e volta (~±12%) em
      // torno do centro da viewport, por cima da câmera.
      if (buscando) {
        const esc = 1 + Math.sin(t * 1.6) * 0.12;
        ctx.translate(W / 2, H / 2);
        ctx.scale(esc, esc);
        ctx.translate(-W / 2, -H / 2);
      }
      ctx.translate(view.ox, view.oy);
      ctx.scale(view.scale, view.scale);

      // Pulso de brilho no conjunto das arestas (só enquanto pensa).
      const brilho = buscando ? 0.14 + (Math.sin(t * 3) + 1) * 0.13 : 0;
      for (const l of links) {
        const ativo = highlighted.has(l.source.id) || highlighted.has(l.target.id) || l.source === hover || l.target === hover;
        const dim = l.tipo === "wikilink" ? 0.18 : 0.12;
        // No fundo claro as arestas somem: reforça a opacidade quando inativas.
        const base = ativo ? 0.6 : isDark ? dim : dim * 1.7;
        ctx.strokeStyle = corLink(l.tipo, Math.min(base + brilho, 0.85));
        ctx.lineWidth = (ativo ? 1.6 : 1) * inv;
        ctx.setLineDash(l.tipo === "pasta" ? [2 * inv, 4 * inv] : l.tipo === "tag" ? [5 * inv, 4 * inv] : []);
        ctx.beginPath();
        ctx.moveTo(l.source.x!, l.source.y!);
        ctx.lineTo(l.target.x!, l.target.y!);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Pulsos de "dados" percorrendo as conexões enquanto o grafo pensa.
      if (buscando) {
        ctx.shadowColor = "#FFCA28";
        ctx.shadowBlur = 10 * view.scale;
        ctx.fillStyle = "rgba(255,213,79,.95)";
        for (let k = 0; k < links.length; k++) {
          const l = links[k];
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

      for (const n of nodes) {
        const cor = nodeColor(n);
        const r = raio(n);
        const destaque = highlighted.has(n.id) || n === hover;
        ctx.shadowColor = cor;
        let blur = destaque ? 22 : highlighted.size ? 4 : 12;
        // Respiração dos nós: forte (e defasada) durante a busca, discreta fora.
        blur += buscando
          ? 9 + Math.sin(t * 4 + (n._fase || 0)) * 7
          : Math.sin(t * 1.4 + (n._fase || 0)) * 2.2;
        ctx.shadowBlur = Math.max(0, blur) * view.scale;
        ctx.globalAlpha = highlighted.size && !destaque ? 0.35 : 1;
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, r, 0, Math.PI * 2);
        if (n.kind === "pasta") {
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

        const hub = n.kind !== "nota";
        if (hub || poucos || destaque) {
          ctx.fillStyle = destaque ? LABEL_HL : hub ? cor : LABEL;
          ctx.font = (hub ? "600 " : "") + `${11 * inv}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText((n.titulo || "").slice(0, 26), n.x!, n.y! + r + 13 * inv);
        }
      }

      ctx.restore();
    }

    function loop() {
      t += 0.016;
      // Entrar (ou sair) do modo "pensando" acorda a física, que pode estar
      // dormindo com o grafo assentado.
      const anim = animandoRef.current;
      if (anim !== buscando) {
        buscando = anim;
        acordar();
      }
      const dormindo = quieto >= FRAMES_PARADO && !dragging && !buscando;
      if (!dormindo) {
        const mov = step();
        if (mov < MOV_MIN && !dragging && !buscando) quieto++;
        else quieto = 0;
      }
      // Câmera segue o grafo suavemente: reenquadra à medida que ele cresce.
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
      // Enquadra imediatamente (sem animar do scale=1) na 1ª medição.
      if (autoFit) {
        const f = computeFit();
        if (f) Object.assign(view, f);
      }
    }

    function posMouse(e: MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    // Tela → mundo (desfaz a transformação da câmera).
    function toWorld(sx: number, sy: number) {
      return { x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale };
    }
    function noEm(wx: number, wy: number): GNode | null {
      const tol = 6 / view.scale; // tolerância constante na tela
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = n.x! - wx;
        const dy = n.y! - wy;
        if (dx * dx + dy * dy <= (raio(n) + tol) ** 2) return n;
      }
      return null;
    }
    function onDown(e: MouseEvent) {
      const p = posMouse(e);
      const w = toWorld(p.x, p.y);
      mouse.x = p.x;
      mouse.y = p.y;
      mouseW.x = w.x;
      mouseW.y = w.y;
      mouse.down = true;
      mouse.moved = false;
      dragging = noEm(w.x, w.y);
      if (dragging) {
        acordar();
      } else {
        // Fundo vazio: inicia pan e assume controle manual da câmera.
        panning = true;
        autoFit = false;
        panStart.x = p.x;
        panStart.y = p.y;
        panStart.ox = view.ox;
        panStart.oy = view.oy;
      }
    }
    function onMove(e: MouseEvent) {
      const p = posMouse(e);
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
      const tip = tipRef.current;
      if (tip) {
        if (hover && !dragging) {
          tip.style.display = "block";
          tip.style.left = `${e.clientX + 12}px`;
          tip.style.top = `${e.clientY + 12}px`;
          tip.textContent = hover.titulo;
        } else {
          tip.style.display = "none";
        }
      }
      canvas!.style.cursor = hover ? "pointer" : mouse.down ? "grabbing" : "grab";
    }
    function onUp() {
      if (dragging && !mouse.moved) acionar(dragging);
      dragging = null;
      panning = false;
      mouse.down = false;
    }
    // Zoom com a roda, ancorado no cursor (mundo sob o cursor fica fixo).
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      autoFit = false;
      const p = posMouse(e);
      const w = toWorld(p.x, p.y);
      const ns = Math.max(0.03, Math.min(4, view.scale * Math.exp(-e.deltaY * 0.0015)));
      view.scale = ns;
      view.ox = p.x - w.x * ns;
      view.oy = p.y - w.y * ns;
    }
    // Duplo clique no vazio volta ao enquadramento automático.
    function onDbl(e: MouseEvent) {
      const p = posMouse(e);
      const w = toWorld(p.x, p.y);
      if (!noEm(w.x, w.y)) autoFit = true;
    }
    function acionar(n: GNode) {
      const ids = new Set<string>([n.id]);
      for (const l of links) {
        if (l.source.id === n.id) ids.add(l.target.id);
        else if (l.target.id === n.id) ids.add(l.source.id);
      }
      if (n.kind !== "nota" && highlighted.has(n.id) && highlighted.size) {
        highlighted = new Set();
        return;
      }
      highlighted = ids;
      // Nota: além de destacar as conexões, abre o .md para ler/editar.
      // Hubs (pasta/tag) não têm arquivo — só destacam.
      if (n.kind === "nota") setNota({ path: n.id, titulo: n.titulo });
    }

    seed();
    resize();
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => resize());
    ro.observe(wrap);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDbl);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDbl);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [graph, isDark]);

  return (
    <Page title={`Repositório · ${product.name}`}>
      {/* Grafo solto na página, em tela cheia (abaixo do header de 65px) */}
      <div
        ref={wrapRef}
        className="relative h-[calc(100vh-65px)] w-full overflow-hidden bg-slate-50 dark:bg-[#0b1220]"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* Canto superior direito: botão de sincronizar + status com a IA. */}
        <div className="absolute end-4 top-4 z-10 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <RepositorioViewSelect compact />
            <Button
              onClick={sincronizar}
              color="primary"
              className="h-8 gap-1.5 px-3 text-xs"
              disabled={loading || sync.state === "syncing"}
            >
              {loading || sync.state === "syncing" ? (
                <Spinner className="size-4" />
              ) : (
                <ArrowPathIcon className="size-4" />
              )}
              Sincronizar
            </Button>
          </div>

          {sync.state !== "idle" && (
            <span
              className={clsx(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-tiny shadow-sm",
                sync.state === "error"
                  ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                  : "bg-white text-gray-600 dark:bg-dark-700 dark:text-dark-200",
              )}
            >
              {sync.state === "syncing" && (
                <>
                  <Spinner className="size-3" />
                  Sincronizando com a IA… {sync.done}/{sync.total}
                </>
              )}
              {sync.state === "done" && (
                <>
                  <span className="size-2 rounded-full bg-emerald-500" />
                  {sync.total} notas na IA
                </>
              )}
              {sync.state === "error" && <>Falha ao sincronizar com a IA</>}
            </span>
          )}
        </div>

        {/* Dica: o clique no nó abre o arquivo .md. */}
        {!loading && graph.nodes.length > 0 && (
          <span className="dark:bg-dark-700/70 dark:text-dark-300 pointer-events-none absolute bottom-4 start-4 z-10 rounded-md bg-white/70 px-2 py-1 text-tiny text-gray-500 backdrop-blur-sm">
            Clique em uma nota para abrir e editar o .md
          </span>
        )}

        {/* Estados: carregando / vazio */}
        {loading && (
            <div className="absolute inset-0 z-[5] grid place-items-center bg-slate-50/60 dark:bg-[#0b1220]/60">
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-slate-200">
                <Spinner className="size-5" />
                Lendo a pasta…
              </div>
            </div>
          )}
          {!loading && graph.nodes.length === 0 && (
            <div className="absolute inset-0 z-[5] grid place-items-center px-6 text-center">
              <div className="flex max-w-sm flex-col items-center gap-4">
                <span className="grid size-14 place-items-center rounded-2xl bg-gray-900/5 text-gray-500 dark:bg-white/5 dark:text-slate-300">
                  <FolderIcon className="size-7 stroke-[1.5]" />
                </span>
                <p className="text-sm text-gray-500 dark:text-slate-300">
                  Escolha a pasta onde ficam as notas <span className="font-mono">.md</span> do seu Repositório. O grafo é montado a partir dos <span className="font-mono">[[wikilinks]]</span>, tags e pastas.
                </p>
                <Button onClick={pickFolder} color="primary" className="gap-2">
                  <FolderIcon className="size-5" />
                  Selecionar pasta
                </Button>
              </div>
            </div>
          )}
      </div>

      {/* Tooltip flutuante do nó sob o cursor */}
      <div
        ref={tipRef}
        className="pointer-events-none fixed z-[60] hidden rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-dark-50 dark:text-dark-900"
      />

      {/* Nó clicado: abre o .md para ler e editar direto na pasta. */}
      <NotaMemoriaModal
        isOpen={!!nota}
        close={() => setNota(null)}
        path={nota?.path ?? null}
        titulo={nota?.titulo}
        onSalvo={(conteudo) => {
          if (!nota) return;
          // O título pode ter mudado no frontmatter — atualiza o rótulo do nó
          // sem reler a pasta inteira. As conexões ([[wikilinks]], tags) só são
          // reconstruídas no próximo "Sincronizar".
          const base = tituloPadrao(nota.path.split("/").pop()!);
          const novo = parseNotaMd(conteudo).titulo || base;
          if (novo === nota.titulo) return;
          setNota({ ...nota, titulo: novo });
          setGraph((g) => ({
            ...g,
            nodes: g.nodes.map((n) => (n.id === nota.path ? { ...n, titulo: novo } : n)),
          }));
        }}
      />

      {/* Pergunta pós-upload: gerar atividades ou insights a partir do Repositório. */}
      <SugerirPosUploadModal
        isOpen={sugerirOpen}
        close={() => setSugerirOpen(false)}
        titulo={sugerirTitulo}
      />
    </Page>
  );
}
