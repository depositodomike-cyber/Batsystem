// Import Dependencies
import { useMemo, useState, type ChangeEvent } from "react";
import { useLocation } from "react-router";
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
  PlusIcon,
  SparklesIcon,
  BoltIcon,
  CircleStackIcon,
  CpuChipIcon,
  TrashIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { Button, Badge, ScrollShadow, Spinner } from "@/components/ui";
import { Input, Switch, Textarea } from "@/components/ui/Form";
import { MemoriaTextarea } from "@/components/shared/MemoriaMentions";
import { PageTitle } from "@/components/shared/PageTitle";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import {
  CONFIDENCE_LABEL,
  type MemoryItem,
  type MemoryConfidence,
} from "@/app/data/memoria";
import { useMemoryContext } from "@/app/contexts/memory/context";
import { useAuthContext } from "@/app/contexts/auth/context";

// ----------------------------------------------------------------------

type StatusFilter = "all" | "active" | "inactive";

const confidenceColor: Record<MemoryConfidence, "success" | "warning" | "neutral"> = {
  alta: "success",
  media: "warning",
  baixa: "neutral",
};

/** Estimativa de tokens de uma memória (~4 caracteres por token). */
function memoryTokens(m: { title: string; content: string }): number {
  return Math.ceil((m.title.length + m.content.length) / 4);
}

// ----------------------------------------------------------------------

