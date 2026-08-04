// Import Dependencies
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogPanel,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  PhotoIcon,
  DocumentIcon,
  FolderIcon,
  FolderPlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Button } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { idbGet, idbSet } from "@/utils/idbKv";

// ----------------------------------------------------------------------

type NodeKind = "image" | "document" | "folder";
type TypeFilter = "all" | "image" | "document";
type ViewMode = "grid" | "list";

interface FsNode {
  id: string;
  name: string;
  kind: NodeKind;
  /** Pasta-pai; null = raiz. */
  parentId: string | null;
  /** Timestamp ISO de criação/envio. */
  createdAt: string;
  // Campos de arquivo (ausentes em pastas):
  /** Extensão em minúsculas, ex.: "pdf", "png". */
  ext?: string;
  /** Tamanho em bytes. */
  size?: number;
  /** Data-URI para preview/download (persistido no localStorage). */
  url?: string;
}

function nextId(prefix = "node") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
]);

function kindFor(file: File): NodeKind {
  if (file.type.startsWith("image/")) return "image";
  if (IMAGE_EXTS.has(extOf(file.name))) return "image";
  return "document";
}

// Chave de persistência da biblioteca (frontend-only por ora).
const STORAGE_KEY = "beculture.documentos.v1";
// Limite por arquivo não-imagem. O IndexedDB aguenta bem mais que o localStorage,
// então o teto serve só para evitar um único arquivo gigante travar a UI.
const MAX_DOC_BYTES = 25 * 1024 * 1024;

// A persistência (IndexedDB) vive em @/utils/idbKv — o localStorage tem teto de
// ~5 MB e poucas imagens como data-URI já estouravam a cota, fazendo os arquivos
// sumirem no reload. Os documentos dos grupos usam o mesmo armazenamento.

/** Lê um arquivo como data-URI persistível (sobrevive a reload, ao contrário de
 *  um objectURL `blob:`). Imagens rasterizadas são redimensionadas para caber. */
function fileToDataUrl(file: File): Promise<string> {
  const isRaster =
    file.type.startsWith("image/") && file.type !== "image/svg+xml";
  if (isRaster) return downscaleImage(file).catch(() => readAsDataUrl(file));
  return readAsDataUrl(file);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read error"));
    r.readAsDataURL(file);
  });
}

/** Redimensiona a imagem para no máx. `max`px no maior lado e reencoda, mantendo
 *  o data-URI pequeno o suficiente para o localStorage. PNG preserva alpha. */
function downscaleImage(file: File, max = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > max || height > max) {
        const scale = Math.min(max / width, max / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("sem contexto 2d"));
      ctx.drawImage(img, 0, 0, width, height);
      const type = file.type === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(type, quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("falha ao carregar imagem"));
    };
    img.src = objectUrl;
  });
}

/** Cor/tint do badge por extensão de documento. */
function tintForExt(ext: string): string {
  switch (ext) {
    case "pdf":
      return "bg-rose-500";
    case "doc":
    case "docx":
      return "bg-blue-500";
    case "xls":
    case "xlsx":
    case "csv":
      return "bg-emerald-500";
    case "ppt":
    case "pptx":
      return "bg-orange-500";
    case "zip":
    case "rar":
      return "bg-amber-500";
    default:
      return "bg-gray-500";
  }
}

