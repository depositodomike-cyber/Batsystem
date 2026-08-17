// Import Dependencies
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import {
  HashtagIcon,
  LockClosedIcon,
  UserGroupIcon,
  UserIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  CpuChipIcon,
  FolderPlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Badge, Button, Spinner } from "@/components/ui";
import { Input } from "@/components/ui/Form";
import {
  getCurrentProduct,
  getProductCodeFromPath,
} from "@/app/navigation/ceoOs";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { useConnectorsContext } from "@/app/contexts/connectors/context";
import { useAuthContext } from "@/app/contexts/auth/context";
import { usePastasMemoria } from "./usePastasMemoria";
import {
  slackMock,
  rotuloConversa,
  textoParaSalvar,
  totalRespostas,
  type SlackConversaResumo,
  type SlackMensagem,
} from "@/app/data/slack";
import {
  fetchConversasSlackApi,
  fetchMensagensSlackApi,
} from "@/services/api/slack";
import { chaveConta, lerComMigracao } from "@/utils/escopoConta";
import {
  SalvarNaMemoriaModal,
  SalvarNoGrupoModal,
  type ConteudoParaSalvar,
} from "./SalvarConteudo";
import {
  avisarFalhaAoSalvarNaMemoria,
  salvarConteudoNaMemoria,
} from "./memoria-conteudo";

// ----------------------------------------------------------------------
// Slack — leitura do workspace do conector, com as mesmas duas saídas da tela
// de E-mail: "Salvar no Repositório" (vira memória da IA) e "Salvar no Grupo"
// (guarda uma cópia dentro de um agrupamento).
//
// Cobre as três formas de conversa: canais (públicos e privados), conversas em
// grupo e DMs. Uma mensagem com respostas abre a thread num painel à direita, e
// dá para salvar tanto a mensagem sozinha quanto a thread inteira.
//
// Com o Slack autorizado em Conectores, as conversas vêm do workspace real pelo
// backend; sem conector, cai no workspace de demonstração (slackMock). Como
// cada conversa custa uma chamada ao Slack (mais uma por thread), a listagem e
// as mensagens são lidas em separado: só a conversa aberta é carregada, e o que
// já foi lido fica em cache até a próxima atualização.
//
// O que já foi mandado para o Repositório fica no localStorage, como no E-mail.
// ----------------------------------------------------------------------

const NA_MEMORIA_BASE = "ceo-slack-na-memoria";

/** Sufixo que distingue "a thread inteira" da mensagem sozinha. */
const THREAD = "#thread";

type Filtro = "todas" | "threads" | "salvas";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "threads", label: "Com thread" },
  { id: "salvas", label: "Salvas" },
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

function hora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function diaLongo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function dataCompleta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (a + b).toUpperCase();
}

