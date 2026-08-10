// Import Dependencies
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  ArrowUpTrayIcon,
  FolderPlusIcon,
  XMarkIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  CpuChipIcon,
  FolderIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Badge, Button, Spinner } from "@/components/ui";
import { Input, Select, Textarea } from "@/components/ui/Form";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import {
  getCurrentProduct,
  getProductCodeFromPath,
} from "@/app/navigation/ceoOs";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { useConnectorsContext } from "@/app/contexts/connectors/context";
import { useAuthContext } from "@/app/contexts/auth/context";
import { usePastasMemoria } from "./usePastasMemoria";
import { emailsMock, marcadoresDaCaixa, type EmailItem } from "@/app/data/emails";
import { MEMORIA_MAX_TITULO } from "@/app/data/memoria";
import { fetchCaixaDeEntradaApi } from "@/services/api/email";
import { formatBytes } from "@/utils/formatByte";
import { memoriaVaultSupported } from "@/utils/memoriaVault";
import { chaveConta, lerComMigracao } from "@/utils/escopoConta";
import {
  avisarFalhaMemoria,
  salvarDocumentoNoGrupo,
} from "./memoria-grupos";
import {
  avisarFalhaAoSalvarNaMemoria,
  salvarConteudoNaMemoria,
} from "./memoria-conteudo";

// ----------------------------------------------------------------------
// E-mail — leitura da caixa de entrada do conector, com duas saídas para o
// resto do produto: "Salvar no Contexto" (vira memória da IA, aparece no grafo)
// e "Salvar no Grupo" (guarda uma cópia dentro de um agrupamento).
//
// Com o Gmail (ou o Outlook) autorizado em Conectores, a caixa vem do provedor
// pelo backend; sem nenhum conector de e-mail, cai na caixa de demonstração
// (emailsMock). O que é do usuário — o que já foi lido e o que já foi mandado
// para o Contexto — fica no localStorage, no mesmo padrão da tela de Notas.
// ----------------------------------------------------------------------

const LIDOS_BASE = "ceo-email-lidos";
const NA_MEMORIA_BASE = "ceo-email-na-memoria";

/** Conectores de e-mail suportados, na ordem de preferência. */
const PROVEDORES: { id: string; label: string }[] = [
  { id: "gmail", label: "Gmail" },
  { id: "outlook", label: "Outlook" },
];

type Filtro = "todos" | "nao-lidos" | "anexos" | "salvos";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "nao-lidos", label: "Não lidos" },
  { id: "anexos", label: "Com anexo" },
  { id: "salvos", label: "Salvos" },
];

function readJSON<T>(base: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = lerComMigracao(base);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(base: string, value: unknown) {
  try {
    window.localStorage.setItem(chaveConta(base), JSON.stringify(value));
  } catch {
    /* ignora indisponibilidade de storage */
  }
}

/** Data curta na lista: hora quando é de hoje, dia/mês no resto do ano. */
function dataCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hoje = new Date();
  const mesmoDia =
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear();
  return mesmoDia
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Data por extenso no cabeçalho da leitura. */
function dataLonga(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previa(corpo: string): string {
  return corpo.replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Corpo guardado na cópia do grupo. Um e-mail real chega a dezenas de milhares
 * de caracteres e os grupos vivem no localStorage (~5 MB no total): sem corte,
 * meia dúzia de e-mails estoura a cota e NADA mais é persistido. A página do
 * grupo mostra só um trecho, e o e-mail completo continua na caixa e no .md
 * gravado na pasta do grupo no Contexto.
 */
const GRUPO_MAX_CORPO = 4000;

function corpoParaGrupo(corpo: string): string {
  if (corpo.length <= GRUPO_MAX_CORPO) return corpo;
  return `${corpo.slice(0, GRUPO_MAX_CORPO).trimEnd()}\n\n[…] E-mail cortado nesta cópia — abra o original na caixa de entrada.`;
}

/** Mensagem de erro da API (o axios rejeita com o corpo da resposta). */
function mensagemErro(err: unknown, fallback: string): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m)) return m.join(" ");
  }
  return fallback;
}