// Miniatura SVG colorida (data-URI) para os exemplos de imagem — sempre carrega,
// mesmo offline.
function seedImage(label: string, from: string, to: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><text x="50%" y="52%" font-family="sans-serif" font-size="26" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Pequeno data-URI de texto para os exemplos de documento (download funcional).
function seedDoc(text: string): string {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
}

// Ids estáveis das pastas de exemplo (para referenciar como parentId).
const F_MARKETING = "folder_marketing";
const F_JURIDICO = "folder_juridico";
const F_CAMPANHAS = "folder_campanhas";

const SEED_NODES: FsNode[] = [
  // Pastas
  {
    id: F_MARKETING,
    name: "Marketing",
    kind: "folder",
    parentId: null,
    createdAt: "2026-06-10T08:00:00.000Z",
  },
  {
    id: F_JURIDICO,
    name: "Jurídico",
    kind: "folder",
    parentId: null,
    createdAt: "2026-06-10T08:05:00.000Z",
  },
  {
    id: F_CAMPANHAS,
    name: "Campanhas 2026",
    kind: "folder",
    parentId: F_MARKETING,
    createdAt: "2026-06-11T09:00:00.000Z",
  },
  // Arquivos na raiz
  {
    id: nextId("file"),
    name: "Apresentacao-Institucional.pdf",
    kind: "document",
    parentId: null,
    ext: "pdf",
    size: 2_415_000,
    createdAt: "2026-06-12T10:00:00.000Z",
    url: seedDoc("Apresentação Institucional — documento de exemplo."),
  },
  {
    id: nextId("file"),
    name: "Logo-Beculture.png",
    kind: "image",
    parentId: null,
    ext: "png",
    size: 184_000,
    createdAt: "2026-06-14T09:30:00.000Z",
    url: seedImage("Logo", "#6366f1", "#8b5cf6"),
  },
  {
    id: nextId("file"),
    name: "Planejamento-Q3.xlsx",
    kind: "document",
    parentId: null,
    ext: "xlsx",
    size: 96_000,
    createdAt: "2026-06-15T14:20:00.000Z",
    url: seedDoc("Planejamento Q3 — planilha de exemplo."),
  },
  // Arquivos dentro de Marketing
  {
    id: nextId("file"),
    name: "Banner-Campanha.jpg",
    kind: "image",
    parentId: F_MARKETING,
    ext: "jpg",
    size: 512_000,
    createdAt: "2026-06-18T16:45:00.000Z",
    url: seedImage("Banner", "#f59e0b", "#ef4444"),
  },
  // Arquivos dentro de Marketing › Campanhas 2026
  {
    id: nextId("file"),
    name: "Criativo-Black-Friday.png",
    kind: "image",
    parentId: F_CAMPANHAS,
    ext: "png",
    size: 340_000,
    createdAt: "2026-06-19T11:30:00.000Z",
    url: seedImage("Black Friday", "#111827", "#6d28d9"),
  },
  // Arquivos dentro de Jurídico
  {
    id: nextId("file"),
    name: "Contrato-Modelo.docx",
    kind: "document",
    parentId: F_JURIDICO,
    ext: "docx",
    size: 58_000,
    createdAt: "2026-06-19T11:05:00.000Z",
    url: seedDoc("Contrato modelo — documento de exemplo."),
  },
];

// ----------------------------------------------------------------------

/** Migração única: lê a biblioteca antiga do localStorage, se existir. */
function loadLegacyNodes(): FsNode[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as FsNode[];
    }
  } catch {
    /* JSON corrompido / storage indisponível */
  }
  return null;
}