/** Título curto da memória/do grupo a partir da primeira linha da mensagem. */
function tituloDe(texto: string): string {
  const primeira = texto.split("\n").find((l) => l.trim()) ?? texto;
  return primeira.trim().slice(0, 80);
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

/** O workspace de demonstração como lista de conversas (sem as mensagens). */
const conversasMock: SlackConversaResumo[] = slackMock.map((c) => {
  const { mensagens, ...resumo } = c;
  void mensagens;
  return resumo;
});

// ----------------------------------------------------------------------

export default function Slack() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const productCode = getProductCodeFromPath(pathname);

  const { projectsByProduct, addSlackToProject, openCreate } =
    useProjectsContext();
  const { isConnected, getWorkspace } = useConnectorsContext();
  const { isAuthenticated } = useAuthContext();

  // Temas = as pastas disponíveis no Repositório (regra única da aplicação).
  const { temas } = usePastasMemoria();
  const grupos = projectsByProduct(productCode);

  const usarWorkspaceReal = isAuthenticated && isConnected("slack");
  const workspace = getWorkspace("slack");

  const [naMemoria, setNaMemoria] = useState<string[]>(() =>
    readJSON<string[]>(NA_MEMORIA_BASE, []),
  );
  const [conversaId, setConversaId] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [threadId, setThreadId] = useState<string | null>(null);

  // Conversas do workspace real e mensagens já lidas, por conversa. O cache
  // evita reler o Slack a cada ida e volta entre canais; "Atualizar" o limpa.
  const [conversasReais, setConversasReais] = useState<
    SlackConversaResumo[] | null
  >(null);
  /** Conta do Slack cujas conversas estão sendo lidas. */
  const [contaSlack, setContaSlack] = useState<string | null>(null);
  const [mensagensPorConversa, setMensagensPorConversa] = useState<
    Record<string, SlackMensagem[]>
  >({});
  const [erroConversas, setErroConversas] = useState<string | null>(null);
  const [erroMensagens, setErroMensagens] = useState<{
    canalId: string;
    texto: string;
  } | null>(null);
  /** Recarga manual (botão Atualizar) — muda para disparar os efeitos de novo. */
  const [recarga, setRecarga] = useState(0);

  // O que está prestes a ser salvo — o mesmo formato serve aos dois modais.
  const [memItem, setMemItem] = useState<ConteudoParaSalvar | null>(null);
  const [grupoItem, setGrupoItem] = useState<ConteudoParaSalvar | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        chaveConta(NA_MEMORIA_BASE),
        JSON.stringify(naMemoria),
      );
    } catch {
      /* ignora indisponibilidade de storage */
    }
  }, [naMemoria]);

  // ---- Conversas do workspace ----
  useEffect(() => {
    if (!usarWorkspaceReal) return;
    let vivo = true;
    (async () => {
      try {
        const { conversas, conta } = await fetchConversasSlackApi();
        if (!vivo) return;
        setConversasReais(conversas);
        setContaSlack(conta);
        setErroConversas(null);
      } catch (err) {
        if (!vivo) return;
        setConversasReais([]);
        setErroConversas(
          mensagemErro(
            err,
            "Não foi possível ler as conversas do Slack. Tente novamente.",
          ),
        );
      }
    })();
    return () => {
      vivo = false;
    };
  }, [usarWorkspaceReal, recarga]);

  const conversas = useMemo(
    () => (usarWorkspaceReal ? (conversasReais ?? []) : conversasMock),
    [usarWorkspaceReal, conversasReais],
  );

  // A conversa aberta é derivada, não sincronizada: `conversaId` é só a
  // preferência do usuário. Assim, trocar entre workspace real e demonstração
  // (ou uma recarga que muda a lista) nunca deixa um id órfão selecionado.
  const conversa =
    conversas.find((c) => c.id === conversaId) ?? conversas[0] ?? null;
  const canalAberto = conversa?.id ?? "";

  // ---- Mensagens da conversa aberta ----
  useEffect(() => {
    if (!usarWorkspaceReal || !canalAberto) return;
    if (mensagensPorConversa[canalAberto]) return;
    let vivo = true;
    (async () => {
      try {
        const mensagens = await fetchMensagensSlackApi(canalAberto);
        if (!vivo) return;
        setMensagensPorConversa((prev) => ({
          ...prev,
          [canalAberto]: mensagens,
        }));
        setErroMensagens(null);
      } catch (err) {
        if (!vivo) return;
        setErroMensagens({
          canalId: canalAberto,
          texto: mensagemErro(
            err,
            "Não foi possível ler esta conversa. Tente novamente.",
          ),
        });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [usarWorkspaceReal, canalAberto, mensagensPorConversa]);

  const carregar = useCallback(() => {
    setConversasReais(null);
    setMensagensPorConversa({});
    setErroConversas(null);
    setErroMensagens(null);
    setThreadId(null);
    setRecarga((n) => n + 1);
  }, []);

  // As mensagens da conversa aberta: `null` enquanto a leitura está em voo.
  const mensagensDaConversa = useMemo<SlackMensagem[] | null>(() => {
    if (!canalAberto) return [];
    if (!usarWorkspaceReal)
      return slackMock.find((c) => c.id === canalAberto)?.mensagens ?? [];
    if (erroMensagens?.canalId === canalAberto) return [];
    return mensagensPorConversa[canalAberto] ?? null;
  }, [usarWorkspaceReal, canalAberto, mensagensPorConversa, erroMensagens]);

  const carregandoConversas = usarWorkspaceReal && conversasReais === null;
  const carregandoMensagens =
    usarWorkspaceReal && !!canalAberto && mensagensDaConversa === null;
  const erroDaConversa =
    erroMensagens?.canalId === canalAberto ? erroMensagens.texto : null;

  const semConversas =
    usarWorkspaceReal &&
    !carregandoConversas &&
    !erroConversas &&
    conversasReais !== null &&
    conversas.length === 0;

  // Ids do Slack já salvos em algum grupo — para o selo na mensagem.
  const gruposPorItem = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const g of grupos) {
      for (const s of g.slack) (map[s.id] ??= []).push(g.title);
    }
    return map;
  }, [grupos]);

  const mensagens = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (mensagensDaConversa ?? []).filter((m) => {
      if (filtro === "threads" && totalRespostas(m) === 0) return false;
      if (
        filtro === "salvas" &&
        !naMemoria.includes(m.id) &&
        !naMemoria.includes(m.id + THREAD) &&
        !gruposPorItem[m.id] &&
        !gruposPorItem[m.id + THREAD]
      )
        return false;
      if (!termo) return true;
      return (
        m.texto.toLowerCase().includes(termo) ||
        m.autor.toLowerCase().includes(termo) ||
        (m.respostas ?? []).some(
          (r) =>
            r.texto.toLowerCase().includes(termo) ||
            r.autor.toLowerCase().includes(termo),
        )
      );
    });
  }, [mensagensDaConversa, busca, filtro, naMemoria, gruposPorItem]);

  const thread =
    (mensagensDaConversa ?? []).find((m) => m.id === threadId) ?? null;

  // Trocar de conversa fecha a thread aberta (ela pertence à conversa anterior).
  const abrirConversa = (id: string) => {
    setConversaId(id);
    setThreadId(null);
  };

  /** Monta o pacote salvo a partir de uma mensagem — com ou sem as respostas. */
  const pacote = (
    m: SlackMensagem,
    comThread: boolean,
  ): ConteudoParaSalvar | null => {
    if (!conversa) return null;
    const rotulo = rotuloConversa(conversa);
    return {
      id: comThread ? m.id + THREAD : m.id,
      titulo: comThread
        ? `Thread · ${tituloDe(m.texto)}`
        : tituloDe(m.texto),
      conteudo: textoParaSalvar(conversa, m, comThread),
      origem: `Slack · ${rotulo}`,
      contexto: `${rotulo} · ${m.autor} · ${dataCompleta(m.data)}${
        comThread ? ` · ${totalRespostas(m)} respostas` : ""
      }`,
    };
  };

  // ---- Salvar no Repositório ----
  // Vira um .md na pasta (tema) escolhida — mesma mecânica da tela de E-mail:
  // Memória é a pasta de notas, não o store de Regras.
  const gravarNaMemoria = async (
    tema: string,
    titulo: string,
    conteudo: string,
  ) => {
    const item = memItem;
    if (!item) return;
    const r = await salvarConteudoNaMemoria({
      pasta: tema,
      titulo,
      conteudo,
      origem: item.origem,
      tags: ["slack"],
    });
    if (!r.ok) {
      avisarFalhaAoSalvarNaMemoria(r.reason);
      return;
    }
    setNaMemoria((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    setMemItem(null);
    toast.success("Salvo no Repositório.", {
      description: `${r.pasta}/${r.arquivo} — recarregue o grafo para ver o nó.`,
    });
  };

  // ---- Salvar no Grupo ----
  const gravarNoGrupo = (projectId: string) => {
    const item = grupoItem;
    if (!item || !conversa) return;
    const grupo = grupos.find((g) => g.id === projectId);
    if (grupo?.slack.some((s) => s.id === item.id)) {
      setGrupoItem(null);
      toast("Esta conversa já está no grupo.", { description: grupo.title });
      return;
    }
    const base = item.id.replace(THREAD, "");
    const m = (mensagensDaConversa ?? []).find((x) => x.id === base);
    addSlackToProject(projectId, {
      id: item.id,
      origem: rotuloConversa(conversa),
      tipo: item.id.endsWith(THREAD) ? "thread" : "mensagem",
      autor: m?.autor ?? "",
      data: m?.data ?? new Date().toISOString(),
      texto: item.conteudo,
    });
    setGrupoItem(null);
    toast.success("Salvo no grupo.", {
      description: `${grupo?.title ?? "Grupo"} · aparece na página do grupo.`,
    });
  };

  const salvarMensagem = (m: SlackMensagem, comThread: boolean) => {
    const p = pacote(m, comThread);
    if (p) setMemItem(p);
  };
  const salvarMensagemNoGrupo = (m: SlackMensagem, comThread: boolean) => {
    const p = pacote(m, comThread);
    if (p) setGrupoItem(p);
  };

  return (
    <Page title={`Slack · ${product.name}`}>
      <div className="transition-content flex min-h-0 w-full flex-col px-(--margin-x) py-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <span className="bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 grid size-11 place-items-center rounded-xl">
            <HashtagIcon className="size-6 stroke-[1.5]" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <PageTitle
              help={{
                description: (
                  <>
                    <p>
                      <strong>Slack</strong> mostra as conversas do seu workspace — canais, conversas em grupo e mensagens diretas. Conecte o Slack em Conectores para ler o workspace real; sem conector, você vê um workspace de demonstração. Mensagens com respostas abrem a thread em um painel à direita.
                    </p>
                    <p>
                      De cada mensagem, ou da thread inteira, você pode <strong>Salvar no Repositório</strong> — o conteúdo vira um contexto da IA e aparece no grafo — ou <strong>Salvar no Grupo</strong>, guardando uma cópia dentro de um agrupamento.
                    </p>
                  </>
                ),
              }}
            >
              Slack
            </PageTitle>
            <p className="dark:text-dark-300 truncate text-sm text-gray-400">
              {usarWorkspaceReal
                ? `Workspace conectado${workspace ? ` · ${workspace}` : ""}${
                    contaSlack ? ` · lendo como ${contaSlack}` : ""
                  }`
                : "Leia canais, conversas em grupo e DMs — e guarde o que importa no Repositório ou num grupo."}
            </p>
          </div>
          {usarWorkspaceReal && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                variant="outlined"
                onClick={carregar}
                disabled={carregandoConversas}
                className="h-8 gap-1.5 px-2.5 text-xs-plus"
              >
                {carregandoConversas ? (
                  <Spinner className="size-4" />
                ) : (
                  <ArrowPathIcon className="size-4" />
                )}
                {carregandoConversas ? "Atualizando…" : "Atualizar"}
              </Button>
            </div>
          )}
        </div>

        {/* Falha ao falar com o Slack — nunca cai para dados de exemplo. */}
        {(erroConversas || erroDaConversa) && (
          <div className="dark:border-warning/30 dark:bg-warning/10 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="dark:text-dark-100 text-sm text-gray-700">
                {erroConversas ?? erroDaConversa}
              </p>
              <Button
                variant="outlined"
                onClick={carregar}
                disabled={carregandoConversas}
                className="mt-2 h-7 gap-1.5 px-2.5 text-tiny"
              >
                <ArrowPathIcon className="size-3.5" />
                Tentar de novo
              </Button>
            </div>
          </div>
        )}

        {/* Sem conector: o workspace exibido é o de demonstração. */}
        {!usarWorkspaceReal && (
          <p className="dark:border-dark-600 dark:bg-dark-700 dark:text-dark-300 mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs-plus text-gray-500">
            Este é um workspace de demonstração. Conecte o Slack em{" "}
            <span className="dark:text-dark-100 font-medium text-gray-700">
              Conectores
            </span>{" "}
            para ler as suas conversas aqui.
          </p>
        )}

        {/* A leitura é em nome de quem autorizou: aqui aparece o que essa
            pessoa vê no Slack. Nada na lista é raro — vale dizer o porquê. */}
        {semConversas && (
          <p className="dark:border-dark-600 dark:bg-dark-700 dark:text-dark-300 mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs-plus text-gray-500">
            Nenhuma conversa disponível. A leitura é feita em nome da conta que
            autorizou o Slack
            {contaSlack ? ` (${contaSlack})` : ""} — só aparecem aqui os canais
            em que ela está, as conversas em grupo e as mensagens diretas dela.
          </p>
        )}

        {/* Busca + filtros */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nesta conversa…"
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
                  "rounded-lg px-3 py-1.5 text-xs-plus font-medium transition-colors",
                  filtro === f.id
                    ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                    : "dark:text-dark-300 dark:hover:bg-dark-600 text-gray-500 hover:bg-gray-100",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Corpo: conversas + mensagens (+ thread quando aberta) */}
        <div
          className={clsx(
            "mt-5 grid grid-cols-1 gap-5",
            thread
              ? "lg:grid-cols-[240px_1fr_340px]"
              : "lg:grid-cols-[240px_1fr]",
          )}
        >
          <ListaConversas
            conversas={conversas}
            ativa={conversa?.id ?? ""}
            carregando={carregandoConversas}
            onSelecionar={abrirConversa}
          />

          {/* Mensagens */}
          <section className="dark:border-dark-600 dark:bg-dark-700 flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white">
            {!conversa ? (
              <div className="grid grow place-items-center px-6 py-16">
                {carregandoConversas ? (
                  <div className="flex items-center gap-2">
                    <Spinner className="size-4" />
                    <p className="dark:text-dark-300 text-sm text-gray-400">
                      Lendo o workspace…
                    </p>
                  </div>
                ) : (
                  <p className="dark:text-dark-300 text-sm text-gray-400">
                    Nenhuma conversa.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="dark:border-dark-600 border-b border-gray-200 px-5 py-3.5">
                  <h3 className="dark:text-dark-50 flex items-center gap-1.5 text-base font-semibold text-gray-800">
                    <IconeConversa conversa={conversa} className="size-4.5" />
                    {rotuloConversa(conversa)}
                  </h3>
                  <p className="dark:text-dark-300 mt-0.5 text-xs-plus text-gray-500">
                    {conversa.topico ??
                      (conversa.tipo === "dm"
                        ? conversa.online
                          ? "Disponível"
                          : "Ausente"
                        : "Conversa em grupo")}
                    {conversa.membros ? ` · ${conversa.membros} membros` : ""}
                  </p>
                </div>

                <div className="max-h-[calc(100vh-360px)] overflow-y-auto px-5 py-4">
                  {carregandoMensagens ? (
                    <div className="flex items-center justify-center gap-2 py-8">
                      <Spinner className="size-4" />
                      <p className="dark:text-dark-400 text-sm text-gray-400">
                        Lendo as mensagens…
                      </p>
                    </div>
                  ) : mensagens.length === 0 ? (
                    <p className="dark:text-dark-400 py-8 text-center text-sm text-gray-400">
                      {(mensagensDaConversa?.length ?? 0) === 0
                        ? erroDaConversa
                          ? "Não foi possível carregar esta conversa."
                          : "Nenhuma mensagem nesta conversa."
                        : "Nenhuma mensagem com esses filtros."}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {mensagens.map((m, i) => {
                        const anterior = mensagens[i - 1];
                        const novoDia =
                          !anterior ||
                          new Date(anterior.data).toDateString() !==
                            new Date(m.data).toDateString();
                        return (
                          <li key={m.id}>
                            {novoDia && (
                              <div className="dark:border-dark-600 my-3 flex items-center gap-3 border-t border-gray-200 pt-3 first:mt-0 first:border-0 first:pt-0">
                                <span className="dark:border-dark-500 dark:text-dark-300 rounded-full border border-gray-200 px-2.5 py-0.5 text-tiny text-gray-500">
                                  {diaLongo(m.data)}
                                </span>
                              </div>
                            )}
                            <Mensagem
                              mensagem={m}
                              naMemoria={naMemoria}
                              emGrupo={gruposPorItem}
                              threadAberta={threadId === m.id}
                              onAbrirThread={() =>
                                setThreadId(threadId === m.id ? null : m.id)
                              }
                              onSalvarMemoria={() => salvarMensagem(m, false)}
                              onSalvarGrupo={() =>
                                salvarMensagemNoGrupo(m, false)
                              }
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Thread */}
          {thread && conversa && (
            <aside className="dark:border-dark-600 dark:bg-dark-700 flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white">
              <div className="dark:border-dark-600 flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="dark:text-dark-50 text-sm font-semibold text-gray-800">
                    Thread
                  </h3>
                  <p className="dark:text-dark-300 truncate text-tiny text-gray-500">
                    {rotuloConversa(conversa)} · {totalRespostas(thread)}{" "}
                    {totalRespostas(thread) === 1 ? "resposta" : "respostas"}
                  </p>
                </div>
                <Button
                  variant="flat"
                  isIcon
                  onClick={() => setThreadId(null)}
                  className="size-8 shrink-0 rounded-lg"
                  aria-label="Fechar thread"
                >
                  <XMarkIcon className="size-5" />
                </Button>
              </div>

              <div className="max-h-[calc(100vh-430px)] flex-1 overflow-y-auto px-4 py-3">
                <Mensagem mensagem={thread} compacta />
                <div className="dark:border-dark-600 mt-3 space-y-3 border-t border-gray-200 pt-3">
                  {(thread.respostas ?? []).map((r) => (
                    <div key={r.id} className="flex items-start gap-2.5">
                      <Avatar nome={r.autor} className="size-7 text-tiny" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline gap-2">
                          <span className="dark:text-dark-100 truncate text-xs-plus font-semibold text-gray-800">
                            {r.autor}
                          </span>
                          <span className="dark:text-dark-400 shrink-0 text-tiny text-gray-400">
                            {hora(r.data)}
                          </span>
                        </p>
                        <p className="dark:text-dark-200 mt-0.5 text-xs-plus whitespace-pre-line text-gray-600">
                          {r.texto}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dark:border-dark-600 flex flex-wrap gap-2 border-t border-gray-200 px-4 py-3">
                <Button
                  color="primary"
                  onClick={() => salvarMensagem(thread, true)}
                  className="h-8 flex-1 gap-1.5 px-2.5 text-xs-plus"
                >
                  <CpuChipIcon className="size-4" />
                  Thread no Repositório
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => salvarMensagemNoGrupo(thread, true)}
                  className="h-8 flex-1 gap-1.5 px-2.5 text-xs-plus"
                >
                  <FolderPlusIcon className="size-4" />
                  Thread no Grupo
                </Button>
              </div>
            </aside>
          )}
        </div>
      </div>

      <SalvarNaMemoriaModal
        item={memItem}
        temas={temas}
        close={() => setMemItem(null)}
        onConfirm={gravarNaMemoria}
      />

      <SalvarNoGrupoModal
        item={grupoItem}
        grupos={grupos.map((g) => ({
          id: g.id,
          title: g.title,
          jaTem: g.slack.some((s) => s.id === grupoItem?.id),
        }))}
        close={() => setGrupoItem(null)}
        onConfirm={gravarNoGrupo}
        onCriarGrupo={() => {
          setGrupoItem(null);
          openCreate();
        }}
      />
    </Page>
  );
}

// ----------------------------------------------------------------------
// Coluna das conversas — canais, conversas em grupo e DMs em seções separadas,
// como no próprio Slack.
// ----------------------------------------------------------------------

const SECOES: { tipo: SlackConversaResumo["tipo"]; titulo: string }[] = [
  { tipo: "canal", titulo: "Canais" },
  { tipo: "grupo", titulo: "Conversas em grupo" },
  { tipo: "dm", titulo: "Mensagens diretas" },
];

function ListaConversas({
  conversas,
  ativa,
  carregando,
  onSelecionar,
}: {
  conversas: SlackConversaResumo[];
  ativa: string;
  carregando?: boolean;
  onSelecionar: (id: string) => void;
}) {
  return (
    <aside className="dark:border-dark-600 dark:bg-dark-700 flex max-h-64 flex-col gap-3 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 lg:max-h-[calc(100vh-300px)]">
      {carregando && conversas.length === 0 && (
        <div className="flex items-center gap-2 px-1 py-3">
          <Spinner className="size-4" />
          <p className="dark:text-dark-400 text-xs-plus text-gray-400">
            Carregando…
          </p>
        </div>
      )}
      {SECOES.map(({ tipo, titulo }) => {
        const doTipo = conversas.filter((c) => c.tipo === tipo);
        if (doTipo.length === 0) return null;
        return (
          <div key={tipo}>
            <p className="dark:text-dark-200 mb-1 px-1 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase">
              {titulo}
            </p>
            <ul className="flex flex-col gap-0.5">
              {doTipo.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelecionar(c.id)}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                      ativa === c.id
                        ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                        : "dark:text-dark-200 dark:hover:bg-dark-600 text-gray-700 hover:bg-gray-100",
                    )}
                  >
                    <IconeConversa conversa={c} className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                    {c.tipo === "dm" && c.online && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-emerald-500"
                        aria-label="Disponível"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </aside>
  );
}

function IconeConversa({
  conversa,
  className,
}: {
  conversa: SlackConversaResumo;
  className?: string;
}) {
  if (conversa.tipo === "canal")
    return conversa.privado ? (
      <LockClosedIcon className={className} />
    ) : (
      <HashtagIcon className={className} />
    );
  if (conversa.tipo === "grupo") return <UserGroupIcon className={className} />;
  return <UserIcon className={className} />;
}

// ----------------------------------------------------------------------
// Uma mensagem do canal. As ações de salvar aparecem no hover (e sempre no
// toque, já que `group-hover` não dispara em tela sensível — por isso ficam
// visíveis por padrão abaixo de lg).
// ----------------------------------------------------------------------

function Mensagem({
  mensagem,
  naMemoria = [],
  emGrupo = {},
  threadAberta,
  compacta,
  onAbrirThread,
  onSalvarMemoria,
  onSalvarGrupo,
}: {
  mensagem: SlackMensagem;
  naMemoria?: string[];
  emGrupo?: Record<string, string[]>;
  threadAberta?: boolean;
  /** Versão sem ações, usada no topo do painel de thread. */
  compacta?: boolean;
  onAbrirThread?: () => void;
  onSalvarMemoria?: () => void;
  onSalvarGrupo?: () => void;
}) {
  const respostas = totalRespostas(mensagem);
  const salvaNaMemoria =
    naMemoria.includes(mensagem.id) || naMemoria.includes(`${mensagem.id}#thread`);
  const grupos =
    emGrupo[mensagem.id] ?? emGrupo[`${mensagem.id}#thread`] ?? null;

  return (
    <div
      className={clsx(
        "group/msg relative flex items-start gap-2.5 rounded-lg px-2 py-2",
        !compacta && "dark:hover:bg-dark-600/50 hover:bg-gray-50",
      )}
    >
      <Avatar nome={mensagem.autor} className="size-8 text-tiny" />

      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="dark:text-dark-100 truncate text-sm font-semibold text-gray-800">
            {mensagem.autor}
          </span>
          <span className="dark:text-dark-400 shrink-0 text-tiny text-gray-400">
            {hora(mensagem.data)}
          </span>
        </p>

        <p className="dark:text-dark-200 mt-0.5 text-sm leading-relaxed whitespace-pre-line text-gray-600">
          {mensagem.texto}
        </p>

        {/* Reações */}
        {(mensagem.reacoes?.length ?? 0) > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {mensagem.reacoes!.map((r) => (
              <span
                key={r.emoji}
                className="dark:border-dark-500 dark:bg-dark-800 dark:text-dark-200 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-tiny text-gray-600"
              >
                <span aria-hidden="true">{r.emoji}</span>
                {r.total}
              </span>
            ))}
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {respostas > 0 && !compacta && (
            <button
              type="button"
              onClick={onAbrirThread}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-tiny font-medium transition-colors",
                threadAberta
                  ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                  : "text-primary-600 dark:text-primary-400 hover:bg-primary-600/10 dark:hover:bg-primary-400/10",
              )}
            >
              <ChatBubbleLeftRightIcon className="size-3.5" />
              {respostas} {respostas === 1 ? "resposta" : "respostas"}
            </button>
          )}
          {salvaNaMemoria && (
            <Badge color="primary" variant="soft" className="text-tiny">
              Na memória
            </Badge>
          )}
          {grupos && (
            <Badge
              color="info"
              variant="soft"
              className="max-w-[9rem] truncate text-tiny"
            >
              {grupos.length > 1 ? `${grupos.length} grupos` : grupos[0]}
            </Badge>
          )}
        </div>
      </div>

      {/* Ações da mensagem */}
      {!compacta && (
        <div className="dark:border-dark-500 dark:bg-dark-700 absolute end-2 top-1 flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 opacity-100 shadow-sm transition-opacity lg:opacity-0 lg:group-hover/msg:opacity-100">
          <button
            type="button"
            onClick={onSalvarMemoria}
            title="Salvar no Repositório"
            aria-label={`Salvar a mensagem de ${mensagem.autor} no Repositório`}
            className="dark:text-dark-300 dark:hover:bg-dark-600 dark:hover:text-dark-50 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <CpuChipIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={onSalvarGrupo}
            title="Salvar no Grupo"
            aria-label={`Salvar a mensagem de ${mensagem.autor} num grupo`}
            className="dark:text-dark-300 dark:hover:bg-dark-600 dark:hover:text-dark-50 rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <FolderPlusIcon className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ nome, className }: { nome: string; className?: string }) {
  return (
    <span
      className={clsx(
        "dark:bg-dark-500 dark:text-dark-100 grid shrink-0 place-items-center rounded-lg bg-gray-100 font-semibold text-gray-600",
        className,
      )}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}