export default function Memoria() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);

  const {
    memories,
    loading,
    addMemory,
    updateMemory,
    deleteMemory,
    toggleActive,
  } = useMemoryContext();

  // Só admin/owner pode "fixar" diretrizes (criar como definição corporativa).
  const { user } = useAuthContext();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [creating, setCreating] = useState(false);
  // Guarda só o id; a memória exibida no drawer é derivada do estado vivo,
  // para refletir na hora os toggles de ativa/fixada.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId
    ? (memories.find((m) => m.id === selectedId) ?? null)
    : null;

  // Filtro combinado: busca + status.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      if (status === "active" && !m.active) return false;
      if (status === "inactive" && m.active) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        m.source.toLowerCase().includes(q)
      );
    });
  }, [memories, query, status]);

  const activeCount = memories.filter((m) => m.active).length;
  const hasResults = filtered.length > 0;

  // Estimativa de tokens que as memórias ATIVAS adicionam ao contexto da IA.
  // Heurística simples e estável: ~4 caracteres por token (título + conteúdo).
  const estimatedTokens = useMemo(
    () =>
      memories
        .filter((m) => m.active)
        .reduce((sum, m) => sum + memoryTokens(m), 0),
    [memories],
  );

  return (
    <Page title={`Diretrizes · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <PageTitle help={{ description: (<>
              <p>As <strong>Diretrizes</strong> são as regras que a IA deve seguir em toda resposta — o que ela aprendeu nas conversas, conectores e squads, reunido em um só lugar sob o seu controle.</p>
              <p>Cada diretriz pode ser ativada ou desativada; só as ativas entram no contexto da IA. Use a busca e os filtros para gerenciar, ou crie uma nova. Administradores podem fixar diretrizes como definição corporativa.</p>
            </>) }}>Diretrizes</PageTitle>
            <p className="dark:text-dark-300 text-sm whitespace-nowrap text-gray-500">
              Tudo o que a IA aprendeu nas conversas, conectores e squads — em um
              só lugar, sob o seu controle.
            </p>
          </div>

          {/* Resumo */}
          <div className="flex flex-wrap gap-3">
            <StatCard
              icon={CircleStackIcon}
              value={memories.length}
              label="Diretrizes"
              tint="text-primary-500"
            />
            <StatCard
              icon={BoltIcon}
              value={activeCount}
              label="Ativas"
              tint="text-emerald-500"
            />
            <StatCard
              icon={CpuChipIcon}
              value={`~${estimatedTokens.toLocaleString("pt-BR")}`}
              label="Tokens (est.)"
              tint="text-indigo-500"
              hint="Estimativa do total de tokens que as diretrizes ativas adicionam ao contexto da IA (~4 caracteres por token)."
            />
          </div>
        </div>

        {/* Barra de ferramentas fixa: busca + status + categorias + ação */}
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
                placeholder="Buscar nas diretrizes…"
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

            <div className="flex items-center gap-3">
              {/* Filtro de status segmentado */}
              <div className="dark:bg-dark-700 inline-flex shrink-0 self-start rounded-full bg-gray-200/70 p-1 lg:self-auto">
                {(
                  [
                    { id: "all", label: "Todas" },
                    { id: "active", label: "Ativas" },
                    { id: "inactive", label: "Inativas" },
                  ] as { id: StatusFilter; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatus(opt.id)}
                    className={clsx(
                      "rounded-full px-3.5 py-1.5 text-xs-plus font-medium transition-colors",
                      status === opt.id
                        ? "dark:bg-dark-500 dark:text-dark-50 bg-white text-gray-800 shadow-sm"
                        : "dark:text-dark-300 dark:hover:text-dark-100 text-gray-500 hover:text-gray-700",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <Button
                color="primary"
                className="h-10 shrink-0 gap-1.5 rounded-full"
                onClick={() => setCreating(true)}
              >
                <PlusIcon className="size-4.5" />
                <span className="max-sm:sr-only">Nova diretriz</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Resultado */}
        {loading ? (
          <div className="dark:text-dark-300 mt-8 flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
            <Spinner className="size-5" />
            Carregando diretrizes…
          </div>
        ) : hasResults ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                canManage={isAdmin}
                onOpen={() => setSelectedId(m.id)}
                onToggleActive={() => toggleActive(m.id)}
              />
            ))}
          </div>
        ) : (
          <div className="dark:border-dark-600 mt-8 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
            <CircleStackIcon className="dark:text-dark-400 size-10 text-gray-300" />
            <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
              Nenhuma diretriz encontrada
            </p>
            <p className="dark:text-dark-300 mt-1 text-xs-plus text-gray-400">
              Ajuste a busca/filtros ou registre uma nova diretriz para a IA.
            </p>
            <Button
              color="primary"
              className="mt-4 gap-1.5 rounded-full"
              onClick={() => setCreating(true)}
            >
              <PlusIcon className="size-4.5" />
              Nova diretriz
            </Button>
          </div>
        )}
      </div>

      {/* Modal de criação */}
      <NewMemoryModal
        open={creating}
        canFix={isAdmin}
        close={() => setCreating(false)}
        onCreate={async (input) => {
          // Só fecha o modal se salvar de fato; em erro o provider já avisa e o
          // modal continua aberto com os dados preenchidos para tentar de novo.
          try {
            await addMemory(input);
            setCreating(false);
          } catch {
            /* erro já sinalizado por toast no provider */
          }
        }}
      />

      {/* Drawer de detalhe / edição */}
      <MemoryDrawer
        memory={selected}
        canManage={isAdmin}
        close={() => setSelectedId(null)}
        onSave={(patch) => {
          if (selected) updateMemory(selected.id, patch);
          setSelectedId(null);
        }}
        onDelete={() => {
          if (selected) deleteMemory(selected.id);
          setSelectedId(null);
        }}
        onToggleActive={() => selected && toggleActive(selected.id)}
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
  hint,
}: {
  icon: React.ElementType;
  value: number | string;
  label: string;
  tint: string;
  /** Tooltip opcional (ex.: explicar uma estimativa). */
  hint?: string;
}) {
  return (
    <div
      title={hint}
      className="dark:border-dark-600 dark:bg-dark-700 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5"
    >
      <span className={clsx("grid size-9 place-items-center rounded-lg bg-current/10", tint)}>
        <Icon className={clsx("size-5 stroke-[1.5]", tint)} />
      </span>
      <div className="leading-tight">
        <p className="dark:text-dark-50 text-lg font-semibold text-gray-800">{value}</p>
        <p className="dark:text-dark-300 text-tiny-plus text-gray-400">{label}</p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------

function MemoryCard({
  memory,
  canManage,
  onOpen,
  onToggleActive,
}: {
  memory: MemoryItem;
  /** Admin/owner pode gerenciar (ativar/desativar) mesmo memória corporativa. */
  canManage: boolean;
  onOpen: () => void;
  onToggleActive: () => void;
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
      className={clsx(
        "group dark:border-dark-600 dark:bg-dark-700 dark:hover:border-dark-400 flex h-full cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-200/60 dark:hover:shadow-none",
        !memory.active && "opacity-60",
      )}
    >
      {/* Conteúdo */}
      <div className="grow">
        <h4 className="dark:text-dark-50 line-clamp-2 font-semibold text-gray-800">
          {memory.title}
        </h4>
        <p className="dark:text-dark-300 mt-1 line-clamp-2 text-xs-plus text-gray-500">
          {memory.content}
        </p>
      </div>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge
          color={confidenceColor[memory.confidence]}
          variant="soft"
          className="rounded-full text-[11px]"
        >
          {CONFIDENCE_LABEL[memory.confidence]}
        </Badge>
        <span className="dark:bg-dark-600 dark:text-dark-200 truncate rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          {memory.source}
        </span>
        <span
          title="Tokens estimados desta diretriz (~4 caracteres por token)."
          className="dark:bg-dark-600 dark:text-dark-200 inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500"
        >
          <CpuChipIcon className="size-3" />~
          {memoryTokens(memory).toLocaleString("pt-BR")} tokens
        </span>
      </div>

      {/* Rodapé: data + (switch ativo | selo corporativa) */}
      <div className="dark:border-dark-600 mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="dark:text-dark-300 text-[11px] text-gray-400">{memory.date}</span>
        {memory.corporate && !canManage ? (
          <span
            title="Definição corporativa — só um administrador pode desativá-la ou alterá-la."
            className="dark:text-dark-300 inline-flex items-center gap-1 text-[11px] font-medium text-gray-400"
          >
            <LockClosedIcon className="size-3.5" />
            Corporativa
          </span>
        ) : (
          <Switch
            checked={memory.active}
            onChange={onToggleActive}
            onClick={(e) => e.stopPropagation()}
            color="success"
            label={memory.active ? "Ativa" : "Inativa"}
            classNames={{
              label: "flex-row-reverse gap-2",
              labelText: "dark:text-dark-300 text-[11px] font-medium text-gray-400",
            }}
          />
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------

function NewMemoryModal({
  open,
  canFix,
  close,
  onCreate,
}: {
  open: boolean;
  /** Se o usuário (admin/owner) pode "fixar" a diretriz como corporativa. */
  canFix: boolean;
  close: () => void;
  onCreate: (input: {
    title: string;
    content: string;
    source?: string;
    confidence?: MemoryConfidence;
    corporate?: boolean;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [corporate, setCorporate] = useState(false);

  const canSave = title.trim().length > 0 && content.trim().length > 0;

  const reset = () => {
    setTitle("");
    setContent("");
    setSource("");
    setCorporate(false);
  };

  return (
    <Transition show={open} afterLeave={reset}>
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
            <DialogPanel className="dark:bg-dark-750 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="dark:bg-primary-500/15 grid size-10 place-items-center rounded-xl bg-primary-50">
                    <SparklesIcon className="size-5.5 text-primary-600 dark:text-primary-400" />
                  </span>
                  <div>
                    <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                      Nova diretriz
                    </DialogTitle>
                    <p className="dark:text-dark-300 text-xs-plus text-gray-500">
                      Defina uma regra que a IA deve seguir em toda resposta.
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
                <Input
                  label="Resumo"
                  value={title}
                  maxLength={160}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Responder sempre em português do Brasil"
                />
                <Textarea
                  component={MemoriaTextarea}
                  label="O que a IA deve seguir"
                  rows={3}
                  value={content}
                  maxLength={2000}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setContent(e.target.value)
                  }
                  placeholder="Descreva a regra… (“[[” conecta a uma nota da Memória)"
                />
                <Input
                  label="Origem (opcional)"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Ex.: Manual, Chat · Onboarding…"
                />

                {/* Fixar como corporativa — só admin/owner */}
                {canFix && (
                  <button
                    type="button"
                    onClick={() => setCorporate((v) => !v)}
                    className={clsx(
                      "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                      corporate
                        ? "border-primary-500 bg-primary-50 dark:border-primary-500/60 dark:bg-primary-500/10"
                        : "dark:border-dark-500 dark:bg-dark-700 border-gray-300 bg-white hover:border-gray-400",
                    )}
                  >
                    <LockClosedIcon
                      className={clsx(
                        "mt-0.5 size-5 shrink-0",
                        corporate
                          ? "text-primary-600 dark:text-primary-400"
                          : "dark:text-dark-300 text-gray-400",
                      )}
                    />
                    <div className="grow">
                      <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
                        Fixar como definição corporativa
                      </p>
                      <p className="dark:text-dark-300 text-xs-plus text-gray-400">
                        Read-only para todos: não pode ser desativada, alterada
                        ou removida.
                      </p>
                    </div>
                    <Switch
                      checked={corporate}
                      onChange={() => setCorporate((v) => !v)}
                      onClick={(e) => e.stopPropagation()}
                      color="primary"
                      tabIndex={-1}
                    />
                  </button>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outlined" className="rounded-lg" onClick={close}>
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  className="gap-1.5 rounded-lg"
                  disabled={!canSave}
                  onClick={() =>
                    onCreate({
                      title,
                      content,
                      source: source || undefined,
                      corporate: canFix ? corporate : undefined,
                    })
                  }
                >
                  <PlusIcon className="size-4.5" />
                  Salvar diretriz
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

// ----------------------------------------------------------------------

function MemoryDrawer({
  memory,
  canManage,
  close,
  onSave,
  onDelete,
  onToggleActive,
}: {
  memory: MemoryItem | null;
  /** Admin/owner pode gerenciar (ativar/desativar/excluir) mesmo diretriz corporativa. */
  canManage: boolean;
  close: () => void;
  onSave: (patch: Partial<MemoryItem>) => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  return (
    <Transition show={!!memory}>
      <Dialog open={true} onClose={close} static autoFocus>
        <TransitionChild
          as="div"
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          className="dark:bg-black/40 fixed inset-0 z-60 bg-gray-900/50 backdrop-blur-sm transition-opacity"
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
          {memory && (
            <>
              {/* Cabeçalho */}
              <div className="dark:border-dark-600 flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div>
                  <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                    Detalhes da diretriz
                  </DialogTitle>
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

              {/* Conteúdo */}
              <ScrollShadow
                size={4}
                className="hide-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    color={confidenceColor[memory.confidence]}
                    variant="soft"
                    className="rounded-full"
                  >
                    {CONFIDENCE_LABEL[memory.confidence]}
                  </Badge>
                  <Badge
                    color={memory.active ? "success" : "neutral"}
                    variant="soft"
                    className="rounded-full"
                  >
                    {memory.active ? "Ativa" : "Inativa"}
                  </Badge>
                  {memory.corporate && (
                    <Badge color="info" variant="soft" className="gap-1 rounded-full">
                      <LockClosedIcon className="size-3.5" />
                      Corporativa
                    </Badge>
                  )}
                </div>

                <h3 className="dark:text-dark-50 mt-4 font-semibold text-gray-800">
                  {memory.title}
                </h3>
                <p className="dark:text-dark-100 mt-2 text-sm leading-relaxed text-gray-600">
                  {memory.content}
                </p>

                <dl className="dark:divide-dark-600 dark:border-dark-600 mt-5 divide-y divide-gray-100 border-y border-gray-100 text-sm">
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="dark:text-dark-300 text-gray-500">Origem</dt>
                    <dd className="dark:text-dark-100 font-medium text-gray-700">
                      {memory.source}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="dark:text-dark-300 text-gray-500">Criada em</dt>
                    <dd className="dark:text-dark-100 font-medium text-gray-700">
                      {memory.date}
                    </dd>
                  </div>
                </dl>

                {/* Uso pela IA — read-only quando corporativa (exceto admin/owner) */}
                {memory.corporate && !canManage ? (
                  <div className="dark:border-dark-600 dark:bg-dark-800 mt-5 flex items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <LockClosedIcon className="dark:text-dark-300 mt-0.5 size-4.5 shrink-0 text-gray-400" />
                    <div>
                      <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
                        Definição corporativa
                      </p>
                      <p className="dark:text-dark-300 text-xs-plus text-gray-400">
                        Sempre ativa — só um administrador pode desativá-la,
                        alterá-la ou removê-la.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="dark:border-dark-600 dark:bg-dark-800 mt-5 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <div>
                      <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
                        Usar nas respostas da IA
                      </p>
                      <p className="dark:text-dark-300 text-xs-plus text-gray-400">
                        Quando ativa, vale para toda resposta da IA.
                      </p>
                    </div>
                    <Switch
                      checked={memory.active}
                      onChange={onToggleActive}
                      color="success"
                    />
                  </div>
                )}
              </ScrollShadow>

              {/* Rodapé */}
              <div className="dark:border-dark-600 flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
                {(!memory.corporate || canManage) && (
                  <Button
                    color="error"
                    variant="flat"
                    className="mr-auto gap-1.5 rounded-lg"
                    onClick={onDelete}
                  >
                    <TrashIcon className="size-4.5" />
                    Excluir
                  </Button>
                )}
                <Button
                  color="primary"
                  variant="outlined"
                  className="rounded-lg"
                  onClick={() => onSave({})}
                >
                  Fechar
                </Button>
              </div>
            </>
          )}
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
