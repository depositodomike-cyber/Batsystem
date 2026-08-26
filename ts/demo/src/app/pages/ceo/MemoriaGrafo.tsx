// Import Dependencies
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  syncVault,
  getVaultStatus,
  getVaultCategorias,
  classificarVaultCompleto,
  type CategoriasDoVault,
} from "@/services/api/vault";
import { buscandoMemoria, onBuscaMemoria } from "@/utils/memoriaBusca";
import { memoriaVaultSupported } from "@/utils/memoriaVault";
import { criarRelacao, removerRelacao } from "./grafo-relacoes";
import { avisarFalhaAoSalvarNaMemoria } from "./memoria-conteudo";
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
  type ItemContexto,
} from "./memoria-inventario";
import {
  COR_CATEGORIA,
  COR_PESSOA,
  COR_TAG,
  PASTA_COR,
  construirGrafoDoVault,
  ehEntidade,
  montarCores,
  temContexto,
  pesoDoKind,
  raio,
  repousoDoLink,
  unirCamadas,
  type GNode,
  type Graph,
  type Kind,
  type LinkTipo,
} from "./memoria-grafo-modelo";
import {
  GrafoPainelContexto,
  type RelacaoVizinha,
  type Selecao,
} from "./GrafoPainelContexto";

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
// O modelo (tipos, paleta e construção das camadas) vive em
// memoria-grafo-modelo.ts. Aqui fica só o desenho: física, câmera e eventos.
// ----------------------------------------------------------------------

/** Camadas visíveis no canvas. "Conteúdos" é o grafo de arquivos original. */
interface Filtros {
  categoria: boolean;
  pessoa: boolean;
  projeto: boolean;
  tag: boolean;
  conteudos: boolean;
}

const FILTROS_INICIAIS: Filtros = {
  categoria: true,
  pessoa: true,
  projeto: true,
  tag: true,
  conteudos: false,
};

/**
 * Chips do overlay, que também funcionam como legenda.
 *
 * Um chip só: tudo que não é conteúdo se apresenta como "Tag" (ver
 * ROTULO_ENTIDADE), então três botões chamados "Categorias", "Pessoas" e
 * "Projetos" contradiriam o que o resto da tela diz. As camadas seguem
 * separadas em `Filtros` — o chip liga e desliga as quatro juntas.
 *
 * Conteúdos continuam sem botão: essa camada só entra pelo fallback de vaults
 * sem termo recorrente.
 */
const CHIPS: {
  id: string;
  label: string;
  cor: string | null;
  camadas: (keyof Filtros)[];
}[] = [
  {
    id: "tags",
    label: "Tags",
    cor: COR_TAG,
    camadas: ["categoria", "pessoa", "projeto", "tag"],
  },
];

/**
 * Camada de cada kind — fonte única para a visibilidade E para a contagem dos
 * chips. `satisfies Record<Kind, …>` de propósito: a cadeia de `if` que existia
 * aqui terminava em `return f.conteudos`, e `conteudos` nasce DESLIGADO. Um kind
 * novo cairia nesse fallback e ficaria invisível sem erro nenhum.
 */
const CAMADA_POR_KIND = {
  categoria: "categoria",
  pessoa: "pessoa",
  projeto: "projeto",
  tag: "tag",
  nota: "conteudos",
  pasta: "conteudos",
  "tag-hub": "conteudos",
} satisfies Record<Kind, keyof Filtros>;

/** O nó está numa camada ligada? */
function visivelPor(kind: Kind, f: Filtros): boolean {
  return f[CAMADA_POR_KIND[kind]];
}

/**
 * Cor fixa por kind; `null` significa "a cor vem da pasta do nó".
 * Exaustivo pelo mesmo motivo: sem isto um kind novo cai no cinza de fallback e
 * fica indistinguível de uma nota sem pasta.
 */