export default function Documentos() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);

  const [nodes, setNodes] = useState<FsNode[]>([]);
  // Evita gravar a biblioteca antes de terminar de carregá-la do IndexedDB
  // (senão um array vazio inicial sobrescreveria os dados salvos).
  const [loaded, setLoaded] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<FsNode | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carrega a biblioteca do IndexedDB na primeira renderização. Faz a migração
  // única do localStorage antigo e cai nos exemplos de seed na primeira visita.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stored = await idbGet<FsNode[]>(STORAGE_KEY);
        if (stored && Array.isArray(stored)) {
          if (alive) setNodes(stored);
        } else {
          const legacy = loadLegacyNodes();
          if (alive) setNodes(legacy ?? SEED_NODES);
        }
      } catch {
        if (alive) setNodes(SEED_NODES);
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Persiste a biblioteca no IndexedDB a cada mudança (cota grande o bastante
  // para imagens). Só grava depois de carregar, para não apagar o que está salvo.
  useEffect(() => {
    if (!loaded) return;
    idbSet(STORAGE_KEY, nodes).catch(() => {
      toast.error("Não foi possível salvar a biblioteca neste navegador.");
    });
  }, [nodes, loaded]);

  // Caminho da pasta atual até a raiz (para o breadcrumb).
  const breadcrumb = useMemo(() => {
    const trail: FsNode[] = [];
    let id = currentFolderId;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    while (id) {
      const folder = byId.get(id);
      if (!folder) break;
      trail.unshift(folder);
      id = folder.parentId;
    }
    return trail;
  }, [currentFolderId, nodes]);

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      const incoming = Array.from(list);
      if (incoming.length === 0) return;
      const mapped: FsNode[] = [];
      for (const f of incoming) {
        const kind = kindFor(f);
        // Arquivos não-imagem muito grandes estouram o localStorage.
        if (kind !== "image" && f.size > MAX_DOC_BYTES) {
          toast.error(
            `"${f.name}" é grande demais para salvar localmente (máx. ${formatBytes(
              MAX_DOC_BYTES,
            )}).`,
          );
          continue;
        }
        try {
          // Data-URI persistível (sobrevive a reload, ao contrário de blob:).
          const url = await fileToDataUrl(f);
          mapped.push({
            id: nextId("file"),
            name: f.name,
            kind,
            parentId: currentFolderId,
            ext: extOf(f.name),
            size: f.size,
            createdAt: new Date().toISOString(),
            url,
          });
        } catch {
          toast.error(`Falha ao ler "${f.name}".`);
        }
      }
      if (mapped.length === 0) return;
      setNodes((prev) => [...mapped, ...prev]);
      toast.success(
        mapped.length === 1
          ? "1 arquivo enviado."
          : `${mapped.length} arquivos enviados.`,
      );
    },
    [currentFolderId],
  );

  const createFolder = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setNodes((prev) => [
        {
          id: nextId("folder"),
          name: trimmed,
          kind: "folder",
          parentId: currentFolderId,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      toast.success("Pasta criada.");
    },
    [currentFolderId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removeNode = useCallback((id: string) => {
    setNodes((prev) => {
      // Coleta o nó e, se for pasta, todos os descendentes.
      const toRemove = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of prev) {
          if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
            toRemove.add(n.id);
            grew = true;
          }
        }
      }
      return prev.filter((n) => !toRemove.has(n.id));
    });
    setPreview((p) => (p?.id === id ? null : p));
    toast.success("Item removido.");
  }, []);

  const openFolder = useCallback((id: string) => {
    setCurrentFolderId(id);
    setQuery("");
  }, []);

  // Estatísticas globais (toda a biblioteca, não só a pasta atual).
  const stats = useMemo(() => {
    const files = nodes.filter((n) => n.kind !== "folder");
    const images = files.filter((f) => f.kind === "image").length;
    const folders = nodes.filter((n) => n.kind === "folder").length;
    const totalSize = files.reduce((acc, f) => acc + (f.size ?? 0), 0);
    return { files: files.length, images, folders, size: totalSize };
  }, [nodes]);

  // Itens da pasta atual, com busca + filtro de tipo aplicados.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inFolder = nodes.filter((n) => n.parentId === currentFolderId);
    const filtered = inFolder.filter((n) => {
      if (q && !n.name.toLowerCase().includes(q)) return false;
      if (typeFilter === "all") return true;
      // Pastas continuam visíveis para navegação, mesmo filtrando por tipo.
      return n.kind === "folder" || n.kind === typeFilter;
    });
    // Pastas primeiro (alfabética), depois arquivos (mais recentes primeiro).
    return filtered.sort((a, b) => {
      if (a.kind === "folder" && b.kind !== "folder") return -1;
      if (a.kind !== "folder" && b.kind === "folder") return 1;
      if (a.kind === "folder" && b.kind === "folder")
        return a.name.localeCompare(b.name);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [nodes, currentFolderId, query, typeFilter]);

  const folderChildCount = useCallback(
    (folderId: string) => nodes.filter((n) => n.parentId === folderId).length,
    [nodes],
  );

  return (
    <Page title={`Documentos · ${product.name}`}>
      <div
        className="transition-content w-full px-(--margin-x) py-6"
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={handleDrop}
      >
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <PageTitle
              help={{
                description: (
                  <>
                    <p><strong>Documentos</strong> é a biblioteca de arquivos e imagens da sua empresa. Organize o conteúdo em pastas, envie novos arquivos (pelo botão ou arrastando para a área), visualize imagens e faça o download quando precisar.</p>
                    <p>Você pode alternar entre visualização em grade ou lista, filtrar por imagens ou documentos e buscar dentro da pasta atual. Os arquivos ficam salvos localmente neste navegador.</p>
                  </>
                ),
              }}
            >
              Documentos
            </PageTitle>
            <p className="dark:text-dark-300 max-w-xl text-sm text-gray-500">
              Centralize e gerencie os arquivos e imagens da sua empresa.
              Organize em pastas, envie, visualize e baixe — tudo em um só lugar.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <StatCard
              icon={FolderIcon}
              value={stats.folders}
              label="Pastas"
              tint="text-amber-500"
            />
            <StatCard
              icon={FolderOpenIcon}
              value={stats.files}
              label="Arquivos"
              tint="text-primary-500"
            />
            <StatCard
              icon={PhotoIcon}
              value={stats.images}
              label="Imagens"
              tint="text-indigo-500"
            />
          </div>
        </div>

        {/* Barra de ferramentas */}
        <div className="dark:bg-dark-900 sticky top-0 z-10 -mx-(--margin-x) mt-5 bg-gray-50 px-(--margin-x) pt-2 pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Busca */}
            <div className="relative w-full lg:max-w-xs">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="size-4.5 text-gray-400" />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nesta pasta…"
                className="form-input dark:bg-dark-700 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 h-10 w-full rounded-full border border-gray-300 bg-white pl-10 pr-9 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:ring-0"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="size-4.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filtro de tipo segmentado */}
              <div className="dark:bg-dark-700 inline-flex shrink-0 rounded-full bg-gray-200/70 p-1">
                {(
                  [
                    { id: "all", label: "Todos" },
                    { id: "image", label: "Imagens" },
                    { id: "document", label: "Documentos" },
                  ] as { id: TypeFilter; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTypeFilter(opt.id)}
                    className={clsx(
                      "rounded-full px-3.5 py-1.5 text-xs-plus font-medium transition-colors",
                      typeFilter === opt.id
                        ? "dark:bg-dark-500 dark:text-dark-50 bg-white text-gray-800 shadow-sm"
                        : "dark:text-dark-300 dark:hover:text-dark-100 text-gray-500 hover:text-gray-700",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Alternância de visualização */}
              <div className="dark:bg-dark-700 inline-flex shrink-0 rounded-full bg-gray-200/70 p-1">
                {(
                  [
                    { id: "grid", Icon: Squares2X2Icon, label: "Grade" },
                    { id: "list", Icon: ListBulletIcon, label: "Lista" },
                  ] as { id: ViewMode; Icon: typeof Squares2X2Icon; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setView(opt.id)}
                    aria-label={opt.label}
                    title={opt.label}
                    className={clsx(
                      "grid size-8 place-items-center rounded-full transition-colors",
                      view === opt.id
                        ? "dark:bg-dark-500 dark:text-dark-50 bg-white text-gray-800 shadow-sm"
                        : "dark:text-dark-300 dark:hover:text-dark-100 text-gray-500 hover:text-gray-700",
                    )}
                  >
                    <opt.Icon className="size-4.5" />
                  </button>
                ))}
              </div>

              {/* Nova pasta */}
              <button
                type="button"
                onClick={() => setNewFolderOpen(true)}
                className="dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 dark:hover:bg-dark-600 flex h-10 items-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <FolderPlusIcon className="size-4.5" />
                Nova pasta
              </button>

              {/* Enviar arquivos */}
              <Button
                color="primary"
                onClick={() => inputRef.current?.click()}
                className="h-10 gap-2 rounded-full px-4"
              >
                <ArrowUpTrayIcon className="size-4.5" />
                Enviar arquivos
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {/* Breadcrumb — hierarquia de pastas conforme for abrindo */}
          <Breadcrumb
            trail={breadcrumb}
            onNavigate={(id) => {
              setCurrentFolderId(id);
              setQuery("");
            }}
          />
        </div>

        {/* Zona de drop / conteúdo */}
        {dragging && (
          <div className="border-primary-400 bg-primary-50/50 dark:border-primary-500/60 dark:bg-primary-500/10 mt-5 grid place-items-center rounded-2xl border-2 border-dashed py-16 text-center">
            <div>
              <ArrowUpTrayIcon className="text-primary-500 mx-auto size-8" />
              <p className="dark:text-dark-100 mt-2 text-sm font-medium text-gray-700">
                Solte os arquivos para enviar nesta pasta
              </p>
            </div>
          </div>
        )}

        {!dragging && loaded && visible.length === 0 && (
          <EmptyState
            searching={query.trim().length > 0}
            onUpload={() => inputRef.current?.click()}
            onNewFolder={() => setNewFolderOpen(true)}
          />
        )}

        {!dragging && visible.length > 0 && view === "grid" && (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((n) =>
              n.kind === "folder" ? (
                <FolderCard
                  key={n.id}
                  folder={n}
                  count={folderChildCount(n.id)}
                  onOpen={() => openFolder(n.id)}
                  onRemove={() => removeNode(n.id)}
                />
              ) : (
                <FileCard
                  key={n.id}
                  file={n}
                  onPreview={() => n.kind === "image" && setPreview(n)}
                  onRemove={() => removeNode(n.id)}
                />
              ),
            )}
          </div>
        )}

        {!dragging && visible.length > 0 && view === "list" && (
          <FileTable
            items={visible}
            childCountOf={folderChildCount}
            onOpenFolder={openFolder}
            onPreview={setPreview}
            onRemove={removeNode}
          />
        )}
      </div>

      {/* Modal de preview de imagem */}
      <ImagePreview file={preview} close={() => setPreview(null)} />

      {/* Modal de nova pasta */}
      <NewFolderModal
        isOpen={newFolderOpen}
        close={() => setNewFolderOpen(false)}
        onCreate={createFolder}
        locationLabel={
          breadcrumb.length ? breadcrumb[breadcrumb.length - 1].name : "Documentos"
        }
      />
    </Page>
  );
}

// ----------------------------------------------------------------------

function Breadcrumb({
  trail,
  onNavigate,
}: {
  trail: FsNode[];
  onNavigate: (id: string | null) => void;
}) {
  return (
    <nav
      aria-label="Hierarquia de pastas"
      className="mt-3 flex flex-wrap items-center gap-1 text-sm"
    >
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className={clsx(
          "flex items-center gap-1 rounded-md px-2 py-1 transition-colors",
          trail.length === 0
            ? "dark:text-dark-50 font-semibold text-gray-800"
            : "dark:text-dark-300 dark:hover:bg-dark-600 dark:hover:text-dark-100 text-gray-500 hover:bg-gray-100 hover:text-gray-800",
        )}
      >
        <HomeIcon className="size-4" />
        Documentos
      </button>
      {trail.map((folder, i) => {
        const isLast = i === trail.length - 1;
        return (
          <span key={folder.id} className="flex items-center gap-1">
            <ChevronRightIcon className="dark:text-dark-400 size-4 text-gray-300" />
            <button
              type="button"
              onClick={() => onNavigate(folder.id)}
              className={clsx(
                "rounded-md px-2 py-1 transition-colors",
                isLast
                  ? "dark:text-dark-50 font-semibold text-gray-800"
                  : "dark:text-dark-300 dark:hover:bg-dark-600 dark:hover:text-dark-100 text-gray-500 hover:bg-gray-100 hover:text-gray-800",
              )}
            >
              {folder.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof FolderOpenIcon;
  value: number | string;
  label: string;
  tint: string;
}) {
  return (
    <div className="dark:bg-dark-700 dark:border-dark-600 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
      <Icon className={clsx("size-6 stroke-[1.5]", tint)} />
      <div>
        <p className="dark:text-dark-50 text-lg font-semibold text-gray-800">
          {value}
        </p>
        <p className="dark:text-dark-300 text-tiny-plus text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function FileThumb({ file }: { file: FsNode }) {
  if (file.kind === "image" && file.url) {
    return (
      <img
        src={file.url}
        alt={file.name}
        className="size-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div className="grid size-full place-items-center">
      <div className="relative">
        <DocumentIcon className="text-gray-300 dark:text-dark-400 size-12 stroke-[1.25]" />
        <span
          className={clsx(
            "absolute -bottom-1 left-1/2 -translate-x-1/2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white",
            tintForExt(file.ext ?? ""),
          )}
        >
          {file.ext || "file"}
        </span>
      </div>
    </div>
  );
}

function FolderCard({
  folder,
  count,
  onOpen,
  onRemove,
}: {
  folder: FsNode;
  count: number;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="dark:bg-dark-700 dark:border-dark-600 group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
      <div className="absolute end-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remover pasta"
          aria-label={`Remover pasta ${folder.name}`}
          className="dark:bg-dark-800/90 grid size-7 place-items-center rounded-lg bg-white/90 text-gray-600 shadow-sm backdrop-blur hover:text-rose-600 dark:text-dark-200"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="dark:bg-dark-600/40 grid aspect-[4/3] w-full cursor-pointer place-items-center bg-amber-50/60"
      >
        <FolderIcon className="size-14 text-amber-400 stroke-[1.25]" />
      </button>

      <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
        <p
          className="dark:text-dark-100 truncate text-xs-plus font-medium text-gray-700"
          title={folder.name}
        >
          {folder.name}
        </p>
        <p className="dark:text-dark-300 text-tiny text-gray-400">
          {count} {count === 1 ? "item" : "itens"}
        </p>
      </div>
    </div>
  );
}

function FileCard({
  file,
  onPreview,
  onRemove,
}: {
  file: FsNode;
  onPreview: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="dark:bg-dark-700 dark:border-dark-600 group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
      {/* Ações no hover */}
      <div className="absolute end-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={file.url}
          download={file.name}
          onClick={(e) => e.stopPropagation()}
          title="Baixar"
          aria-label={`Baixar ${file.name}`}
          className="dark:bg-dark-800/90 grid size-7 place-items-center rounded-lg bg-white/90 text-gray-600 shadow-sm backdrop-blur hover:text-primary-600 dark:text-dark-200"
        >
          <ArrowDownTrayIcon className="size-4" />
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remover"
          aria-label={`Remover ${file.name}`}
          className="dark:bg-dark-800/90 grid size-7 place-items-center rounded-lg bg-white/90 text-gray-600 shadow-sm backdrop-blur hover:text-rose-600 dark:text-dark-200"
        >
          <TrashIcon className="size-4" />
        </button>
      </div>

      {/* Miniatura */}
      <button
        type="button"
        onClick={onPreview}
        className={clsx(
          "dark:bg-dark-600 relative aspect-[4/3] w-full overflow-hidden bg-gray-50",
          file.kind === "image" ? "cursor-zoom-in" : "cursor-default",
        )}
      >
        <FileThumb file={file} />
      </button>

      {/* Meta */}
      <div className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
        <p
          className="dark:text-dark-100 truncate text-xs-plus font-medium text-gray-700"
          title={file.name}
        >
          {file.name}
        </p>
        <p className="dark:text-dark-300 text-tiny text-gray-400">
          {formatBytes(file.size ?? 0)} · {formatDate(file.createdAt)}
        </p>
      </div>
    </div>
  );
}

function FileTable({
  items,
  childCountOf,
  onOpenFolder,
  onPreview,
  onRemove,
}: {
  items: FsNode[];
  childCountOf: (folderId: string) => number;
  onOpenFolder: (id: string) => void;
  onPreview: (f: FsNode) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="dark:border-dark-600 mt-5 overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="dark:bg-dark-800 dark:text-dark-300 bg-gray-50 text-gray-500">
          <tr className="text-tiny-plus uppercase tracking-wide">
            <th className="px-4 py-2.5 text-start font-semibold">Nome</th>
            <th className="px-4 py-2.5 text-start font-semibold max-sm:hidden">
              Tipo
            </th>
            <th className="px-4 py-2.5 text-start font-semibold max-sm:hidden">
              Tamanho
            </th>
            <th className="px-4 py-2.5 text-start font-semibold max-md:hidden">
              Modificado
            </th>
            <th className="px-4 py-2.5 text-end font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody className="dark:divide-dark-600 divide-y divide-gray-100">
          {items.map((n) => {
            const isFolder = n.kind === "folder";
            return (
              <tr
                key={n.id}
                onDoubleClick={() => isFolder && onOpenFolder(n.id)}
                className="dark:bg-dark-700 dark:hover:bg-dark-600 bg-white hover:bg-gray-50"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        isFolder
                          ? onOpenFolder(n.id)
                          : n.kind === "image" && onPreview(n)
                      }
                      className={clsx(
                        "grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg",
                        isFolder
                          ? "bg-amber-50 dark:bg-amber-500/10"
                          : "dark:bg-dark-600 bg-gray-100",
                        (isFolder || n.kind === "image") && "cursor-pointer",
                      )}
                    >
                      {isFolder ? (
                        <FolderIcon className="size-5 text-amber-400" />
                      ) : n.kind === "image" && n.url ? (
                        <img
                          src={n.url}
                          alt={n.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span
                          className={clsx(
                            "text-[9px] font-bold uppercase text-white grid size-full place-items-center",
                            tintForExt(n.ext ?? ""),
                          )}
                        >
                          {n.ext || "file"}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        isFolder
                          ? onOpenFolder(n.id)
                          : n.kind === "image" && onPreview(n)
                      }
                      className={clsx(
                        "dark:text-dark-100 min-w-0 max-w-xs truncate text-start font-medium text-gray-700",
                        isFolder && "hover:text-primary-600",
                      )}
                      title={n.name}
                    >
                      {n.name}
                    </button>
                  </div>
                </td>
                <td className="dark:text-dark-300 px-4 py-2.5 text-gray-500 max-sm:hidden">
                  {isFolder
                    ? "Pasta"
                    : n.kind === "image"
                      ? "Imagem"
                      : "Documento"}
                </td>
                <td className="dark:text-dark-300 px-4 py-2.5 text-gray-500 max-sm:hidden">
                  {isFolder
                    ? `${childCountOf(n.id)} ${
                        childCountOf(n.id) === 1 ? "item" : "itens"
                      }`
                    : formatBytes(n.size ?? 0)}
                </td>
                <td className="dark:text-dark-300 px-4 py-2.5 text-gray-500 max-md:hidden">
                  {formatDate(n.createdAt)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {!isFolder && (
                      <a
                        href={n.url}
                        download={n.name}
                        title="Baixar"
                        aria-label={`Baixar ${n.name}`}
                        className="dark:text-dark-200 dark:hover:bg-dark-500 grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary-600"
                      >
                        <ArrowDownTrayIcon className="size-4.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(n.id)}
                      title="Remover"
                      aria-label={`Remover ${n.name}`}
                      className="dark:text-dark-200 dark:hover:bg-dark-500 grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-rose-600"
                    >
                      <TrashIcon className="size-4.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  searching,
  onUpload,
  onNewFolder,
}: {
  searching: boolean;
  onUpload: () => void;
  onNewFolder: () => void;
}) {
  return (
    <div className="dark:border-dark-600 mt-5 grid place-items-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
      <div className="max-w-sm">
        <div className="bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300 mx-auto grid size-14 place-items-center rounded-2xl">
          {searching ? (
            <MagnifyingGlassIcon className="size-7 stroke-[1.5]" />
          ) : (
            <FolderOpenIcon className="size-7 stroke-[1.5]" />
          )}
        </div>
        <h3 className="dark:text-dark-50 mt-3 text-base font-semibold text-gray-800">
          {searching ? "Nenhum item encontrado" : "Pasta vazia"}
        </h3>
        <p className="dark:text-dark-300 mt-1 text-sm text-gray-500">
          {searching
            ? "Ajuste a busca ou o filtro para encontrar o que procura."
            : "Crie uma pasta, envie arquivos e imagens ou arraste-os para esta área."}
        </p>
        {!searching && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onNewFolder}
              className="dark:border-dark-450 dark:bg-dark-700 dark:text-dark-100 dark:hover:bg-dark-600 flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FolderPlusIcon className="size-4.5" />
              Nova pasta
            </button>
            <Button
              color="primary"
              onClick={onUpload}
              className="gap-2 rounded-full px-4"
            >
              <ArrowUpTrayIcon className="size-4.5" />
              Enviar arquivos
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function NewFolderModal({
  isOpen,
  close,
  onCreate,
  locationLabel,
}: {
  isOpen: boolean;
  close: () => void;
  onCreate: (name: string) => void;
  locationLabel: string;
}) {
  const [name, setName] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name);
    setName("");
    close();
  };

  return (
    <Transition show={isOpen} appear>
      <Dialog
        open={isOpen}
        onClose={() => {
          setName("");
          close();
        }}
        className="relative z-100"
      >
        <TransitionChild
          as="div"
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
        />
        <div className="fixed inset-0 grid place-items-center p-4">
          <TransitionChild
            as={DialogPanel}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
            className="dark:bg-dark-800 w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
                <FolderPlusIcon className="size-5 text-amber-500" />
              </span>
              <div>
                <h3 className="dark:text-dark-50 text-base font-semibold text-gray-800">
                  Nova pasta
                </h3>
                <p className="dark:text-dark-300 text-tiny-plus text-gray-500">
                  Criar em: {locationLabel}
                </p>
              </div>
            </div>

            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Nome da pasta"
              className="form-input dark:bg-dark-700 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 mt-4 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:ring-0"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setName("");
                  close();
                }}
                className="dark:text-dark-200 dark:hover:bg-dark-600 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <Button
                color="primary"
                onClick={submit}
                disabled={!name.trim()}
                className="rounded-lg px-4"
              >
                Criar pasta
              </Button>
            </div>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

function ImagePreview({
  file,
  close,
}: {
  file: FsNode | null;
  close: () => void;
}) {
  return (
    <Transition show={Boolean(file)} appear>
      <Dialog open={Boolean(file)} onClose={close} className="relative z-100">
        <TransitionChild
          as="div"
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm"
        />
        <div className="fixed inset-0 grid place-items-center p-4">
          <TransitionChild
            as={DialogPanel}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
            className="dark:bg-dark-800 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="dark:border-dark-600 flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <p
                className="dark:text-dark-100 min-w-0 truncate text-sm font-medium text-gray-800"
                title={file?.name}
              >
                {file?.name}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                {file && (
                  <a
                    href={file.url}
                    download={file.name}
                    title="Baixar"
                    className="dark:text-dark-200 dark:hover:bg-dark-600 grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary-600"
                  >
                    <ArrowDownTrayIcon className="size-4.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fechar"
                  className="dark:text-dark-200 dark:hover:bg-dark-600 grid size-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
                >
                  <XMarkIcon className="size-5" />
                </button>
              </div>
            </div>
            <div className="dark:bg-dark-900 grid flex-1 place-items-center overflow-auto bg-gray-50 p-4">
              {file?.url && (
                <img
                  src={file.url}
                  alt={file.name}
                  className="max-h-[70vh] w-auto rounded-lg object-contain"
                />
              )}
            </div>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
