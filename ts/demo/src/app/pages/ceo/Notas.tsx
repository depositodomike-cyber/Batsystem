// Import Dependencies
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  PencilSquareIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  TagIcon,
  DocumentTextIcon,
  ArrowLeftIcon,
  XMarkIcon,
  CheckIcon,
  PresentationChartBarIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Button } from "@/components/ui";
import { Input, Select, Textarea } from "@/components/ui/Form";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import {
  getCurrentProduct,
  getProductCodeFromPath,
} from "@/app/navigation/ceoOs";
import { usePastasMemoria } from "./usePastasMemoria";
import {
  avisarFalhaAoSalvarNaMemoria,
  salvarConteudoNaMemoria,
} from "./memoria-conteudo";
import { setIaPrefill } from "@/utils/iaPrefill";
import { AI_STUDIO_DISABLED } from "./ia-functions";
import clsx from "clsx";

// ----------------------------------------------------------------------
// Notas — gestor de notas migrado do beculture/Confi. Duas colunas: à esquerda
// os "Assuntos" (grupos), à direita a lista de notas do assunto selecionado ou
// o editor. As notas e os assuntos ficam no navegador (localStorage). O botão
// "Gravar no Contexto" envia a nota para a API real de Memória (aparece no
// grafo); as ações de IA abrem a função correspondente na tela de IA já com o
// conteúdo da nota preenchido.
// ----------------------------------------------------------------------

interface Nota {
  id: string;
  /** Nome do assunto ("" = Sem assunto). */
  assunto: string;
  titulo: string;
  corpo: string;
  criadaEm: number;
  atualizadaEm: number;
}

