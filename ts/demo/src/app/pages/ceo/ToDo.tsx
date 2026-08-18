// Import Dependencies
import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  LockClosedIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
  ListBulletIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Button } from "@/components/ui";
import { Input, Select } from "@/components/ui/Form";
import { useDisclosure } from "@/hooks";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { BoardProvider } from "@/app/pages/apps/kanban/BoardProvider";
import { useBoardContext } from "@/app/pages/apps/kanban/Board.context";
import { Column } from "@/app/pages/apps/kanban/Board/Column";
import { AddColumnButton } from "@/app/pages/apps/kanban/Board/AddColumnButton";
import { AddColumn } from "@/app/pages/apps/kanban/Modals/AddColumn";
import { AddBoard } from "@/app/pages/apps/kanban/Modals/AddBoard";
import type { Board, Priority, Task } from "@/app/pages/apps/kanban/data";

// ----------------------------------------------------------------------
// To Do — quadros Kanban (migrado do beculture-dist). Cada quadro tem etapas
// ("A fazer", "Em andamento", "Concluído"), atividades com arrastar-e-soltar,
// filtro por texto e por prioridade, e visão em Lista. O estado é persistido
// no navegador (localStorage, via store do Kanban) e é o mesmo do app.
// ----------------------------------------------------------------------

const PRIORITY_OPTIONS: { label: string; value: string }[] = [
  { label: "Toda prioridade", value: "" },
  { label: "Alta", value: "alta" },
  { label: "Média", value: "media" },
  { label: "Baixa", value: "baixa" },
];

const PRIORITY_META: Record<
  Priority,
  { label: string; dot: string; badge: string }
> = {
  alta: { label: "Alta", dot: "bg-error", badge: "text-error" },
  media: { label: "Média", dot: "bg-warning", badge: "text-warning" },
  baixa: { label: "Baixa", dot: "bg-info", badge: "text-info" },
};

export default function ToDo() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);

  return (
    <Page title={`To Do · ${product.name}`}>
      <BoardProvider>
        <ToDoBoard />
      </BoardProvider>
    </Page>
  );
}

// ----------------------------------------------------------------------