/** Iniciais do remetente para o avatar da lista. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

// ----------------------------------------------------------------------

export default function Email() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const productCode = getProductCodeFromPath(pathname);

  const { projectsByProduct, addEmailToProject, openCreate } =
    useProjectsContext();
  const { isConnected } = useConnectorsContext();
  const { isAuthenticated } = useAuthContext();

  // Temas = as pastas disponíveis no Contexto (regra única da aplicação).
  const { temas: memoryCategories } = usePastasMemoria();
  const grupos = projectsByProduct(productCode);

  // Provedor de e-mail autorizado em Conectores (Gmail tem preferência).
  const provedor = useMemo(
    () => PROVEDORES.find((p) => isConnected(p.id)) ?? null,
    [isConnected],
  );
  const usarCaixaReal = isAuthenticated && !!provedor;

  // Caixa real e erro carregam o provedor de origem: assim, ao trocar de
  // conector, o que era do anterior simplesmente deixa de valer — sem precisar
  // limpar estado num efeito.
  const [dados, setDados] = useState<{
    provedorId: string;
    conta: string | null;
    emails: EmailItem[];
  } | null>(null);
  const [erroCarga, setErroCarga] = useState<{
    provedorId: string;
    texto: string;
  } | null>(null);
  /** Recarga manual (botão Atualizar) — muda para disparar o efeito de novo. */
  const [recarga, setRecarga] = useState(0);
  const [atualizando, setAtualizando] = useState(false);

  const doProvedor =
    provedor && dados?.provedorId === provedor.id ? dados : null;
  const caixaReal = doProvedor?.emails ?? null;
  const conta = doProvedor?.conta ?? null;
  const erro =
    provedor && erroCarga?.provedorId === provedor.id ? erroCarga.texto : null;
  // Há provedor, ainda não há caixa nem erro → a primeira leitura está em voo.
  const carregando = (usarCaixaReal && !caixaReal && !erro) || atualizando;

  const [lidos, setLidos] = useState<string[]>(() =>
    readJSON<string[]>(LIDOS_BASE, []),
  );
  const [naMemoria, setNaMemoria] = useState<string[]>(() =>
    readJSON<string[]>(NA_MEMORIA_BASE, []),
  );

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [marcador, setMarcador] = useState<string>("");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  // Modais de saída (Memória / Grupo) — guardam o e-mail que será salvo.
  const [memEmail, setMemEmail] = useState<EmailItem | null>(null);
  const [grupoEmail, setGrupoEmail] = useState<EmailItem | null>(null);

  // Lê a caixa do provedor conectado: na entrada da tela, ao trocar de
  // conector e a cada clique em "Atualizar".
  useEffect(() => {
    if (!usarCaixaReal || !provedor) return;
    const { id, label } = provedor;
    let vivo = true;
    (async () => {
      try {
        const { conta, emails } = await fetchCaixaDeEntradaApi(id);
        if (!vivo) return;
        setDados({ provedorId: id, conta, emails });
        setErroCarga(null);
      } catch (err) {
        if (!vivo) return;
        setErroCarga({
          provedorId: id,
          texto: mensagemErro(
            err,
            `Não foi possível ler a caixa do ${label}. Tente novamente.`,
          ),
        });
      } finally {
        if (vivo) setAtualizando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [usarCaixaReal, provedor, recarga]);

  const carregar = useCallback(() => {
    setAtualizando(true);
    setRecarga((n) => n + 1);
  }, []);

  // Fonte da lista: a caixa do provedor quando há conector; o mock no demo.
  const caixa = useMemo(
    () => (usarCaixaReal ? (caixaReal ?? []) : emailsMock),
    [usarCaixaReal, caixaReal],
  );

  useEffect(() => writeJSON(LIDOS_BASE, lidos), [lidos]);
  useEffect(() => writeJSON(NA_MEMORIA_BASE, naMemoria), [naMemoria]);

  const marcadores = useMemo(() => marcadoresDaCaixa(caixa), [caixa]);

  // "Lido" = já aberto aqui ou já lido no provedor. Sem o flag do provedor
  // (caixa de demonstração), vale só o que foi aberto nesta aplicação.
  const foiLido = useCallback(
    (e: EmailItem) => lidos.includes(e.id) || e.naoLido === false,
    [lidos],
  );

  // Grupos que já contêm cada e-mail — para o selo "Em grupo" na lista.
  const gruposPorEmail = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const g of grupos) {
      for (const e of g.emails) (map[e.id] ??= []).push(g.title);
    }
    return map;
  }, [grupos]);

  const emails = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return caixa
      .filter((e) => {
        if (marcador && !(e.marcadores ?? []).includes(marcador)) return false;
        if (filtro === "nao-lidos" && foiLido(e)) return false;
        if (filtro === "anexos" && !(e.anexos?.length ?? 0)) return false;
        if (
          filtro === "salvos" &&
          !naMemoria.includes(e.id) &&
          !gruposPorEmail[e.id]
        )
          return false;
        if (!termo) return true;
        return (
          e.assunto.toLowerCase().includes(termo) ||
          e.remetenteNome.toLowerCase().includes(termo) ||
          e.remetenteEmail.toLowerCase().includes(termo) ||
          e.corpo.toLowerCase().includes(termo)
        );
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [caixa, busca, filtro, marcador, foiLido, naMemoria, gruposPorEmail]);

  const aberto = caixa.find((e) => e.id === abertoId) ?? null;
  const naoLidos = caixa.filter((e) => !foiLido(e)).length;

  const abrir = (e: EmailItem) => {
    setAbertoId(e.id);
    setLidos((prev) => (prev.includes(e.id) ? prev : [...prev, e.id]));
  };

  // ---- Salvar no Contexto ----
  // O e-mail vira um .md na pasta (tema) escolhida da Pasta do Contexto — é o
  // que o grafo desenha e o que a IA consulta. Em caso de falha o modal
  // continua aberto, com o texto já revisado, para tentar de novo.
  const gravarNaMemoria = async (
    categoria: string,
    titulo: string,
    conteudo: string,
  ) => {
    const e = memEmail;
    if (!e) return;
    const r = await salvarConteudoNaMemoria({
      pasta: categoria,
      titulo,
      conteudo,
      origem: `E-mail · ${e.remetenteNome} <${e.remetenteEmail}>`,
      data: dataLonga(e.data),
      tags: ["email"],
    });
    if (!r.ok) {
      avisarFalhaAoSalvarNaMemoria(r.reason);
      return;
    }
    setNaMemoria((prev) => (prev.includes(e.id) ? prev : [...prev, e.id]));
    setMemEmail(null);
    toast.success("Salvo no Contexto.", {
      description: `${r.pasta}/${r.arquivo} — recarregue o grafo para ver o nó.`,
    });
  };

  // ---- Salvar no Grupo ----
  // Além de entrar na página do grupo, o e-mail vira .md na pasta do grupo na
  // Memória — é um documento salvo no grupo como qualquer outro.
  const gravarNoGrupo = (projectId: string) => {
    const e = grupoEmail;
    if (!e) return;
    const grupo = grupos.find((g) => g.id === projectId);
    if (grupo?.emails.some((x) => x.id === e.id)) {
      setGrupoEmail(null);
      toast("Este e-mail já está no grupo.", { description: grupo.title });
      return;
    }
    const gravou = addEmailToProject(projectId, {
      id: e.id,
      assunto: e.assunto,
      remetente: `${e.remetenteNome} <${e.remetenteEmail}>`,
      data: e.data,
      corpo: corpoParaGrupo(e.corpo),
    });
    setGrupoEmail(null);
    if (!gravou) {
      toast.error("Não foi possível salvar no grupo.", {
        description: "Recarregue a página e tente de novo.",
      });
      return;
    }
    toast.success("Salvo no grupo.", {
      description: `${grupo?.title ?? "Grupo"} · o e-mail aparece na página do grupo.`,
    });

    if (grupo && memoriaVaultSupported()) {
      salvarDocumentoNoGrupo({
        grupo: grupo.title,
        titulo: e.assunto,
        conteudo: e.corpo,
        origem: `E-mail · ${e.remetenteNome} <${e.remetenteEmail}>`,
        tags: ["email"],
      }).then((r) => {
        if (!r.ok) avisarFalhaMemoria(r.reason);
      });
    }
  };

  return (
    <Page title={`E-mail · ${product.name}`}>
      <div className="transition-content flex min-h-0 w-full flex-col px-(--margin-x) py-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <span className="bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 grid size-11 place-items-center rounded-xl">
            <EnvelopeIcon className="size-6 stroke-[1.5]" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <PageTitle
              help={{
                description: (
                  <>
                    <p>
                      <strong>E-mail</strong> mostra a sua caixa de entrada aqui dentro. Conecte o Gmail ou o Outlook em Conectores para ler os e-mails reais; sem conector, você vê uma caixa de demonstração. Use a busca e os filtros (não lidos, com anexo, salvos) para encontrar mensagens.
                    </p>
                    <p>
                      Ao abrir um e-mail, você pode <strong>Salvar no Contexto</strong> — o conteúdo vira um contexto da IA e aparece no grafo — ou <strong>Salvar no Grupo</strong>, guardando uma cópia dentro de um agrupamento.
                    </p>
                  </>
                ),
              }}
            >
              E-mail
            </PageTitle>
            <p className="dark:text-dark-300 truncate text-sm text-gray-400">
              {usarCaixaReal
                ? `Caixa de entrada do ${provedor!.label}${conta ? ` · ${conta}` : ""}`
                : "Leia a caixa de entrada e guarde o que importa no Contexto ou num grupo."}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {naoLidos > 0 && (
              <Badge color="primary" variant="soft">
                {naoLidos} não {naoLidos === 1 ? "lido" : "lidos"}
              </Badge>
            )}
            {usarCaixaReal && (
              <Button
                variant="outlined"
                onClick={carregar}
                disabled={carregando}
                className="h-8 gap-1.5 px-2.5 text-xs-plus"
              >
                {carregando ? (
                  <Spinner className="size-4" />
                ) : (
                  <ArrowPathIcon className="size-4" />
                )}
                {carregando ? "Atualizando…" : "Atualizar"}
              </Button>
            )}
          </div>
        </div>

        {/* Falha ao ler a caixa do provedor — nunca cai para dados de exemplo. */}
        {erro && (
          <div className="dark:border-warning/30 dark:bg-warning/10 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="dark:text-dark-100 text-sm text-gray-700">{erro}</p>
              <Button
                variant="outlined"
                onClick={carregar}
                disabled={carregando}
                className="mt-2 h-7 gap-1.5 px-2.5 text-tiny"
              >
                <ArrowPathIcon className="size-3.5" />
                Tentar de novo
              </Button>
            </div>
          </div>
        )}

        {/* Sem conector de e-mail: a caixa exibida é a de demonstração. */}
        {!usarCaixaReal && (
          <p className="dark:border-dark-600 dark:bg-dark-700 dark:text-dark-300 mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs-plus text-gray-500">
            Esta é uma caixa de demonstração. Conecte o Gmail ou o Outlook em{" "}
            <span className="dark:text-dark-100 font-medium text-gray-700">
              Conectores
            </span>{" "}
            para ler os seus e-mails aqui.
          </p>
        )}

        {/* Busca + filtros */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por assunto, remetente ou conteúdo…"
            prefix={<MagnifyingGlassIcon className="size-4.5" />}
            classNames={{ root: "sm:max-w-sm" }}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-xs-plus font-medium transition-colors",
                  filtro === f.id
                    ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                    : "dark:text-dark-300 dark:hover:bg-dark-600 text-gray-500 hover:bg-gray-100",
                )}
              >
                {f.label}
              </button>
            ))}
            {marcadores.length > 0 && (
              <select
                value={marcador}
                onChange={(e) => setMarcador(e.target.value)}
                aria-label="Filtrar por marcador"
                className="form-select dark:border-dark-500 dark:bg-dark-800 dark:text-dark-100 rounded-full border border-gray-300 bg-white py-1.5 ps-3 pe-8 text-xs-plus text-gray-600"
              >
                <option value="">Todos os marcadores</option>
                {marcadores.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Corpo: lista + leitura */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
          {/* Lista */}
          <aside
            className={clsx(
              "dark:border-dark-600 dark:bg-dark-700 flex-col rounded-xl border border-gray-200 bg-white p-2",
              aberto ? "hidden lg:flex" : "flex",
            )}
          >
            {carregando && caixaReal === null ? (
              <div className="flex items-center justify-center gap-2 px-3 py-8">
                <Spinner className="size-4" />
                <p className="dark:text-dark-400 text-sm text-gray-400">
                  Lendo a caixa do {provedor?.label}…
                </p>
              </div>
            ) : emails.length === 0 ? (
              <p className="dark:text-dark-400 px-3 py-8 text-center text-sm text-gray-400">
                {caixa.length === 0
                  ? erro
                    ? "Não foi possível carregar a caixa de entrada."
                    : "Nenhum e-mail na caixa de entrada."
                  : "Nenhum e-mail com esses filtros."}
              </p>
            ) : (
              <ul className="flex max-h-[calc(100vh-320px)] flex-col gap-0.5 overflow-y-auto">
                {emails.map((e) => {
                  const lido = foiLido(e);
                  const emGrupo = gruposPorEmail[e.id];
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => abrir(e)}
                        className={clsx(
                          "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          abertoId === e.id
                            ? "bg-primary-600/10 dark:bg-primary-400/10"
                            : "dark:hover:bg-dark-600 hover:bg-gray-100",
                        )}
                      >
                        <span
                          className={clsx(
                            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full text-tiny font-semibold",
                            lido
                              ? "dark:bg-dark-500 dark:text-dark-200 bg-gray-100 text-gray-500"
                              : "bg-primary-600/15 text-primary-600 dark:bg-primary-400/15 dark:text-primary-400",
                          )}
                        >
                          {iniciais(e.remetenteNome)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span
                              className={clsx(
                                "min-w-0 flex-1 truncate text-sm",
                                lido
                                  ? "dark:text-dark-200 text-gray-600"
                                  : "dark:text-dark-50 font-semibold text-gray-800",
                              )}
                            >
                              {e.remetenteNome}
                            </span>
                            <span className="dark:text-dark-400 shrink-0 text-tiny text-gray-400">
                              {dataCurta(e.data)}
                            </span>
                          </span>
                          <span
                            className={clsx(
                              "mt-0.5 block truncate text-xs-plus",
                              lido
                                ? "dark:text-dark-300 text-gray-500"
                                : "dark:text-dark-100 font-medium text-gray-700",
                            )}
                          >
                            {e.assunto}
                          </span>
                          <span className="dark:text-dark-400 mt-0.5 block truncate text-tiny text-gray-400">
                            {previa(e.corpo)}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1">
                            {(e.anexos?.length ?? 0) > 0 && (
                              <PaperClipIcon className="dark:text-dark-400 size-3.5 text-gray-400" />
                            )}
                            {naMemoria.includes(e.id) && (
                              <Badge
                                color="primary"
                                variant="soft"
                                className="text-tiny"
                              >
                                Na memória
                              </Badge>
                            )}
                            {emGrupo && (
                              <Badge
                                color="info"
                                variant="soft"
                                className="max-w-[9rem] truncate text-tiny"
                              >
                                {emGrupo.length > 1
                                  ? `${emGrupo.length} grupos`
                                  : emGrupo[0]}
                              </Badge>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Leitura */}
          <section
            className={clsx(
              "dark:border-dark-600 dark:bg-dark-700 min-w-0 flex-col rounded-xl border border-gray-200 bg-white",
              aberto ? "flex" : "hidden lg:flex",
            )}
          >
            {!aberto ? (
              <div className="grid grow place-items-center px-6 py-16 text-center">
                <div>
                  <EnvelopeIcon className="dark:text-dark-500 mx-auto size-10 text-gray-300 stroke-[1.5]" />
                  <p className="dark:text-dark-300 mt-3 text-sm text-gray-400">
                    Selecione um e-mail para ler.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="dark:border-dark-600 border-b border-gray-200 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Button
                      variant="flat"
                      isIcon
                      onClick={() => setAbertoId(null)}
                      className="size-8 shrink-0 rounded-full lg:hidden"
                      aria-label="Voltar para a lista"
                    >
                      <ArrowLeftIcon className="size-5" />
                    </Button>
                    <div className="min-w-0 flex-1">
                      <h3 className="dark:text-dark-50 text-lg font-semibold text-gray-800">
                        {aberto.assunto}
                      </h3>
                      <p className="dark:text-dark-300 mt-1 text-xs-plus text-gray-500">
                        <span className="dark:text-dark-100 font-medium text-gray-700">
                          {aberto.remetenteNome}
                        </span>{" "}
                        &lt;{aberto.remetenteEmail}&gt; · para {aberto.para}
                      </p>
                      <p className="dark:text-dark-400 mt-0.5 text-tiny text-gray-400">
                        {dataLonga(aberto.data)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      color="primary"
                      onClick={() => setMemEmail(aberto)}
                      className="h-8 gap-1.5 px-2.5 text-xs-plus"
                    >
                      {naMemoria.includes(aberto.id) ? (
                        <CheckCircleIcon className="size-4" />
                      ) : (
                        <ArrowUpTrayIcon className="size-4" />
                      )}
                      {naMemoria.includes(aberto.id)
                        ? "Salvar de novo no Contexto"
                        : "Salvar no Contexto"}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => setGrupoEmail(aberto)}
                      className="h-8 gap-1.5 px-2.5 text-xs-plus"
                    >
                      <FolderPlusIcon className="size-4" />
                      Salvar no Grupo
                    </Button>
                    {(aberto.marcadores ?? []).map((m) => (
                      <Badge key={m} variant="soft" className="text-tiny">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="max-h-[calc(100vh-380px)] overflow-y-auto px-5 py-4">
                  <p className="dark:text-dark-200 text-sm leading-relaxed whitespace-pre-line text-gray-600">
                    {aberto.corpo}
                  </p>

                  {(aberto.anexos?.length ?? 0) > 0 && (
                    <div className="dark:border-dark-600 mt-5 border-t border-gray-200 pt-4">
                      <p className="dark:text-dark-200 mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-gray-600 uppercase">
                        <PaperClipIcon className="size-4" /> Anexos
                      </p>
                      <ul className="flex flex-wrap gap-2">
                        {aberto.anexos!.map((a) => (
                          <li
                            key={a.nome}
                            className="dark:border-dark-500 dark:bg-dark-800 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                          >
                            <PaperClipIcon className="dark:text-dark-300 size-4 shrink-0 text-gray-400" />
                            <span className="dark:text-dark-100 max-w-[14rem] truncate text-xs-plus text-gray-700">
                              {a.nome}
                            </span>
                            <span className="dark:text-dark-400 shrink-0 font-mono text-tiny text-gray-400">
                              {formatBytes(a.tamanho, 1024, 0)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <SalvarNaMemoriaModal
        email={memEmail}
        categories={memoryCategories}
        close={() => setMemEmail(null)}
        onConfirm={gravarNaMemoria}
      />

      <SalvarNoGrupoModal
        email={grupoEmail}
        grupos={grupos.map((g) => ({
          id: g.id,
          title: g.title,
          jaTem: g.emails.some((e) => e.id === grupoEmail?.id),
        }))}
        close={() => setGrupoEmail(null)}
        onConfirm={gravarNoGrupo}
        onCriarGrupo={() => {
          setGrupoEmail(null);
          openCreate();
        }}
      />
    </Page>
  );
}

// ----------------------------------------------------------------------
// Modal "Salvar no Contexto" — deixa escolher o tema e revisar título/conteúdo
// antes de gravar, porque um e-mail costuma trazer assinatura e ruído que não
// deveriam entrar na memória da IA.
// ----------------------------------------------------------------------

interface MemCategory {
  id: string;
  label: string;
}

function SalvarNaMemoriaModal({
  email,
  categories,
  close,
  onConfirm,
}: {
  email: EmailItem | null;
  categories: MemCategory[];
  close: () => void;
  onConfirm: (categoria: string, titulo: string, conteudo: string) => Promise<void>;
}) {
  const [categoria, setCategoria] = useState("");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const abertoRef = useRef(false);

  // Preenche os campos quando o modal abre (e só então — o usuário pode editar).
  // O assunto entra cortado no limite do título: um "Enc.: Re: …" longo passaria
  // do teto da API e a gravação falharia sem o usuário entender por quê.
  useEffect(() => {
    if (email && !abertoRef.current) {
      abertoRef.current = true;
      setCategoria(categories[0]?.id ?? "");
      setTitulo(email.assunto.slice(0, MEMORIA_MAX_TITULO));
      setConteudo(email.corpo);
      setSalvando(false);
    }
    if (!email) abertoRef.current = false;
  }, [email, categories]);

  // Só o título tem teto (vira o nome do arquivo .md e o título do nó). O corpo
  // não tem: a nota é um arquivo na pasta, não uma linha de banco — e-mail longo
  // é a regra, e travar o botão em 8000 caracteres impedia justamente esses.
  const excedeTitulo = titulo.trim().length > MEMORIA_MAX_TITULO;
  const podeSalvar =
    !!categoria && !!titulo.trim() && !!conteudo.trim() && !excedeTitulo;

  const confirmar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      await onConfirm(categoria, titulo.trim(), conteudo.trim());
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalShell
      show={!!email}
      close={close}
      icon={CpuChipIcon}
      title="Salvar no Contexto"
      description="O e-mail vira um contexto da IA e passa a aparecer no grafo."
      footer={
        <>
          <Button variant="outlined" className="rounded-lg" onClick={close}>
            Cancelar
          </Button>
          <Button
            color="primary"
            className="gap-1.5 rounded-lg"
            onClick={confirmar}
            disabled={salvando || !podeSalvar}
          >
            {salvando && <Spinner className="size-4" />}
            {salvando ? "Gravando…" : "Gravar no Contexto"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="dark:text-dark-300 text-xs-plus text-gray-500">
          De {email?.remetenteNome} · {email ? dataLonga(email.data) : ""}
        </p>
        {/* Sem isto o botão só fica cinza e o usuário não sabe o motivo. */}
        {!conteudo.trim() && (
          <p className="dark:border-dark-500 dark:bg-dark-800 dark:text-dark-200 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs-plus text-gray-600">
            Este e-mail não trouxe texto (só anexo ou imagem). Escreva abaixo o
            que a IA deve lembrar dele para poder gravar.
          </p>
        )}
        <Select
          label="Tema"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          data={categories.map((c) => ({ label: c.label, value: c.id }))}
          description="Os temas são as pastas disponíveis no Contexto."
        />
        <Input
          label="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          error={
            excedeTitulo
              ? `O título deve ter no máximo ${MEMORIA_MAX_TITULO} caracteres.`
              : undefined
          }
        />
        <div>
          <Textarea
            component={MemoriaTextarea}
            label="Conteúdo"
            rows={8}
            value={conteudo}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setConteudo(e.target.value)
            }
            description="Edite antes de gravar — “[[” conecta o trecho a uma nota do Contexto."
          />
          <p className="dark:text-dark-300 mt-1.5 text-tiny text-gray-400">
            {conteudo.trim().length.toLocaleString("pt-BR")} caracteres
          </p>
        </div>
      </div>
    </ModalShell>
  );
}

// ----------------------------------------------------------------------
// Modal "Salvar no Grupo" — escolhe o agrupamento que receberá uma cópia do
// e-mail. Sem grupos criados, oferece o atalho para criar o primeiro.
// ----------------------------------------------------------------------

function SalvarNoGrupoModal({
  email,
  grupos,
  close,
  onConfirm,
  onCriarGrupo,
}: {
  email: EmailItem | null;
  grupos: { id: string; title: string; jaTem: boolean }[];
  close: () => void;
  onConfirm: (projectId: string) => void;
  onCriarGrupo: () => void;
}) {
  const [grupoId, setGrupoId] = useState("");
  const abertoRef = useRef(false);

  useEffect(() => {
    if (email && !abertoRef.current) {
      abertoRef.current = true;
      setGrupoId(grupos.find((g) => !g.jaTem)?.id ?? "");
    }
    if (!email) abertoRef.current = false;
  }, [email, grupos]);

  const semGrupos = grupos.length === 0;

  return (
    <ModalShell
      show={!!email}
      close={close}
      icon={FolderIcon}
      title="Salvar no Grupo"
      description="O e-mail é copiado para o grupo e aparece na página dele."
      footer={
        <>
          <Button variant="outlined" className="rounded-lg" onClick={close}>
            Cancelar
          </Button>
          {semGrupos ? (
            <Button color="primary" className="rounded-lg" onClick={onCriarGrupo}>
              Criar grupo
            </Button>
          ) : (
            <Button
              color="primary"
              className="rounded-lg"
              onClick={() => onConfirm(grupoId)}
              disabled={!grupoId}
            >
              Salvar no grupo
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="dark:border-dark-500 dark:bg-dark-800 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
            {email?.assunto}
          </p>
          <p className="dark:text-dark-300 mt-1 line-clamp-2 text-xs-plus text-gray-500">
            {email ? previa(email.corpo) : ""}
          </p>
        </div>

        {semGrupos ? (
          <p className="dark:text-dark-300 text-sm text-gray-500">
            Nenhum grupo criado neste produto. Crie o primeiro para guardar
            e-mails, conversas e documentos no mesmo lugar.
          </p>
        ) : (
          <>
            <Select
              label="Grupo"
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
              data={grupos.map((g) => ({
                label: g.jaTem ? `${g.title} (já salvo)` : g.title,
                value: g.id,
                disabled: g.jaTem,
              }))}
            />
            {/* Todos os grupos já têm este e-mail: sem o aviso, o botão fica
                desabilitado e a tela parece travada. */}
            {grupos.every((g) => g.jaTem) && (
              <p className="dark:text-dark-300 text-xs-plus text-gray-500">
                Este e-mail já está em todos os grupos deste produto.
              </p>
            )}
          </>
        )}
      </div>
    </ModalShell>
  );
}

// ----------------------------------------------------------------------
// Casca comum dos dois modais (mesma moldura da tela de Notas).
// ----------------------------------------------------------------------

function ModalShell({
  show,
  close,
  icon: Icon,
  title,
  description,
  children,
  footer,
}: {
  show: boolean;
  close: () => void;
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Transition show={show}>
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
            <DialogPanel className="dark:bg-dark-750 my-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="dark:bg-primary-500/15 bg-primary-50 grid size-10 place-items-center rounded-xl">
                    <Icon className="text-primary-600 dark:text-primary-400 size-5.5" />
                  </span>
                  <div>
                    <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                      {title}
                    </DialogTitle>
                    <p className="dark:text-dark-300 text-xs-plus text-gray-500">
                      {description}
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

              <div className="mt-5">{children}</div>

              <div className="mt-6 flex justify-end gap-3">{footer}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