const NOTAS_KEY = "ceo-notas-itens";
const ASSUNTOS_KEY = "ceo-notas-assuntos";
const SEM_ASSUNTO = "__sem__";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function formatData(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function previa(corpo: string): string {
  const t = corpo.trim().replace(/\s+/g, " ");
  return t.length > 120 ? t.slice(0, 120) + "…" : t;
}

// Deriva um título a partir da primeira linha do corpo (quando o usuário não
// informa um título explícito).
function tituloAuto(corpo: string): string {
  const primeira = corpo.trim().split("\n")[0]?.trim() ?? "";
  if (!primeira) return "Nota sem título";
  return primeira.length > 80 ? primeira.slice(0, 80) + "…" : primeira;
}

// ----------------------------------------------------------------------

export default function Notas() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const product = getCurrentProduct(pathname);
  const productCode = getProductCodeFromPath(pathname);

  // Temas = as pastas disponíveis no Contexto (regra única da aplicação).
  const { temas: memoryCategories } = usePastasMemoria();

  const [notas, setNotas] = useState<Nota[]>(() => readJSON<Nota[]>(NOTAS_KEY, []));
  const [assuntos, setAssuntos] = useState<string[]>(() =>
    readJSON<string[]>(ASSUNTOS_KEY, []),
  );

  // Seleção da coluna de assuntos e modo de exibição da coluna principal.
  const [sel, setSel] = useState<string>(SEM_ASSUNTO);
  const [view, setView] = useState<"lista" | "editor">("lista");
  const [editId, setEditId] = useState<string | null>(null); // null = nova nota

  // Estado do editor.
  const [eAssunto, setEAssunto] = useState<string>("");
  const [eTitulo, setETitulo] = useState("");
  const [eCorpo, setECorpo] = useState("");

  // Criação/renomeação inline de assunto.
  const [criandoAssunto, setCriandoAssunto] = useState(false);
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [assuntoInput, setAssuntoInput] = useState("");

  // Modal "Gravar no Contexto".
  const [memNota, setMemNota] = useState<Nota | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTAS_KEY, JSON.stringify(notas));
    } catch {
      /* ignora indisponibilidade de storage */
    }
  }, [notas]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ASSUNTOS_KEY, JSON.stringify(assuntos));
    } catch {
      /* ignora indisponibilidade de storage */
    }
  }, [assuntos]);

  // ---- Derivados ----
  const selAssunto = sel === SEM_ASSUNTO ? "" : sel;
  const notasDoAssunto = useMemo(
    () =>
      notas
        .filter((n) => (n.assunto || "") === selAssunto)
        .sort((a, b) => b.atualizadaEm - a.atualizadaEm),
    [notas, selAssunto],
  );
  const contagem = useMemo(() => {
    const map: Record<string, number> = {};
    for (const n of notas) map[n.assunto || ""] = (map[n.assunto || ""] ?? 0) + 1;
    return map;
  }, [notas]);

  // ---- Ações de assunto ----
  const criarAssunto = () => {
    const nome = assuntoInput.trim();
    setCriandoAssunto(false);
    setAssuntoInput("");
    if (!nome) return;
    if (assuntos.some((a) => a.toLowerCase() === nome.toLowerCase())) {
      setSel(nome);
      return;
    }
    setAssuntos((prev) => [...prev, nome]);
    setSel(nome);
    setView("lista");
  };

  const confirmarRenome = (antigo: string) => {
    const novo = assuntoInput.trim();
    setRenomeando(null);
    setAssuntoInput("");
    if (!novo || novo === antigo) return;
    setAssuntos((prev) => prev.map((a) => (a === antigo ? novo : a)));
    setNotas((prev) =>
      prev.map((n) => (n.assunto === antigo ? { ...n, assunto: novo } : n)),
    );
    if (sel === antigo) setSel(novo);
  };

  const excluirAssunto = (nome: string) => {
    if (
      !window.confirm(`Excluir o assunto “${nome}” e todas as suas notas?`)
    )
      return;
    setAssuntos((prev) => prev.filter((a) => a !== nome));
    setNotas((prev) => prev.filter((n) => n.assunto !== nome));
    if (sel === nome) {
      setSel(SEM_ASSUNTO);
      setView("lista");
    }
  };

  // ---- Ações de nota ----
  const novaNota = () => {
    setEditId(null);
    setEAssunto(selAssunto);
    setETitulo("");
    setECorpo("");
    setView("editor");
  };

  const abrirNota = (n: Nota) => {
    setEditId(n.id);
    setEAssunto(n.assunto || "");
    setETitulo(n.titulo);
    setECorpo(n.corpo);
    setView("editor");
  };

  const salvarEditor = () => {
    const corpo = eCorpo.trim();
    const titulo = eTitulo.trim() || tituloAuto(corpo);
    if (!corpo && !eTitulo.trim()) {
      toast.error("Escreva algo antes de salvar.");
      return;
    }
    const agora = Date.now();
    if (editId) {
      setNotas((prev) =>
        prev.map((n) =>
          n.id === editId
            ? { ...n, assunto: eAssunto, titulo, corpo, atualizadaEm: agora }
            : n,
        ),
      );
    } else {
      setNotas((prev) => [
        {
          id: `n-${agora}-${Math.round(agora % 100000)}`,
          assunto: eAssunto,
          titulo,
          corpo,
          criadaEm: agora,
          atualizadaEm: agora,
        },
        ...prev,
      ]);
    }
    setSel(eAssunto || SEM_ASSUNTO);
    setView("lista");
    setEditId(null);
    toast.success("Nota salva.");
  };

  const excluirNota = (n: Nota) => {
    if (!window.confirm(`Excluir a nota “${n.titulo}”?`)) return;
    setNotas((prev) => prev.filter((x) => x.id !== n.id));
    if (editId === n.id) {
      setView("lista");
      setEditId(null);
    }
  };

  // ---- Gravar no Contexto ----
  // A nota vira um .md na pasta (tema) escolhida — Memória é a pasta de notas
  // que desenha o grafo, não o store de Regras.
  const gravarNaMemoria = async (categoria: string) => {
    const n = memNota;
    if (!n) return;
    const r = await salvarConteudoNaMemoria({
      pasta: categoria,
      titulo: n.titulo,
      conteudo: n.corpo,
      origem: n.assunto ? `Nota · ${n.assunto}` : "Nota",
      tags: ["nota"],
    });
    if (!r.ok) {
      avisarFalhaAoSalvarNaMemoria(r.reason);
      return;
    }
    setMemNota(null);
    toast.success("Salvo no Contexto.", {
      description: `${r.pasta}/${r.arquivo} — recarregue o grafo para ver o nó.`,
    });
  };

  // ---- Ações de IA (abrem a função na tela de IA com a nota preenchida) ----
  const acaoIa = (fn: "apresentacao" | "artigo" | "melhorar") => {
    if (AI_STUDIO_DISABLED) return;
    const tema = eTitulo.trim() || tituloAuto(eCorpo);
    const contexto = eCorpo.trim();
    if (!contexto) {
      toast.error("Escreva o conteúdo da nota primeiro.");
      return;
    }
    if (fn === "melhorar") setIaPrefill(fn, { texto: contexto });
    else setIaPrefill(fn, { tema, contexto });
    navigate(`/${productCode}/ia?fn=${fn}`);
  };

  // Opções de assunto para o <Select> do editor.
  const assuntoOptions = useMemo(
    () => [
      { label: "Sem assunto", value: "" },
      ...assuntos.map((a) => ({ label: a, value: a })),
    ],
    [assuntos],
  );

  return (
    <Page title={`Notas · ${product.name}`}>
      <div className="transition-content flex min-h-0 w-full flex-col px-(--margin-x) py-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400">
            <PencilSquareIcon className="size-6 stroke-[1.5]" />
          </span>
          <div className="flex flex-col gap-0.5">
            <PageTitle
              help={{
                description: (
                  <>
                    <p>
                      <strong>Notas</strong> é o seu bloco de anotações dentro do produto: crie notas rápidas e organize-as por assunto na coluna à esquerda. As notas ficam salvas no seu navegador.
                    </p>
                    <p>
                      Quando uma nota importar, use <strong>Gravar no Contexto</strong> para enviá-la ao grafo da IA, ou as ações de IA (Apresentação, Artigo e Melhorar) para transformar o conteúdo direto na tela de IA.
                    </p>
                  </>
                ),
              }}
            >
              Notas
            </PageTitle>
            <p className="dark:text-dark-300 text-sm text-gray-400">
              Organize suas notas por assunto e grave o que importa no Contexto.
            </p>
          </div>
        </div>

        {/* Corpo: duas colunas */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
          {/* Coluna de assuntos */}
          <aside className="dark:border-dark-600 dark:bg-dark-700 flex flex-col rounded-xl border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="dark:text-dark-200 text-tiny-plus font-semibold uppercase tracking-wider text-gray-500">
                Assuntos
              </span>
              <Button
                variant="flat"
                isIcon
                onClick={() => {
                  setAssuntoInput("");
                  setCriandoAssunto(true);
                }}
                className="size-7 rounded-lg"
                aria-label="Novo assunto"
                title="Novo assunto"
              >
                <PlusIcon className="size-4.5" />
              </Button>
            </div>

            <ul className="flex flex-col gap-0.5">
              {/* Sem assunto */}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSel(SEM_ASSUNTO);
                    setView("lista");
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    sel === SEM_ASSUNTO
                      ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                      : "dark:text-dark-200 dark:hover:bg-dark-600 text-gray-700 hover:bg-gray-100",
                  )}
                >
                  <DocumentTextIcon className="size-4.5 shrink-0 stroke-[1.5]" />
                  <span className="min-w-0 flex-1 truncate text-left">
                    Sem assunto
                  </span>
                  <span className="dark:text-dark-300 text-tiny text-gray-400">
                    {contagem[""] ?? 0}
                  </span>
                </button>
              </li>

              {/* Assuntos criados */}
              {assuntos.map((a) =>
                renomeando === a ? (
                  <li key={a} className="px-1 py-0.5">
                    <input
                      autoFocus
                      value={assuntoInput}
                      onChange={(e) => setAssuntoInput(e.target.value)}
                      onBlur={() => confirmarRenome(a)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmarRenome(a);
                        else if (e.key === "Escape") {
                          setRenomeando(null);
                          setAssuntoInput("");
                        }
                      }}
                      className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
                    />
                  </li>
                ) : (
                  <li key={a} className="group/assunto">
                    <div
                      className={clsx(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        sel === a
                          ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                          : "dark:text-dark-200 dark:hover:bg-dark-600 text-gray-700 hover:bg-gray-100",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSel(a);
                          setView("lista");
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <TagIcon className="size-4.5 shrink-0 stroke-[1.5]" />
                        <span className="min-w-0 flex-1 truncate">{a}</span>
                      </button>
                      <span className="dark:text-dark-300 text-tiny text-gray-400 group-hover/assunto:hidden">
                        {contagem[a] ?? 0}
                      </span>
                      <span className="hidden shrink-0 items-center gap-0.5 group-hover/assunto:flex">
                        <button
                          type="button"
                          onClick={() => {
                            setRenomeando(a);
                            setAssuntoInput(a);
                          }}
                          className="dark:hover:bg-dark-500 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                          aria-label="Renomear assunto"
                          title="Renomear"
                        >
                          <PencilSquareIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirAssunto(a)}
                          className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                          aria-label="Excluir assunto"
                          title="Excluir"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </span>
                    </div>
                  </li>
                ),
              )}

              {/* Novo assunto (input inline) */}
              {criandoAssunto && (
                <li className="px-1 py-0.5">
                  <input
                    autoFocus
                    value={assuntoInput}
                    placeholder="Nome do assunto"
                    onChange={(e) => setAssuntoInput(e.target.value)}
                    onBlur={criarAssunto}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") criarAssunto();
                      else if (e.key === "Escape") {
                        setCriandoAssunto(false);
                        setAssuntoInput("");
                      }
                    }}
                    className="form-input dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm"
                  />
                </li>
              )}
            </ul>
          </aside>

          {/* Coluna principal */}
          <section className="dark:border-dark-600 dark:bg-dark-700 flex min-h-[24rem] flex-col rounded-xl border border-gray-200 bg-white p-4">
            {view === "lista" ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="dark:text-dark-100 truncate text-base font-semibold text-gray-800">
                    {sel === SEM_ASSUNTO ? "Sem assunto" : sel}
                  </h3>
                  <Button color="primary" onClick={novaNota} className="gap-1.5">
                    <PlusIcon className="size-4.5" />
                    Nova nota
                  </Button>
                </div>

                {notasDoAssunto.length === 0 ? (
                  <div className="dark:border-dark-500 grid flex-1 place-items-center rounded-lg border border-dashed border-gray-300">
                    <div className="text-center">
                      <p className="dark:text-dark-200 text-sm text-gray-500">
                        Nenhuma nota aqui ainda.
                      </p>
                      <p className="dark:text-dark-300 mt-1 text-xs-plus text-gray-400">
                        Clique em “Nova nota” para começar.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {notasDoAssunto.map((n) => (
                      <li
                        key={n.id}
                        className="dark:border-dark-500 dark:bg-dark-800 group flex cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-3.5 transition-colors hover:border-primary-400 dark:hover:border-primary-500/60"
                        onClick={() => abrirNota(n)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="dark:text-dark-100 min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                            {n.titulo}
                          </p>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMemNota(n);
                              }}
                              className="dark:hover:bg-dark-600 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-primary-600 dark:hover:text-primary-400"
                              aria-label="Gravar no Contexto"
                              title="Gravar no Contexto"
                            >
                              <ArrowUpTrayIcon className="size-4.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                excluirNota(n);
                              }}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                              aria-label="Excluir nota"
                              title="Excluir"
                            >
                              <TrashIcon className="size-4.5" />
                            </button>
                          </div>
                        </div>
                        {previa(n.corpo) && (
                          <p className="dark:text-dark-300 mt-1.5 line-clamp-2 text-xs-plus text-gray-500">
                            {previa(n.corpo)}
                          </p>
                        )}
                        <span className="dark:text-dark-400 mt-2 text-tiny text-gray-400">
                          {formatData(n.atualizadaEm)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              /* Editor */
              <>
                <div className="mb-4 flex items-center gap-2">
                  <Button
                    variant="flat"
                    isIcon
                    onClick={() => {
                      setView("lista");
                      setEditId(null);
                    }}
                    className="size-8 rounded-lg"
                    aria-label="Voltar"
                    title="Voltar"
                  >
                    <ArrowLeftIcon className="size-5" />
                  </Button>
                  <h3 className="dark:text-dark-100 text-base font-semibold text-gray-800">
                    {editId ? "Editar nota" : "Nova nota"}
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    label="Assunto"
                    value={eAssunto}
                    onChange={(e) => setEAssunto(e.target.value)}
                    data={assuntoOptions}
                  />
                  <Input
                    label="Título"
                    value={eTitulo}
                    maxLength={160}
                    onChange={(e) => setETitulo(e.target.value)}
                    placeholder="Título (vazio = usa a 1ª linha)"
                  />
                </div>

                <div className="mt-4">
                  <Textarea
                    component={MemoriaTextarea}
                    label="Conteúdo"
                    rows={10}
                    value={eCorpo}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      setECorpo(e.target.value)
                    }
                    placeholder="Escreva a nota… (“[[” conecta ao Contexto)"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button color="primary" onClick={salvarEditor} className="gap-1.5">
                    <CheckIcon className="size-4.5" />
                    Salvar
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      const corpo = eCorpo.trim();
                      if (!corpo) {
                        toast.error("Escreva algo antes de gravar.");
                        return;
                      }
                      setMemNota({
                        id: editId ?? "editor",
                        assunto: eAssunto,
                        titulo: eTitulo.trim() || tituloAuto(corpo),
                        corpo,
                        criadaEm: Date.now(),
                        atualizadaEm: Date.now(),
                      });
                    }}
                    className="gap-1.5"
                  >
                    <ArrowUpTrayIcon className="size-4.5" />
                    Gravar no Contexto
                  </Button>

                  <span className="dark:border-dark-500 mx-1 hidden h-6 border-l border-gray-200 sm:block" />

                  <span className="dark:text-dark-300 mr-1 text-tiny-plus text-gray-400">
                    Ações de IA:
                  </span>
                  <Button
                    variant="flat"
                    onClick={() => acaoIa("apresentacao")}
                    disabled={AI_STUDIO_DISABLED}
                    className={clsx(
                      "gap-1.5",
                      AI_STUDIO_DISABLED && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <PresentationChartBarIcon className="size-4.5" />
                    Apresentação
                  </Button>
                  <Button
                    variant="flat"
                    onClick={() => acaoIa("artigo")}
                    disabled={AI_STUDIO_DISABLED}
                    className={clsx(
                      "gap-1.5",
                      AI_STUDIO_DISABLED && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <DocumentTextIcon className="size-4.5" />
                    Artigo
                  </Button>
                  <Button
                    variant="flat"
                    onClick={() => acaoIa("melhorar")}
                    disabled={AI_STUDIO_DISABLED}
                    className={clsx(
                      "gap-1.5",
                      AI_STUDIO_DISABLED && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <SparklesIcon className="size-4.5" />
                    Melhorar
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Modal: Gravar no Contexto */}
      <GravarMemoriaModal
        nota={memNota}
        categories={memoryCategories}
        close={() => setMemNota(null)}
        onConfirm={gravarNaMemoria}
      />
    </Page>
  );
}

// ----------------------------------------------------------------------
// Modal de confirmação para gravar a nota no Contexto — permite escolher o tema
// (= pasta do Contexto) onde a memória será registrada.
// ----------------------------------------------------------------------

interface MemCategory {
  id: string;
  label: string;
}

function GravarMemoriaModal({
  nota,
  categories,
  close,
  onConfirm,
}: {
  nota: Nota | null;
  categories: MemCategory[];
  close: () => void;
  onConfirm: (categoria: string) => Promise<void>;
}) {
  const [categoria, setCategoria] = useState("");
  const [salvando, setSalvando] = useState(false);
  const abertoRef = useRef(false);

  // Define a categoria inicial quando o modal abre.
  useEffect(() => {
    if (nota && !abertoRef.current) {
      abertoRef.current = true;
      setCategoria(categories[0]?.id ?? "");
      setSalvando(false);
    }
    if (!nota) abertoRef.current = false;
  }, [nota, categories]);

  const confirmar = async () => {
    if (!categoria) return;
    setSalvando(true);
    try {
      await onConfirm(categoria);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Transition show={!!nota}>
      <Dialog onClose={close} className="relative z-60">
        <TransitionChild
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="dark:bg-black/40 fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" />
      </TransitionChild>

      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <DialogPanel className="dark:bg-dark-750 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="dark:bg-primary-500/15 grid size-10 place-items-center rounded-xl bg-primary-50">
                  <ArrowUpTrayIcon className="size-5.5 text-primary-600 dark:text-primary-400" />
                </span>
                <div>
                  <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                    Gravar no Contexto
                  </DialogTitle>
                  <p className="dark:text-dark-300 text-xs-plus text-gray-500">
                    A nota vira um contexto e passa a aparecer no grafo.
                  </p>
                </div>
              </div>
              <Button
                onClick={close}
                variant="flat"
                isIcon
                className="size-8 shrink-0 rounded-full"
                aria-label="Fechar"
              >
                <XMarkIcon className="size-5" />
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="dark:border-dark-500 dark:bg-dark-800 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
                  {nota?.titulo}
                </p>
                {nota && previa(nota.corpo) && (
                  <p className="dark:text-dark-300 mt-1 line-clamp-2 text-xs-plus text-gray-500">
                    {previa(nota.corpo)}
                  </p>
                )}
              </div>
              <Select
                label="Tema"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                data={categories.map((c) => ({ label: c.label, value: c.id }))}
                description="Os temas são as pastas disponíveis no Contexto."
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outlined" className="rounded-lg" onClick={close}>
                Cancelar
              </Button>
              <Button
                color="primary"
                className="gap-1.5 rounded-lg"
                disabled={!categoria || salvando}
                onClick={confirmar}
              >
                <ArrowUpTrayIcon className="size-4.5" />
                {salvando ? "Enviando…" : "Gravar"}
              </Button>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
      </Dialog>
    </Transition>
  );
}