function ToDoBoard() {
  const { boards, currentBoard } = useBoardContext();
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [busca, setBusca] = useState("");
  const [prioridade, setPrioridade] = useState("");

  const [addColOpen, { open: openAddCol, close: closeAddCol }] =
    useDisclosure(false);
  const [addTaskOpen, { open: openAddTask, close: closeAddTask }] =
    useDisclosure(false);

  // Aplica os filtros (texto + prioridade) sobre o quadro atual: reduz a lista
  // de atividades e as ids referenciadas por cada etapa.
  const filteredBoard = useMemo<Board | undefined>(() => {
    if (!currentBoard) return undefined;
    const termo = busca.trim().toLowerCase();
    const passa = (t: Task) =>
      (!termo || t.title.toLowerCase().includes(termo)) &&
      (!prioridade || t.priority === prioridade);
    const tasks = currentBoard.tasks.filter(passa);
    const okIds = new Set(tasks.map((t) => t.id));
    return {
      ...currentBoard,
      tasks,
      columns: currentBoard.columns.map((c) => ({
        ...c,
        tasks: c.tasks.filter((id) => okIds.has(id)),
      })),
    };
  }, [currentBoard, busca, prioridade]);

  return (
    <div className="flex h-[calc(100dvh-var(--header-h))] min-h-0">
      {/* Sidebar de quadros */}
      <QuadrosSidebar boards={boards} />

      {/* Área principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar
          board={currentBoard}
          view={view}
          onView={setView}
          busca={busca}
          onBusca={setBusca}
          prioridade={prioridade}
          onPrioridade={setPrioridade}
          onAddEtapa={openAddCol}
          onAddAtividade={openAddTask}
        />

        {!filteredBoard ? (
          <div className="grid flex-1 place-items-center">
            <div className="text-center">
              <p className="dark:text-dark-200 text-sm text-gray-500">
                Nenhum quadro selecionado.
              </p>
              <p className="dark:text-dark-300 mt-1 text-xs text-gray-400">
                Crie um quadro na barra lateral para começar.
              </p>
            </div>
          </div>
        ) : view === "kanban" ? (
          <KanbanView board={filteredBoard} />
        ) : (
          <ListaView board={filteredBoard} />
        )}
      </div>

      <AddColumn isOpen={addColOpen} close={closeAddCol} />
      <NovaAtividadeModal isOpen={addTaskOpen} close={closeAddTask} />
    </div>
  );
}

// ----------------------------------------------------------------------
// Sidebar "QUADROS": lista os quadros com a contagem de atividades e permite
// criar um novo quadro (+).
// ----------------------------------------------------------------------

function QuadrosSidebar({ boards }: { boards: Board[] }) {
  const { currentBoard, setActiveBoardId } = useBoardContext();
  const [addBoardOpen, { open, close }] = useDisclosure(false);

  return (
    <>
      {/* `hidden md:flex`: os 224px fixos comiam 60% de uma tela de 375px e
          deixavam o kanban inutilizável. Abaixo de md os quadros ficam
          acessíveis pelo seletor da Toolbar. */}
      <aside className="dark:border-dark-600 dark:bg-dark-750 hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="dark:text-dark-300 text-tiny-plus font-semibold tracking-wider text-gray-500 uppercase">
            Quadros
          </span>
          <Button
            onClick={open}
            variant="flat"
            isIcon
            className="size-6 rounded-lg"
            aria-label="Novo quadro"
            title="Novo quadro"
          >
            <PlusIcon className="size-3.5 stroke-2" />
          </Button>
        </div>
        <ul className="flex flex-col gap-1 overflow-y-auto px-2 pb-3">
          {boards.map((b) => {
            const ativo = b.id === currentBoard?.id;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setActiveBoardId(b.id)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    ativo
                      ? "bg-primary-600/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400"
                      : "dark:text-dark-200 dark:hover:bg-dark-600 text-gray-700 hover:bg-gray-100",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {b.name}
                  </span>
                  {b.isPrivate && (
                    <LockClosedIcon className="size-3.5 shrink-0 opacity-60" />
                  )}
                  <span
                    className={clsx(
                      "text-tiny grid h-5 min-w-5 shrink-0 place-items-center rounded-lg px-1 font-medium",
                      ativo
                        ? "bg-primary-600/15 text-primary-600 dark:text-primary-400"
                        : "dark:bg-dark-600 dark:text-dark-200 bg-gray-100 text-gray-500",
                    )}
                  >
                    {b.tasks.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <AddBoard isOpen={addBoardOpen} close={close} />
    </>
  );
}

// ----------------------------------------------------------------------
// Barra de ferramentas: nome do quadro, alternância Kanban/Lista, filtro de
// texto, filtro de prioridade e os botões "+ Etapa" e "+ Atividade".
// ----------------------------------------------------------------------

function Toolbar({
  board,
  view,
  onView,
  busca,
  onBusca,
  prioridade,
  onPrioridade,
  onAddEtapa,
  onAddAtividade,
}: {
  board?: Board;
  view: "kanban" | "lista";
  onView: (v: "kanban" | "lista") => void;
  busca: string;
  onBusca: (v: string) => void;
  prioridade: string;
  onPrioridade: (v: string) => void;
  onAddEtapa: () => void;
  onAddAtividade: () => void;
}) {
  return (
    <div className="dark:border-dark-600 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-(--margin-x) py-3">
      <div className="flex items-center gap-3">
        <PageTitle
          className="dark:text-dark-50 truncate text-lg font-semibold text-gray-800"
          help={{
            title: "To Do",
            description: (
              <>
                <p>
                  <strong>To Do</strong> organiza suas tarefas em quadros no
                  estilo Kanban. Cada quadro tem etapas (como A fazer, Em
                  andamento e Concluído) e atividades que você arrasta de uma
                  etapa para outra.
                </p>
                <p>
                  Crie quantos quadros quiser na barra lateral, adicione etapas
                  e atividades com prioridade, filtre por texto ou prioridade e
                  alterne entre a visão Kanban e a visão em Lista. Tudo fica
                  salvo no seu navegador.
                </p>
              </>
            ),
          }}
        >
          {board?.name ?? "To Do"}
        </PageTitle>
        {/* Alternância Kanban / Lista */}
        <div className="dark:bg-dark-700 flex rounded-lg bg-gray-100 p-0.5">
          <button
            type="button"
            onClick={() => onView("kanban")}
            className={clsx(
              "text-xs-plus flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
              view === "kanban"
                ? "dark:bg-dark-500 dark:text-dark-50 bg-white text-gray-800 shadow-sm"
                : "dark:text-dark-300 text-gray-500",
            )}
          >
            <Squares2X2Icon className="size-4" />
            Kanban
          </button>
          <button
            type="button"
            onClick={() => onView("lista")}
            className={clsx(
              "text-xs-plus flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
              view === "lista"
                ? "dark:bg-dark-500 dark:text-dark-50 bg-white text-gray-800 shadow-sm"
                : "dark:text-dark-300 text-gray-500",
            )}
          >
            <ListBulletIcon className="size-4" />
            Lista
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          placeholder="Filtrar atividades..."
          classNames={{ root: "w-full max-w-[15rem]", input: "h-9 text-xs" }}
          prefix={<MagnifyingGlassIcon className="size-4.5" />}
        />
        <Select
          value={prioridade}
          onChange={(e) => onPrioridade(e.target.value)}
          data={PRIORITY_OPTIONS}
          className="h-9 text-xs"
          aria-label="Filtrar por prioridade"
        />
        <Button onClick={onAddEtapa} variant="outlined" className="h-9 gap-1.5">
          <PlusIcon className="size-4.5" />
          Etapa
        </Button>
        <Button
          onClick={onAddAtividade}
          color="primary"
          className="h-9 gap-1.5"
        >
          <PlusIcon className="size-4.5" />
          Atividade
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Visão Kanban — reaproveita a coluna (etapa) do motor do Kanban, com
// arrastar-e-soltar, e o botão de nova etapa ao final.
// ----------------------------------------------------------------------

function KanbanView({ board }: { board: Board }) {
  return (
    <div className="grid h-[calc(100vh-65px-3.75rem)] grid-cols-1">
      <div
        className="custom-scrollbar transition-content flex w-full items-start gap-x-4 overflow-x-auto overflow-y-hidden px-(--margin-x) pt-4"
        style={
          {
            "--scrollbar-size": "0.625rem",
            "--margin-scroll": "var(--margin-x)",
          } as React.CSSProperties
        }
      >
        {board.columns.map((column) => (
          <Column data={column} key={column.id} tasks={board.tasks} />
        ))}
        <AddColumnButton />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Visão Lista — todas as atividades agrupadas por etapa, com prioridade.
// ----------------------------------------------------------------------

function ListaView({ board }: { board: Board }) {
  const byId = useMemo(
    () => new Map(board.tasks.map((t) => [t.id, t])),
    [board.tasks],
  );

  return (
    <div className="flex-1 overflow-y-auto px-(--margin-x) py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {board.columns.map((c) => {
          const tarefas = c.tasks
            .map((id) => byId.get(id))
            .filter((t): t is Task => !!t);
          return (
            <div key={c.id}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="dark:text-dark-100 text-sm font-semibold text-gray-700">
                  {c.name}
                </h3>
                <span className="dark:text-dark-300 text-tiny text-gray-400">
                  {tarefas.length}
                </span>
              </div>
              {tarefas.length === 0 ? (
                <p className="dark:text-dark-400 dark:border-dark-600 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
                  Sem atividades nesta etapa.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {tarefas.map((t) => (
                    <li
                      key={t.id}
                      className="dark:border-dark-600 dark:bg-dark-700 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
                    >
                      <span className="dark:text-dark-100 min-w-0 flex-1 truncate text-sm text-gray-700">
                        {t.title}
                      </span>
                      {t.priority && (
                        <span
                          className={clsx(
                            "text-tiny-plus flex shrink-0 items-center gap-1 font-medium",
                            PRIORITY_META[t.priority].badge,
                          )}
                        >
                          <span
                            className={clsx(
                              "size-2 rounded-full",
                              PRIORITY_META[t.priority].dot,
                            )}
                          />
                          {PRIORITY_META[t.priority].label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Modal "Nova atividade": título, etapa de destino e prioridade.
// ----------------------------------------------------------------------

function NovaAtividadeModal({
  isOpen,
  close,
}: {
  isOpen: boolean;
  close: () => void;
}) {
  const { currentBoard, createTask } = useBoardContext();
  const [titulo, setTitulo] = useState("");
  const [etapa, setEtapa] = useState("");
  const [prioridade, setPrioridade] = useState("");

  const colunas = currentBoard?.columns ?? [];
  const etapaId = etapa || colunas[0]?.id || "";

  const criar = () => {
    const t = titulo.trim();
    if (!t || !etapaId) return;
    createTask(etapaId, {
      title: t,
      priority: (prioridade || undefined) as Priority | undefined,
    });
    setTitulo("");
    setEtapa("");
    setPrioridade("");
    close();
  };

  return (
    <Transition show={isOpen}>
      <Dialog onClose={close} className="relative z-100">
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity dark:bg-black/40" />
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
            <DialogPanel className="dark:bg-dark-700 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                  Nova atividade
                </DialogTitle>
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

              <div className="mt-5 space-y-4">
                <Input
                  label="Título"
                  value={titulo}
                  autoFocus
                  onChange={(e) => setTitulo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") criar();
                  }}
                  placeholder="O que precisa ser feito?"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Etapa"
                    value={etapaId}
                    onChange={(e) => setEtapa(e.target.value)}
                    data={colunas.map((c) => ({ label: c.name, value: c.id }))}
                  />
                  <Select
                    label="Prioridade"
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value)}
                    data={[
                      { label: "Sem prioridade", value: "" },
                      { label: "Alta", value: "alta" },
                      { label: "Média", value: "media" },
                      { label: "Baixa", value: "baixa" },
                    ]}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outlined"
                  className="rounded-lg"
                  onClick={close}
                >
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  className="gap-1.5 rounded-lg"
                  disabled={!titulo.trim() || !etapaId}
                  onClick={criar}
                >
                  <PlusIcon className="size-4.5" />
                  Adicionar
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