const COR_POR_KIND = {
  tag: COR_TAG,
  "tag-hub": COR_TAG,
  pessoa: COR_PESSOA,
  categoria: COR_CATEGORIA,
  projeto: null,
  pasta: null,
  nota: null,
} satisfies Record<Kind, string | null>;

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
  const [nota, setNota] = useState<{ path: string; titulo: string } | null>(
    null,
  );
  /**
   * Tags de que a nota aberta faz parte — badges no NotaMemoriaModal.
   *
   * Sai dos nós de ENTIDADE do grafo (`conteudos` lista os .md que citam a tag)
   * e não do frontmatter do arquivo: na prática o frontmatter só traz o tipo
   * ("documento"), enquanto os assuntos são derivados do vault inteiro.
   */
  const tagsDaNota = useMemo(() => {
    if (!nota) return undefined;
    return graph.nodes
      .filter((n) => n.kind === "tag" && n.conteudos?.includes(nota.path))
      .map((n) => n.titulo);
  }, [graph.nodes, nota]);
  // Estado da sincronização dos .md com o backend (o que a IA consulta).
  const [sync, setSync] = useState<{
    state: "idle" | "syncing" | "done" | "error";
    done: number;
    total: number;
  }>({ state: "idle", done: 0, total: 0 });
  // Busca da barra de prompt em andamento (modo Memória) — anima o grafo.
  const [buscaIA, setBuscaIA] = useState(buscandoMemoria);
  useEffect(() => onBuscaMemoria(setBuscaIA), []);

  // Entidade ou relação selecionada no canvas. Dado plano copiado no clique —
  // nunca um GNode vivo, que a simulação muta a cada quadro.
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  // Inventário compartilhado com a Lista: dá título, tipo e origem de cada
  // conteúdo que o painel lista.
  const [itens, setItens] = useState<ItemContexto[]>([]);
  const itensPorPath = useMemo(
    () => new Map(itens.map((i) => [i.path, i])),
    [itens],
  );
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  /**
   * Categorias macro vindas do backend. O grafo é montado no navegador, mas a
   * classificação mora no servidor (custa uma chamada de IA por nota) — então
   * ela entra por aqui, como parâmetro, e os módulos do grafo seguem puros.
   */
  const [categorias, setCategorias] = useState<CategoriasDoVault>({
    categorias: [],
    porPath: {},
  });
  /** Últimos .md lidos, para remontar o grafo sem reler a pasta. */
  const arquivosRef = useRef<ArquivoMd[]>([]);
  /**
   * Categorias já refletidas no grafo desenhado. `loadFromHandle` marca as que
   * usou na montagem inicial, então o efeito abaixo só age quando a
   * classificação trouxe novidade — sem isso ele remontaria o grafo logo depois
   * do primeiro desenho, jogando os nós de volta ao seed à toa.
   */
  const categoriasAplicadasRef = useRef<CategoriasDoVault>(categorias);

  useEffect(() => {
    if (categorias === categoriasAplicadasRef.current) return;
    categoriasAplicadasRef.current = categorias;
    const files = arquivosRef.current;
    if (files.length === 0) return;
    // Remonta só o grafo: filtros e seleção ficam como o usuário deixou (a
    // seleção é dado plano por id, e os ids não mudam).
    const { entidades, conteudos, itens: inv } = construirGrafoDoVault(
      files,
      categorias,
    );
    setItens(inv);
    setGraph(unirCamadas(entidades, conteudos));
  }, [categorias]);
  // Pasta aberta como cópia: leitura funciona, gravação não.
  const [copiaSomenteLeitura, setCopiaSomenteLeitura] = useState(false);
  // Quantos nós cada camada tem. Alimenta a contagem nos chips e esconde os das
  // camadas vazias — um chip "Pessoas" num vault sem pessoa nenhuma só confunde.
  const camadas = useMemo(() => {
    const c: Record<keyof Filtros, number> = {
      categoria: 0,
      pessoa: 0,
      projeto: 0,
      tag: 0,
      conteudos: 0,
    };
    // Mesmo mapa da visibilidade: chip e filtro não podem divergir.
    for (const n of graph.nodes) c[CAMADA_POR_KIND[n.kind]] += 1;
    return c;
  }, [graph]);

  // Canal React → canvas. A simulação lê estes refs a cada quadro; passar por
  // deps do useEffect remontaria tudo e jogaria os nós de volta ao seed().
  const filtrosRef = useRef(filtros);
  filtrosRef.current = filtros;
  // Bump para o loop saber que o painel foi fechado por fora e limpar o realce.
  const limparRef = useRef(0);
  // Canal canvas → React, no mesmo padrão de animandoRef: reatribuído a cada
  // render, lido de dentro do effect na hora do clique.
  const onSelecaoRef = useRef<(s: Selecao | null) => void>(() => {});
  onSelecaoRef.current = setSelecao;
  // Canal painel → canvas: preenchido dentro do effect.
  const comandosRef = useRef<{
    selecionar: (id: string) => void;
    ligar: (aId: string, bId: string) => void;
    desligar: (aId: string, bId: string) => void;
    reselecionar: (id: string) => void;
  } | null>(null);

  // Tags que podem virar destino de um novo relacionamento — as que estão no
  // canvas. Uma relação declarada para uma tag ausente seria ignorada pelo
  // construtor, então não faz sentido oferecê-la.
  const tagsDisponiveis = useMemo(
    () =>
      graph.nodes
        .filter((n) => ehEntidade(n.kind))
        .map((n) => ({ id: n.id, titulo: n.titulo }))
        .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")),
    [graph],
  );

  // Gravar exige a File System Access API e uma pasta viva. No modo cópia
  // (Firefox/Safari/Brave sem a flag) o Repositório é somente leitura.
  const podeEscrever = memoriaVaultSupported() && !copiaSomenteLeitura;

  const relacionar = useCallback(
    async (alvo: { id: string; titulo: string }) => {
      if (!selecao || selecao.tipo !== "entidade") return;
      const r = await criarRelacao(selecao.titulo, alvo.titulo);
      if (!r.ok) {
        avisarFalhaAoSalvarNaMemoria(r.reason);
        return;
      }
      // Canvas e painel são atualizados sem tocar em `graph` — ver o comentário
      // em `comandosRef`.
      comandosRef.current?.ligar(selecao.id, alvo.id);
      comandosRef.current?.reselecionar(selecao.id);
      toast.success("Tags relacionadas", {
        description: `${selecao.titulo} × ${alvo.titulo}`,
      });
    },
    [selecao],
  );

  const desrelacionar = useCallback(
    async (alvo: { id: string; titulo: string }) => {
      if (!selecao || selecao.tipo !== "entidade") return;
      const r = await removerRelacao(selecao.titulo, alvo.titulo);
      if (!r.ok) {
        avisarFalhaAoSalvarNaMemoria(r.reason);
        return;
      }
      comandosRef.current?.desligar(selecao.id, alvo.id);
      comandosRef.current?.reselecionar(selecao.id);
      toast.success("Relação removida", {
        description: `${selecao.titulo} × ${alvo.titulo}`,
      });
    },
    [selecao],
  );

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

      // Segunda etapa: classificar em categorias macro. Fica DEPOIS do toast
      // porque a sincronização já está completa neste ponto — a classificação
      // é um extra que nunca pode fazer o Sincronizar parecer ter falhado.
      const c = await classificarVaultCompleto((feitas, total) =>
        setSync({ state: "syncing", done: feitas, total }),
      );
      setSync({ state: "done", done: r.total, total: r.total });
      if (c.classificadas > 0) {
        // Recarrega o grafo com as categorias novas.
        setCategorias(await getVaultCategorias());
        toast.success("Conteúdos classificados", {
          description: `${c.classificadas} ${c.classificadas === 1 ? "nota categorizada" : "notas categorizadas"} pela IA.`,
        });
      }
    } catch {
      setSync({ state: "error", done: 0, total: 0 });
      toast.error("Falha ao sincronizar o Repositório com a IA.", {
        description:
          "O grafo foi montado, mas as notas não chegaram ao servidor.",
      });
    }
  }, []);

  const loadFromHandle = useCallback(
    async (
      handle: FSDirHandle,
      // `obsoleto` deixa quem chamou abortar a escrita do resultado. Ler uma
      // pasta grande demora, e sem isso a troca de repositório no meio da
      // leitura faria o grafo do repositório anterior aparecer no novo.
      opts?: { fromUpload?: boolean; obsoleto?: () => boolean },
    ) => {
      setLoading(true);
      setCopiaSomenteLeitura(pastaEhCopia(handle));
      try {
        const files = await lerArquivosMd(handle);
        if (opts?.obsoleto?.()) return;
        // Guardado para remontar o grafo quando a classificação terminar, sem
        // reler a pasta inteira do disco.
        arquivosRef.current = files;
        // As categorias já classificadas entram junto do primeiro desenho; as
        // que a IA produzir agora chegam depois, pelo efeito de `categorias`.
        const cats = await getVaultCategorias();
        if (opts?.obsoleto?.()) return;
        setCategorias(cats);
        categoriasAplicadasRef.current = cats;
        const { entidades, conteudos, itens: inv, temEntidades } =
          construirGrafoDoVault(files, cats);
        setItens(inv);
        setSelecao(null);
        // Vault sem entidades reconhecíveis (sem grupos, sem pasta Pessoas, sem
        // termo recorrente): o canvas abre com a camada de conteúdos, que é o
        // grafo de arquivos de sempre. Melhor que uma tela vazia.
        const filtrosIniciais: Filtros = temEntidades
          ? FILTROS_INICIAIS
          : { ...FILTROS_INICIAIS, conteudos: true };
        setFiltros(filtrosIniciais);
        setGraph(unirCamadas(entidades, conteudos));
        if (files.length === 0) {
          toast("Nenhuma nota .md encontrada", {
            description: `A pasta “${handle.name}” não tem arquivos .md.`,
          });
        } else {
          toast("Repositório carregado", {
            description: temEntidades
              ? `${entidades.nodes.length} entidades · ${entidades.links.length} relações · ${inv.length} notas`
              : `${inv.length} notas · ${conteudos.links.length} conexões`,
          });
          void syncToBackend(files);
          // Só pergunta quando o carregamento veio de um upload do usuário.
          if (opts?.fromUpload) {
            setSugerirTitulo(handle.name);
            setSugerirOpen(true);
          }
        }
      } catch {
        toast("Falha ao ler a pasta", {
          description: "Não foi possível ler os arquivos da pasta.",
        });
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
  // Depende do repositório: o total é por repositório, e sem isso o badge
  // continuaria mostrando a contagem do repositório anterior.
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
  }, [repositorioId]);

  // Restaura a pasta do repositório ativo. Ao trocar de repo, limpa o grafo.
  useEffect(() => {
    let cancelado = false;

    // Estado do repositório anterior sai de cena ANTES da leitura da pasta: a
    // nota aberta e o contador de sincronização são daquele contexto, e deixá-los
    // na tela enquanto o novo carrega mostra dado de um repositório dentro de
    // outro.
    setSelecao(null);
    setNota(null);
    setSync({ state: "idle", done: 0, total: 0 });

    (async () => {
      const handle = await pastaContextoSalva(repositorioId);
      if (cancelado) return;
      if (handle && (await permissaoDeLeitura(handle))) {
        if (cancelado) return;
        await loadFromHandle(handle, { obsoleto: () => cancelado });
        return;
      }
      if (cancelado) return;
      setGraph({ nodes: [], links: [] });
      setItens([]);
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
      // `relacao` cai no cinza neutro das arestas de pasta — o peso da relação
      // aparece na espessura, não numa cor nova.
      return isDark ? `rgba(148,163,184,${a})` : `rgba(100,116,139,${a})`;
    };

    // Cor por pasta (única) a partir das pastas presentes.
    const pastasPresentes = [
      ...new Set(
        graph.nodes
          .filter((n) => n.kind === "nota" || n.kind === "projeto")
          .map((n) => n.pasta)
          .filter((p): p is string => !!p && p !== "Raiz"),
      ),
    ];
    const corPasta = montarCores(pastasPresentes);
    // Cada entidade herda a cor que o kind equivalente já tinha: projeto = a
    // cor da pasta, tag = o ciano de sempre, pessoa = o rosa fixo da pasta
    // "Pessoas". Nenhuma cor nova entra no grafo.
    const nodeColor = (n: GNode): string => {
      const fixa = COR_POR_KIND[n.kind];
      if (fixa) return fixa;
      if (n.pasta && n.pasta !== "Raiz")
        return corPasta.get(n.pasta) || PASTA_COR[n.pasta] || "#94A3B8";
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
      _peso: pesoDoKind(n.kind),
      _fase: (i * 0.618) % 6.283,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    }));
    const idx = new Map(nodes.map((n) => [n.id, n]));
    type Aresta = {
      source: GNode;
      target: GNode;
      tipo: LinkTipo;
      fontes?: string[];
      manual?: boolean;
    };
    const links: Aresta[] = graph.links
      .map((l) => ({
        source: idx.get(l.source)!,
        target: idx.get(l.target)!,
        tipo: l.tipo,
        fontes: l.fontes,
        manual: l.manual,
      }))
      .filter((l) => l.source && l.target);

    // ---- Camadas visíveis ----
    // Filtrar por FLAG, nunca mexendo no comprimento de `nodes`/`links`: recriar
    // os arrays reposicionaria tudo. Com flag, ligar/desligar uma camada
    // preserva o layout que o usuário já reconhece.
    const visiveis = new Set<GNode>();
    const nosVisiveis: GNode[] = [];
    const arestasVisiveis: Aresta[] = [];
    let filtrosAplicados: Filtros | null = null;
    function aplicarFiltros(f: Filtros) {
      visiveis.clear();
      nosVisiveis.length = 0;
      for (const n of nodes) {
        if (!visivelPor(n.kind, f)) continue;
        visiveis.add(n);
        nosVisiveis.push(n);
      }
      arestasVisiveis.length = 0;
      for (const l of links) {
        if (visiveis.has(l.source) && visiveis.has(l.target))
          arestasVisiveis.push(l);
      }
    }
    aplicarFiltros(filtrosRef.current);
    filtrosAplicados = filtrosRef.current;
    let limparVisto = limparRef.current;

    let dragging: GNode | null = null;
    let hover: GNode | null = null;
    let highlighted = new Set<string>();
    // Aresta sob o cursor, pressionada e selecionada. A relação é uma interação
    // de primeira classe: é por ela que se chega ao contexto sem que cada
    // documento precise virar um nó.
    let arestaHover: Aresta | null = null;
    let arestaSob: Aresta | null = null;
    let arestaSelecionada: Aresta | null = null;

    /** Espessura da linha pelo número de conteúdos que sustentam a relação. */
    const espessura = (l: Aresta) =>
      1 + Math.min(l.fontes?.length ?? 1, 8) * 0.25;
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
      if (!nosVisiveis.length || !W || !H) return null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of nosVisiveis) {
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
      // Semeia TODOS os nós, inclusive os de camadas desligadas: se um nó
      // entrasse depois com x=y=0, a repulsão (que usa a direção entre nós)
      // teria direção nula e a camada inteira colapsaria num ponto.
      for (const n of nodes) {
        n.x = w / 2 + (Math.random() - 0.5) * Math.min(w, 900);
        n.y = h / 2 + (Math.random() - 0.5) * Math.min(h, 700);
      }
    }

    function step(): number {
      // Repulsão adaptativa: grafos grandes precisam espalhar mais.
      const C = 3600 + nosVisiveis.length * 12;
      const K = 0.013;
      const G = 0.009;
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
        const rest = repousoDoLink(l.tipo);
        const f = (d - rest) * K;
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
      if (!nosVisiveis.length || !W || !H) return;
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
      const poucos = nosVisiveis.length <= 40;
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
      for (const l of arestasVisiveis) {
        const ativo =
          l === arestaSelecionada ||
          l === arestaHover ||
          highlighted.has(l.source.id) ||
          highlighted.has(l.target.id) ||
          l.source === hover ||
          l.target === hover;
        const dim = l.tipo === "wikilink" ? 0.18 : 0.12;
        // No fundo claro as arestas somem: reforça a opacidade quando inativas.
        const base = ativo ? 0.6 : isDark ? dim : dim * 1.7;
        ctx.strokeStyle = corLink(l.tipo, Math.min(base + brilho, 0.85));
        // Espessura constante, como sempre foi. O peso da relação existe (ver
        // `espessura`), mas fica fora do traço: aplicá-lo aqui engrossava todas
        // as linhas de 1,25× a 3× e mudava a cara do grafo. O peso segue valendo
        // para a tolerância de clique na aresta.
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

      // Pulsos de "dados" percorrendo as conexões enquanto o grafo pensa.
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
        // Respiração dos nós: forte (e defasada) durante a busca, discreta fora.
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

        // Entidades e hubs sempre rotulados: são o mapa que o usuário lê.
        const hub = n.kind !== "nota";
        if (hub || poucos || destaque) {
          ctx.fillStyle = destaque ? LABEL_HL : hub ? cor : LABEL;
          ctx.font =
            (hub ? "600 " : "") + `${11 * inv}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          // Reticências ao cortar: sem elas, dois nomes longos de mesmo prefixo
          // ficam com rótulos idênticos e não há como saber que foram cortados.
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
      // Entrar (ou sair) do modo "pensando" acorda a física, que pode estar
      // dormindo com o grafo assentado.
      const anim = animandoRef.current;
      if (anim !== buscando) {
        buscando = anim;
        acordar();
      }
      // Camadas ligadas/desligadas por fora. Só remarca as flags — os arrays de
      // nós continuam os mesmos, então o layout não se embaralha.
      if (filtrosRef.current !== filtrosAplicados) {
        filtrosAplicados = filtrosRef.current;
        aplicarFiltros(filtrosAplicados);
        if (arestaSelecionada && !arestasVisiveis.includes(arestaSelecionada))
          arestaSelecionada = null;
        arestaHover = null;
        autoFit = true;
        acordar();
      }
      // Painel fechado pelo X ou pelo Esc: solta o realce.
      if (limparRef.current !== limparVisto) {
        limparVisto = limparRef.current;
        highlighted = new Set();
        arestaSelecionada = null;
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
      for (let i = nosVisiveis.length - 1; i >= 0; i--) {
        const n = nosVisiveis[i];
        const dx = n.x! - wx;
        const dy = n.y! - wy;
        if (dx * dx + dy * dy <= (raio(n) + tol) ** 2) return n;
      }
      return null;
    }
    /**
     * Aresta sob o ponto, por distância ponto→segmento. Mesma tolerância de tela
     * do `noEm`. Perto das pontas quem ganha é o nó — senão a aresta roubaria o
     * clique de quem ela liga.
     */
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
        u = u < 0 ? 0 : u > 1 ? 1 : u; // clamp: é segmento, não reta infinita
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
    // Ponteiros ativos, por id — é o que permite distinguir um dedo (pan) de
    // dois (pinça). Pointer Events cobrem mouse, toque e caneta com o mesmo
    // código; antes só havia `mouse*`, então em celular e tablet não havia pan,
    // zoom nem seleção de nó.
    const ponteiros = new Map<number, { x: number; y: number }>();
    let pinca: {
      dist: number;
      scale: number;
      wx: number;
      wy: number;
    } | null = null;

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
      // Sem `setPointerCapture`: `pointermove`/`pointerup` já são escutados no
      // window, e capturar lança se o ponteiro não estiver mais ativo.

      // Segundo dedo: vira pinça e cancela arraste/pan em andamento.
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
      // Aresta sob o ponteiro: guardada para o onUp decidir clique vs. arrasto.
      // O pan continua exatamente como era — arrastar a partir de uma aresta
      // ainda move a câmera.
      arestaSob = dragging ? null : arestaEm(w.x, w.y);
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
    function onMove(e: PointerEvent) {
      const p = posMouse(e);
      if (ponteiros.has(e.pointerId)) ponteiros.set(e.pointerId, p);

      // Pinça: mantém fixo o ponto do mundo que está entre os dois dedos.
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
      // Testa aresta só quando não há nó sob o cursor e nada está em curso —
      // mantém o custo por pointermove baixo.
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
          const n = arestaHover.fontes?.length ?? 0;
          tip.style.display = "block";
          tip.style.left = `${e.clientX + 12}px`;
          tip.style.top = `${e.clientY + 12}px`;
          tip.textContent =
            `${arestaHover.source.titulo} × ${arestaHover.target.titulo}` +
            (n ? ` · ${n} ${n === 1 ? "conteúdo" : "conteúdos"}` : "");
        } else {
          tip.style.display = "none";
        }
      }
      canvas!.style.cursor =
        hover || arestaHover ? "pointer" : mouse.down ? "grabbing" : "grab";
    }
    function onUp(e?: PointerEvent) {
      if (e) ponteiros.delete(e.pointerId);
      // Saindo da pinça: só encerra quando sobra menos de dois dedos.
      if (ponteiros.size < 2) pinca = null;
      if (ponteiros.size > 0) return;

      if (dragging && !mouse.moved) acionar(dragging);
      else if (arestaSob && !mouse.moved) acionarRelacao(arestaSob);
      arestaSob = null;
      dragging = null;
      panning = false;
      mouse.down = false;
      // No toque não existe hover: sem isso o nó ficaria destacado e o tooltip
      // preso na tela depois de soltar o dedo.
      if (e && e.pointerType !== "mouse") {
        hover = null;
        arestaHover = null;
        const tip = tipRef.current;
        if (tip) tip.style.display = "none";
      }
    }
    // Zoom com a roda, ancorado no cursor (mundo sob o cursor fica fixo).
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
    // Duplo clique no vazio volta ao enquadramento automático.
    function onDbl(e: MouseEvent) {
      const p = posMouse(e);
      const w = toWorld(p.x, p.y);
      if (!noEm(w.x, w.y)) autoFit = true;
    }
    /** Vizinhos visíveis de uma entidade, do mais sustentado para o menos. */
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

      // `temContexto` e não `ehEntidade`: a categoria também abre o painel,
      // mesmo não sendo entidade para os demais efeitos do grafo.
      if (temContexto(n.kind)) {
        // Entidade: revela o contexto no painel. Abrir o .md (quando existe,
        // caso das pessoas) vira ação explícita lá dentro — se o editor
        // abrisse já no clique, o contexto nunca chegaria a aparecer.
        onSelecaoRef.current({
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

      // Camada de conteúdos: comportamento de sempre — o clique abre o .md.
      // Hubs de pasta/tag não têm arquivo, então só destacam.
      onSelecaoRef.current(null);
      if (n.kind === "nota") setNota({ path: n.id, titulo: n.titulo });
    }

    /** Clique numa relação: o contexto entre duas entidades vira a seleção. */
    function acionarRelacao(l: Aresta) {
      highlighted = new Set([l.source.id, l.target.id]);
      arestaSelecionada = l;
      onSelecaoRef.current({
        tipo: "relacao",
        aId: l.source.id,
        aTitulo: l.source.titulo,
        bId: l.target.id,
        bTitulo: l.target.titulo,
        fontes: l.fontes ?? [],
      });
    }

    // Canal painel → canvas: navegar para um vizinho sem sair do grafo.
    // Canal painel → canvas.
    //
    // As arestas manuais entram e saem POR AQUI, não por `setGraph`: tocar no
    // estado `graph` remontaria este effect e jogaria todos os nós de volta ao
    // `seed()`, fazendo o grafo saltar a cada relação criada. A fonte de verdade
    // é o .md — no próximo Sincronizar a relação vem do vault já pronta.
    comandosRef.current = {
      selecionar(id: string) {
        const n = idx.get(id);
        if (!n || !visiveis.has(n)) return;
        acionar(n);
        acordar();
      },
      reselecionar(id: string) {
        const n = idx.get(id);
        if (n && visiveis.has(n)) acionar(n);
      },
      ligar(aId: string, bId: string) {
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
      desligar(aId: string, bId: string) {
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
    // `pointercancel` dispara quando o sistema toma o gesto (ex.: gesto de
    // sistema no iOS). Sem isso o pan ficaria travado ligado.
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
    };
  }, [graph, isDark]);

  return (
    <Page title={`Repositório · ${product.name}`}>
      {/* Grafo solto na página, em tela cheia (abaixo do header de 65px) */}
      <div
        ref={wrapRef}
        className="relative h-[calc(100dvh-var(--header-h))] w-full overflow-hidden bg-slate-50 dark:bg-[#0b1220]"
      >
        {/* `touch-none`: sem isso o navegador consome o gesto para rolar/dar
            zoom na página e o pan/pinça do grafo nunca recebe os eventos. */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
        />

        {/* Canto superior direito: botão de sincronizar + status com a IA. */}
        {/* `max-w` + `end-2` no celular: com 224px fixos o overlay cobria boa
            parte do grafo numa tela de 375px. */}
        <div className="absolute end-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-col items-end gap-1.5 sm:end-4 sm:top-4 sm:max-w-none">
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

          {/* Camadas do grafo. A bolinha usa a mesma cor do nó, então a linha
              também funciona como legenda. */}
          {graph.nodes.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-1">
              {CHIPS.map((chip) => {
                const total = chip.camadas.reduce((s, k) => s + camadas[k], 0);
                return { chip, total };
              })
                .filter(({ total }) => total > 0)
                .map(({ chip, total }) => {
                const { id, label, cor, camadas: doChip } = chip;
                // Ligado enquanto QUALQUER camada do chip estiver ligada; o
                // clique alinha todas no estado oposto.
                const ligado = doChip.some((k) => filtros[k]);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setFiltros((f) => {
                        const proximo = !ligado;
                        const patch = Object.fromEntries(
                          doChip.map((k) => [k, proximo]),
                        ) as Partial<Filtros>;
                        return { ...f, ...patch };
                      })
                    }
                    aria-pressed={ligado}
                    className={clsx(
                      "text-tiny flex items-center gap-1.5 rounded-md border px-2 py-1 shadow-sm transition-colors",
                      ligado
                        ? "dark:bg-dark-700 dark:border-dark-500 dark:text-dark-100 border-gray-300 bg-white text-gray-700"
                        : "dark:bg-dark-800/70 dark:border-dark-600 dark:text-dark-300 border-gray-200 bg-white/70 text-gray-400",
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: cor ?? "transparent",
                        boxShadow: cor ? undefined : "inset 0 0 0 1.5px currentColor",
                        opacity: ligado ? 1 : 0.35,
                      }}
                    />
                    {label} <span className="tabular-nums opacity-60">{total}</span>
                  </button>
                );
              })}
            </div>
          )}

          {sync.state !== "idle" && (
            <span
              className={clsx(
                "text-tiny flex items-center gap-1.5 rounded-md px-2 py-1 shadow-sm",
                sync.state === "error"
                  ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                  : "dark:bg-dark-700 dark:text-dark-200 bg-white text-gray-600",
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

        {/* Dica: entidade e relação são os dois caminhos para o contexto. */}
        {!loading && graph.nodes.length > 0 && (
          <span className="dark:bg-dark-700/70 dark:text-dark-300 text-tiny pointer-events-none absolute start-4 bottom-4 z-10 rounded-md bg-white/70 px-2 py-1 text-gray-500 backdrop-blur-sm">
            {filtros.categoria || filtros.pessoa || filtros.projeto || filtros.tag
              ? "Clique em um nó ou em uma conexão para ver o contexto"
              : "Clique em uma nota para abrir e editar o .md"}
          </span>
        )}

        {/* Contexto do que está selecionado. Overlay: se encolhesse o canvas, o
            ResizeObserver reaqueceria a física e o grafo daria um salto. */}
        <GrafoPainelContexto
          selecao={selecao}
          itensPorPath={itensPorPath}
          onFechar={() => {
            setSelecao(null);
            limparRef.current += 1;
          }}
          onIrPara={(id) => comandosRef.current?.selecionar(id)}
          onAbrirNota={(path, titulo) => setNota({ path, titulo })}
          tagsDisponiveis={tagsDisponiveis}
          podeEscrever={podeEscrever}
          onRelacionar={relacionar}
          onDesrelacionar={desrelacionar}
        />

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
                Escolha a pasta onde ficam as notas{" "}
                <span className="font-mono">.md</span> do seu Repositório. O
                grafo é montado a partir dos{" "}
                <span className="font-mono">[[wikilinks]]</span>, tags e pastas.
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
        className="dark:bg-dark-50 dark:text-dark-900 pointer-events-none fixed z-[60] hidden rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow-lg"
      />

      {/* Nó clicado: abre o .md para ler e editar direto na pasta. */}
      <NotaMemoriaModal
        isOpen={!!nota}
        close={() => setNota(null)}
        path={nota?.path ?? null}
        titulo={nota?.titulo}
        tags={tagsDaNota}
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
            nodes: g.nodes.map((n) =>
              n.id === nota.path ? { ...n, titulo: novo } : n,
            ),
          }));
          setItens((atual) =>
            atual.map((i) =>
              i.path === nota.path ? { ...i, titulo: novo } : i,
            ),
          );
          // O painel pode estar mostrando esta nota (como entidade ou como
          // vizinha) — sem isto ele ficaria com o nome antigo na tela.
          setSelecao((s) => {
            if (!s) return s;
            if (s.tipo === "relacao") {
              if (s.aId === nota.path) return { ...s, aTitulo: novo };
              if (s.bId === nota.path) return { ...s, bTitulo: novo };
              return s;
            }
            const relacoes = s.relacoes.map((r) =>
              r.id === nota.path ? { ...r, titulo: novo } : r,
            );
            return s.id === nota.path
              ? { ...s, titulo: novo, relacoes }
              : { ...s, relacoes };
          });
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
