// Import Dependencies
import { useEffect, useMemo, useState } from "react";
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
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckCircleIcon,
  CheckIcon,
  PlusIcon,
  Squares2X2Icon,
  ShieldCheckIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Button, Badge, ScrollShadow } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import {
  connectors,
  connectorCategories,
  categoryById,
  type Connector,
} from "@/app/data/conectores";
import { useConnectorsContext } from "@/app/contexts/connectors/context";
import {
  checkContaConectorApi,
  getOauthAuthorizeUrlApi,
  suportaTesteDeConexao,
} from "@/services/api/conectores";

// ----------------------------------------------------------------------

type StatusFilter = "all" | "connected" | "available";

const ALL = "all";

function oauthErrMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Não foi possível iniciar a autorização. Tente novamente.";
}

/** Logo do conector como monograma colorido a partir da cor da marca. */
function ConnectorLogo({
  connector,
  size = "md",
}: {
  connector: Connector;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "lg"
      ? "size-14 text-lg rounded-2xl"
      : size === "sm"
        ? "size-9 text-xs rounded-lg"
        : "size-11 text-sm rounded-xl";
  return (
    <span
      className={clsx(
        "grid shrink-0 place-items-center font-bold text-white shadow-sm",
        dims,
      )}
      style={{
        backgroundImage: `linear-gradient(140deg, ${connector.brand}, ${connector.brand}cc)`,
      }}
      aria-hidden="true"
    >
      {connector.initials}
    </span>
  );
}

// ----------------------------------------------------------------------

export default function Conectores() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Connector | null>(null);

  // Estado de conexão compartilhado (persistido) — também lido pelo modal de
  // compartilhamento do Feed.
  const {
    connectedIds: connected,
    isConnected,
    toggleConnection,
    getWorkspace,
  } = useConnectorsContext();

  // Retorno do fluxo OAuth — o callback do backend devolve
  // ?conector=<id>&status=ok|erro (+ conta / motivo).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const conectorId = params.get("conector");
    const status = params.get("status");
    if (!conectorId || !status) return;
    window.history.replaceState({}, "", window.location.pathname);
    const nome =
      connectors.find((c) => c.id === conectorId)?.name ?? conectorId;
    // Pequeno atraso: o <Toaster/> é lazy (Root) e ainda não montou no
    // primeiro render pós-redirect — toasts disparados antes se perdem.
    // Sem cleanup de propósito: o toast é global e o StrictMode desmonta
    // o efeito uma vez em dev (um clearTimeout aqui o cancelaria).
    setTimeout(() => {
      if (status === "ok") {
        const conta = params.get("conta");
        toast.success(
          conta ? `${nome} conectado — ${conta}.` : `${nome} conectado.`,
        );
      } else {
        toast.error(params.get("motivo") ?? `Falha ao conectar o ${nome}.`);
      }
    }, 600);
  }, []);

  // Conectar com OAuth (Slack, Gmail, Outlook, Google Calendar) redireciona
  // para o consentimento do provedor; os demais conectores (e qualquer
  // desconexão) só alternam o estado.
  const handleToggle = (c: Connector) => {
    if (c.oauth && !isConnected(c.id)) {
      getOauthAuthorizeUrlApi(c.id)
        .then((url) => {
          window.location.href = url;
        })
        .catch((err) => toast.error(oauthErrMessage(err)));
      return;
    }
    toggleConnection(c.id);
  };

  // Filtro combinado: busca + status. A categoria é aplicada por seção.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return connectors.filter((c) => {
      if (status === "connected" && !connected.has(c.id)) return false;
      if (status === "available" && connected.has(c.id)) return false;
      if (activeCategory !== ALL && c.category !== activeCategory) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.objective.toLowerCase().includes(q) ||
        categoryById[c.category]?.label.toLowerCase().includes(q) ||
        c.permissions.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [query, status, activeCategory, connected]);

  // Categorias que possuem resultados após os filtros (para as seções).
  const visibleCategories = useMemo(
    () =>
      connectorCategories.filter((cat) =>
        filtered.some((c) => c.category === cat.id),
      ),
    [filtered],
  );

  // Contagem por categoria (respeitando status + busca, ignorando a própria
  // seleção de categoria, para os números das pílulas não "sumirem").
  const pillCounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = connectors.filter((c) => {
      if (status === "connected" && !connected.has(c.id)) return false;
      if (status === "available" && connected.has(c.id)) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.objective.toLowerCase().includes(q) ||
        categoryById[c.category]?.label.toLowerCase().includes(q) ||
        c.permissions.some((p) => p.toLowerCase().includes(q))
      );
    });
    const counts: Record<string, number> = { [ALL]: base.length };
    for (const cat of connectorCategories) {
      counts[cat.id] = base.filter((c) => c.category === cat.id).length;
    }
    return counts;
  }, [query, status, connected]);

  // Só conta os conectores visíveis: o estado salvo (cache local ou backend)
  // pode conter integrações que já não são exibidas.
  const connectedCount = connectors.filter((c) => connected.has(c.id)).length;
  const hasResults = filtered.length > 0;

  return (
    <Page title={`Conectores · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <PageTitle
              help={{
                description: (
                  <>
                    <p>
                      <strong>Conectores</strong> ligam o GregHub às ferramentas
                      que sua empresa já usa — e-mail, agenda, mensagens e
                      outros serviços — para sincronizar dados e automatizar
                      fluxos.
                    </p>
                    <p>
                      Use a busca, o filtro por status (todas, conectadas ou
                      disponíveis) e as categorias para encontrar uma
                      integração. Abra um card para ver as permissões e ative a
                      conexão; integrações via OAuth pedem sua autorização no
                      provedor. Depois de conectar, você pode testar a conexão
                      ou desconectar a qualquer momento.
                    </p>
                  </>
                ),
              }}
            >
              Conectores
            </PageTitle>
            <p className="dark:text-dark-300 max-w-xl text-sm text-gray-500">
              Conecte o GregHub às ferramentas que sua empresa já usa. Ative uma
              integração para sincronizar dados e automatizar fluxos.
            </p>
          </div>

          {/* Resumo */}
          <div className="flex flex-wrap gap-3">
            <StatCard
              icon={Squares2X2Icon}
              value={connectors.length}
              label="Integrações"
              tint="text-primary-500"
            />
            <StatCard
              icon={BoltIcon}
              value={connectedCount}
              label="Conectadas"
              tint="text-emerald-500"
            />
            <StatCard
              icon={ShieldCheckIcon}
              value={connectorCategories.length}
              label="Categorias"
              tint="text-indigo-500"
            />
          </div>
        </div>

        {/* Barra de ferramentas fixa: busca + status + categorias */}
        {/* `top-(--header-h)`: com `top-0` a barra grudava atrás do
            `.app-header` (sticky, 65px, z-20) e busca e filtros desapareciam ao
            rolar — justamente a única navegação da tela no celular. */}
        <div className="dark:bg-dark-900 sticky top-(--header-h) z-10 -mx-(--margin-x) mt-5 bg-gray-50 px-(--margin-x) pt-2 pb-3">
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
                placeholder="Buscar por nome, objetivo ou permissão…"
                className="form-input dark:bg-dark-700 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 focus:border-primary-500 h-10 w-full rounded-lg border border-gray-300 bg-white pr-9 pl-10 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-0"
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

            {/* Filtro de status segmentado */}
            <div className="dark:bg-dark-700 inline-flex shrink-0 self-start rounded-lg bg-gray-200/70 p-1 lg:self-auto">
              {(
                [
                  { id: "all", label: "Todas" },
                  { id: "connected", label: "Conectadas" },
                  { id: "available", label: "Disponíveis" },
                ] as { id: StatusFilter; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatus(opt.id)}
                  className={clsx(
                    "text-xs-plus rounded-lg px-3.5 py-1.5 font-medium transition-colors",
                    status === opt.id
                      ? "dark:bg-dark-500 dark:text-dark-50 bg-white text-gray-800 shadow-sm"
                      : "dark:text-dark-300 dark:hover:text-dark-100 text-gray-500 hover:text-gray-700",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pílulas de categoria — rolagem horizontal suave */}
          <ScrollShadow
            orientation="horizontal"
            size={24}
            className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1"
          >
            <CategoryPill
              label="Todos"
              count={pillCounts[ALL] ?? 0}
              active={activeCategory === ALL}
              onClick={() => setActiveCategory(ALL)}
            />
            {connectorCategories.map((cat) => (
              <CategoryPill
                key={cat.id}
                label={cat.label}
                count={pillCounts[cat.id] ?? 0}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
              />
            ))}
          </ScrollShadow>
        </div>

        {/* Resultado */}
        {hasResults ? (
          <div className="mt-5 flex flex-col gap-8">
            {visibleCategories.map((cat) => {
              const items = filtered.filter((c) => c.category === cat.id);
              return (
                <section key={cat.id} className="scroll-mt-32">
                  <div className="flex items-baseline gap-2">
                    <h3 className="dark:text-dark-100 text-base font-semibold text-gray-800">
                      {cat.label}
                    </h3>
                    <span className="dark:text-dark-300 text-xs font-medium text-gray-400">
                      {items.length}
                    </span>
                  </div>
                  <p className="dark:text-dark-300 text-xs-plus mt-0.5 text-gray-400">
                    {cat.description}
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((c) => (
                      <ConnectorCard
                        key={c.id}
                        connector={c}
                        connected={isConnected(c.id)}
                        onOpen={() => setSelected(c)}
                        onToggle={() => handleToggle(c)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="dark:border-dark-600 mt-8 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
            <MagnifyingGlassIcon className="dark:text-dark-400 size-10 text-gray-300" />
            <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
              Nenhum conector encontrado
            </p>
            <p className="dark:text-dark-300 text-xs-plus mt-1 text-gray-400">
              Ajuste a busca ou os filtros para ver mais integrações.
            </p>
            <Button
              variant="outlined"
              className="mt-4 rounded-lg"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setActiveCategory(ALL);
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Drawer de detalhe */}
      <ConnectorDrawer
        connector={selected}
        connected={selected ? isConnected(selected.id) : false}
        workspace={selected ? getWorkspace(selected.id) : null}
        close={() => setSelected(null)}
        onToggle={() => selected && handleToggle(selected)}
      />
    </Page>
  );
}

// ----------------------------------------------------------------------

function StatCard({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  tint: string;
}) {
  return (
    <div className="dark:border-dark-600 dark:bg-dark-700 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
      <span
        className={clsx(
          "grid size-9 place-items-center rounded-lg bg-current/10",
          tint,
        )}
      >
        <Icon className={clsx("size-5 stroke-[1.5]", tint)} />
      </span>
      <div className="leading-tight">
        <p className="dark:text-dark-50 text-lg font-semibold text-gray-800">
          {value}
        </p>
        <p className="dark:text-dark-300 text-tiny-plus text-gray-400">
          {label}
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------

function CategoryPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "text-xs-plus inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 py-1.5 font-medium whitespace-nowrap transition-colors",
        active
          ? "border-primary-600 bg-primary-600 dark:border-primary-500 dark:bg-primary-500 text-white"
          : "dark:border-dark-500 dark:bg-dark-700 dark:text-dark-200 dark:hover:border-dark-400 border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:text-gray-800",
      )}
    >
      {label}
      <span
        className={clsx(
          "rounded-lg px-1.5 text-[10px] font-semibold tabular-nums",
          active
            ? "bg-white/20 text-white"
            : "dark:bg-dark-500 dark:text-dark-200 bg-gray-100 text-gray-500",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ----------------------------------------------------------------------

function ConnectorCard({
  connector,
  connected,
  onOpen,
  onToggle,
}: {
  connector: Connector;
  connected: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group dark:border-dark-600 dark:bg-dark-700 dark:hover:border-dark-400 flex h-full cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/60 dark:hover:shadow-none"
    >
      <div className="flex items-start justify-between gap-2">
        <ConnectorLogo connector={connector} />
        {connected ? (
          <Badge color="success" variant="soft" className="gap-1 rounded-full">
            <CheckCircleIcon className="size-3.5" />
            Conectado
          </Badge>
        ) : connector.isNew ? (
          <Badge color="info" variant="soft" className="rounded-full">
            Novo
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 grow">
        <h4 className="dark:text-dark-50 line-clamp-1 font-semibold text-gray-800">
          {connector.name}
        </h4>
        <p className="dark:text-dark-300 text-xs-plus mt-0.5 line-clamp-1 text-gray-500">
          {connector.objective}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {connector.permissions.slice(0, 2).map((p) => (
            <span
              key={p}
              className="dark:bg-dark-600 dark:text-dark-200 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500"
            >
              {p}
            </span>
          ))}
          {connector.permissions.length > 2 && (
            <span className="dark:text-dark-300 px-1 py-0.5 text-[11px] font-medium text-gray-400">
              +{connector.permissions.length - 2}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Button
          variant={connected ? "outlined" : "filled"}
          color={connected ? "neutral" : "primary"}
          className="text-xs-plus h-9 w-full gap-1.5 rounded-lg"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {connected ? (
            "Gerenciar"
          ) : (
            <>
              <PlusIcon className="size-4" />
              Conectar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------

/**
 * Confirma a autorização contra a API do provedor (o backend renova o access
 * token pelo refresh token se estiver vencido).
 */
function TestarConexao({ conectorId }: { conectorId: string }) {
  const [testando, setTestando] = useState(false);

  const testar = () => {
    setTestando(true);
    checkContaConectorApi(conectorId)
      .then((conta) => toast.success(`Conexão ativa — ${conta}.`))
      .catch((err) => toast.error(oauthErrMessage(err)))
      .finally(() => setTestando(false));
  };

  return (
    <Button
      variant="outlined"
      className="text-xs-plus mt-3 h-9 w-full rounded-lg"
      disabled={testando}
      onClick={testar}
    >
      {testando ? "Testando…" : "Testar conexão"}
    </Button>
  );
}

// ----------------------------------------------------------------------

function ConnectorDrawer({
  connector,
  connected,
  workspace,
  close,
  onToggle,
}: {
  connector: Connector | null;
  connected: boolean;
  workspace: string | null;
  close: () => void;
  onToggle: () => void;
}) {
  const category = connector ? categoryById[connector.category] : undefined;

  return (
    <Transition show={!!connector}>
      <Dialog open={true} onClose={close} static autoFocus>
        <TransitionChild
          as="div"
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="fixed inset-0 z-60 bg-gray-900/50 backdrop-blur-sm transition-opacity dark:bg-black/40"
        />

        <TransitionChild
          as={DialogPanel}
          enter="ease-out transform-gpu transition-transform duration-200"
          enterFrom="translate-x-full"
          enterTo="translate-x-0"
          leave="ease-in transform-gpu transition-transform duration-200"
          leaveFrom="translate-x-0"
          leaveTo="translate-x-full"
          className="dark:bg-dark-750 fixed inset-y-0 right-0 z-61 flex w-screen transform-gpu flex-col bg-white transition-transform duration-200 sm:inset-y-2 sm:mx-2 sm:w-[26rem] sm:rounded-xl"
        >
          {connector && (
            <>
              {/* Cabeçalho */}
              <div className="dark:border-dark-600 flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <ConnectorLogo connector={connector} size="lg" />
                  <div>
                    <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                      {connector.name}
                    </DialogTitle>
                    <p className="dark:text-dark-300 text-xs-plus text-gray-500">
                      {connector.objective}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={close}
                  variant="flat"
                  isIcon
                  className="size-8 shrink-0 rounded-lg"
                  aria-label="Fechar"
                >
                  <XMarkIcon className="size-5" />
                </Button>
              </div>

              {/* Conteúdo */}
              <ScrollShadow
                size={4}
                className="hide-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {category && (
                    <Badge variant="soft" className="rounded-full">
                      {category.label}
                    </Badge>
                  )}
                  {connected ? (
                    <Badge
                      color="success"
                      variant="soft"
                      className="gap-1 rounded-full"
                    >
                      <CheckCircleIcon className="size-3.5" />
                      Conectado
                    </Badge>
                  ) : (
                    <Badge
                      color="neutral"
                      variant="soft"
                      className="rounded-full"
                    >
                      Não conectado
                    </Badge>
                  )}
                </div>

                {connected && (
                  <div className="dark:border-dark-600 dark:bg-dark-800 mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-500/20">
                    <BoltIcon className="size-4 shrink-0 text-emerald-500" />
                    <p className="text-xs-plus text-emerald-700 dark:text-emerald-400">
                      {workspace
                        ? `${connector.category === "email" ? "Conta autorizada" : "Workspace autorizado"}: ${workspace}.`
                        : "Sincronização ativa · última atualização há poucos minutos."}
                    </p>
                  </div>
                )}

                {connected && suportaTesteDeConexao(connector.id) && (
                  <TestarConexao conectorId={connector.id} />
                )}

                <div className="mt-5">
                  <p className="dark:text-dark-200 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                    Ações e permissões
                  </p>
                  <ul className="mt-3 space-y-2">
                    {connector.permissions.map((p) => (
                      <li key={p} className="flex items-start gap-2.5">
                        <span className="dark:bg-dark-600 bg-primary-50 dark:bg-primary-500/15 mt-0.5 grid size-5 shrink-0 place-items-center rounded-lg">
                          <CheckIcon className="text-primary-600 dark:text-primary-400 size-3.5" />
                        </span>
                        <span className="dark:text-dark-100 text-sm text-gray-600">
                          {p}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollShadow>

              {/* Rodapé */}
              <div className="dark:border-dark-600 shrink-0 border-t border-gray-200 px-5 py-4">
                <Button
                  color={connected ? "error" : "primary"}
                  variant={connected ? "outlined" : "filled"}
                  className="h-10 w-full gap-1.5 rounded-lg"
                  onClick={onToggle}
                >
                  {connected ? (
                    "Desconectar"
                  ) : (
                    <>
                      <PlusIcon className="size-4.5" />
                      Conectar integração
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
