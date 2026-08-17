// Insights — produto Business Partner (IA).
// Cada produto tem a SUA própria página de Insights (diferente do Feed, que é
// o mesmo para todos os produtos). Lista única de insights gerados pela IA a
// partir dos dados das áreas; quando um insight se refere a uma pessoa, o card
// mostra o avatar e o nome dela. Aja direto pelo insight (criar tarefa, agendar
// 1:1, elogiar). Reescrito no design system do Tailux.

// Import Dependencies
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  CheckCircleIcon,
  CheckIcon,
  EllipsisVerticalIcon,
  EyeSlashIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolidIcon } from "@heroicons/react/24/solid";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Avatar, Badge, Button, Card, Spinner } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { listarInsightsApi } from "@/services/api/insights";
import {
  ACOES_SEM_PESSOA,
  dataParaNumero,
  FILTRO_OPCOES,
  INSIGHT_ACOES,
  INSIGHT_USUARIOS,
  MEETING_EMAIL_CONNECTOR,
  ORDENACAO_OPCOES,
  TEAM_FACES,
  type FiltroInsight,
  type Insight,
  type InsightAcao,
  type InsightCor,
  type InsightUser,
  type OrdenacaoInsight,
  type PersonalInsight,
  type TeamMember,
} from "@/app/data/insights";

// ----------------------------------------------------------------------
// Paletas por severidade.

// Todas as abas usam o mesmo padrão: card branco com barra lateral colorida
// pela severidade.
const SIDEBAR_BORDER: Record<InsightCor, string> = {
  secondary: "border-l-rose-500",
  warning: "border-l-amber-500",
  success: "border-l-emerald-500",
  light: "dark:border-l-dark-400 border-l-gray-300",
};

// Cor do Badge (DS do Tailux) por severidade.
const BADGE_COLOR: Record<InsightCor, "error" | "warning" | "success" | "neutral"> =
  {
    secondary: "error",
    warning: "warning",
    success: "success",
    light: "neutral",
  };

// ----------------------------------------------------------------------

export default function Insights() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);

  const [itens, setItens] = useState<Insight[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = () => {
    setCarregando(true);
    setErro("");
    listarInsightsApi()
      .then(setItens)
      .catch(() => setErro("Não foi possível carregar os insights."))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
  }, []);

  return (
    <Page title={`Insights · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <header className="flex flex-col gap-1">
            <PageTitle
              help={{
                description: (
                  <>
                    <p>
                      <strong>Insights</strong> são sinais gerados pela IA a
                      partir dos dados das suas áreas — cada card destaca algo
                      que merece sua atenção, com o contexto e a severidade já
                      avaliados.
                    </p>
                    <p>
                      Você pode agir direto pelo insight: criar uma tarefa,
                      agendar uma reunião, levar a pauta para o próximo 1:1 ou
                      reconhecer um bom trabalho. Use os filtros e a busca no
                      topo para focar no que importa.
                    </p>
                  </>
                ),
              }}
            >
              Insights
            </PageTitle>
            <p className="dark:text-dark-300 max-w-2xl text-sm text-gray-500">
              Sinais gerados pela IA a partir dos dados das suas áreas. Aja
              direto pelo insight — crie tarefas, agende reuniões, leve pautas
              para o 1:1 ou reconheça um bom trabalho.
            </p>
          </header>

          {carregando ? (
            <LoadingState />
          ) : erro ? (
            <ErrorState mensagem={erro} onRetry={carregar} />
          ) : (
            <InsightsBoard items={itens} />
          )}
        </div>
      </div>
    </Page>
  );
}

// ----------------------------------------------------------------------
// Quadro de insights: barra de filtros + grade de cards (lista única).

function InsightsBoard({ items }: { items: Insight[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroInsight>("todos");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoInsight>("data-recente");
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const [curtidos, setCurtidos] = useState<Set<string>>(new Set());
  const [descurtidos, setDescurtidos] = useState<Set<string>>(new Set());

  const exibidos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let lista: Insight[];

    if (filtro === "ocultados") {
      lista = items.filter((i) => ocultos.has(i.id));
    } else {
      lista = items.filter((i) => {
        if (ocultos.has(i.id)) return false;
        if (filtro !== "todos" && filtro !== "visiveis" && i.cor !== filtro)
          return false;
        return true;
      });
    }

    if (termo) {
      lista = lista.filter(
        (i) =>
          i.titulo.toLowerCase().includes(termo) ||
          i.descricao.toLowerCase().includes(termo),
      );
    }

    const ord = [...lista];
    if (ordenacao === "alfabetica") {
      ord.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
    } else if (ordenacao === "data-recente") {
      ord.sort((a, b) => dataParaNumero(b.data) - dataParaNumero(a.data));
    } else {
      ord.sort((a, b) => dataParaNumero(a.data) - dataParaNumero(b.data));
    }
    return ord;
  }, [items, busca, filtro, ordenacao, ocultos]);

  const curtir = (id: string) => {
    setCurtidos((prev) => new Set(prev).add(id));
    setDescurtidos((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  const descurtir = (id: string) => {
    setDescurtidos((prev) => new Set(prev).add(id));
    setCurtidos((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  const ocultar = (id: string) =>
    setOcultos((prev) => new Set(prev).add(id));

  return (
    <div className="flex flex-col gap-5">
      {/* Barra de filtros */}
      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="size-4.5 text-gray-400" />
          </span>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por título ou descrição…"
            className="form-input dark:bg-dark-700 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-9 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:ring-0"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              aria-label="Limpar busca"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="size-4.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SelectField
            label="Filtro"
            value={filtro}
            onChange={(v) => setFiltro(v as FiltroInsight)}
            options={FILTRO_OPCOES}
          />
          <SelectField
            label="Ordenar"
            value={ordenacao}
            onChange={(v) => setOrdenacao(v as OrdenacaoInsight)}
            options={ORDENACAO_OPCOES}
          />
        </div>
      </Card>

      {/* Grade */}
      {exibidos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {exibidos.map((item) => {
            const shared = {
              liked: curtidos.has(item.id),
              disliked: descurtidos.has(item.id),
              onLike: () => curtir(item.id),
              onDislike: () => descurtir(item.id),
              onHide: () => ocultar(item.id),
            };
            return (
              <InsightCard key={item.id} {...shared} item={item} />
            );
          })}
        </div>
      ) : items.length === 0 ? (
        <NoInsightsState />
      ) : (
        <EmptyState onReset={() => {
          setBusca("");
          setFiltro("todos");
        }} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Card do insight — barra lateral colorida pela severidade. Quando o insight
// se refere a uma pessoa específica, mostra o avatar e o nome dela.

function InsightCard({
  item,
  liked,
  disliked,
  onLike,
  onDislike,
  onHide,
}: CardProps<Insight>) {
  const pessoa =
    item.liderado && item.liderado !== "Todos" ? item.liderado : null;

  return (
    <Card
      className={clsx(
        "flex h-full flex-col overflow-hidden border-l-4",
        SIDEBAR_BORDER[item.cor],
      )}
    >
      <div className="flex flex-1 items-start gap-2.5 p-4">
        {pessoa && (
          <Avatar
            size={10}
            src={TEAM_FACES[pessoa as TeamMember]}
            name={pessoa}
            classNames={{ root: "shrink-0", display: "rounded-full" }}
          />
        )}
        <div className="min-w-0 flex-1">
          <Badge
            color={BADGE_COLOR[item.cor]}
            variant="soft"
            className="rounded-full text-[10px]"
          >
            {item.tipo}
          </Badge>
          <p className="dark:text-dark-100 mt-1.5 text-sm-plus font-semibold text-gray-800">
            {item.titulo}
          </p>
          <p className="dark:text-dark-300 mt-1 line-clamp-3 text-xs-plus text-gray-500">
            {item.descricao}
          </p>
          {pessoa && (
            <p className="dark:text-dark-400 mt-1 text-tiny font-medium text-gray-400">
              {pessoa}
            </p>
          )}
        </div>
        <ActionsMenu />
      </div>
      <CardFooter
        item={item}
        liked={liked}
        disliked={disliked}
        onLike={onLike}
        onDislike={onDislike}
        onHide={onHide}
      />
    </Card>
  );
}

// ----------------------------------------------------------------------
// Rodapé compartilhado: data + feedback (útil?) + ocultar.

function CardFooter({
  item,
  onLight = true,
  liked,
  disliked,
  onLike,
  onDislike,
  onHide,
}: {
  item: PersonalInsight;
  onLight?: boolean;
  liked: boolean;
  disliked: boolean;
  onLike: () => void;
  onDislike: () => void;
  onHide: () => void;
}) {
  const respondeu = liked || disliked;
  const muted = onLight ? "text-gray-400 dark:text-dark-300" : "text-white/75";
  const iconBtn = clsx(
    "grid size-7 place-items-center rounded-lg transition-colors",
    onLight
      ? "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-dark-300 dark:hover:bg-dark-500"
      : "text-white/75 hover:bg-white/15 hover:text-white",
  );

  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-2 px-4 py-2.5",
        onLight
          ? "dark:border-dark-500 border-t border-gray-100"
          : "border-t border-white/15",
      )}
    >
      <span className={clsx("text-tiny font-medium", muted)}>{item.data}</span>
      <div className="flex items-center gap-1.5">
        {respondeu ? (
          <span className={clsx("text-tiny", muted)}>
            Agradecemos o feedback.
          </span>
        ) : (
          <>
            <span className={clsx("text-tiny", muted)}>Insight foi útil?</span>
            <button
              type="button"
              onClick={onLike}
              aria-label="Curtir"
              className={iconBtn}
            >
              <HandThumbUpIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={onDislike}
              aria-label="Não curtir"
              className={iconBtn}
            >
              <HandThumbDownIcon className="size-4" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onHide}
          aria-label="Ocultar insight"
          className={iconBtn}
        >
          <EyeSlashIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Menu de ações do card (3 pontinhos).

function ActionsMenu({ onLight = true }: { onLight?: boolean }) {
  // Ação escolhida no menu que abriu o modal (null = fechado).
  const [acaoAberta, setAcaoAberta] = useState<InsightAcao | null>(null);

  const handleAcao = (acao: InsightAcao) => {
    // "Upload Documento" não abre a lista de pessoas.
    if (ACOES_SEM_PESSOA.includes(acao)) return;
    setAcaoAberta(acao);
  };

  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label="Ações do insight"
        className={clsx(
          "grid size-7 place-items-center rounded-lg transition-colors",
          onLight
            ? "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-dark-300 dark:hover:bg-dark-500"
            : "text-white/80 hover:bg-white/15 hover:text-white",
        )}
      >
        <EllipsisVerticalIcon className="size-5" />
      </MenuButton>
      <Transition
        as={MenuItems}
        anchor={{ to: "bottom end", gap: 4 }}
        enter="transition ease-out duration-100"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-75"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
        className="dark:bg-dark-750 dark:border-dark-500 z-100 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
      >
        {[...INSIGHT_ACOES]
          .sort((a, b) => a.localeCompare(b, "pt-BR"))
          .map((acao) => (
          <MenuItem key={acao}>
            {({ focus }) => (
              <button
                type="button"
                onClick={() => handleAcao(acao)}
                className={clsx(
                  "block w-full px-3.5 py-2 text-left text-sm transition-colors",
                  focus
                    ? "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800"
                    : "dark:text-dark-200 text-gray-600",
                )}
              >
                {acao}
              </button>
            )}
          </MenuItem>
        ))}
      </Transition>

      <ActionDialog acao={acaoAberta} onClose={() => setAcaoAberta(null)} />
    </Menu>
  );
}

// ----------------------------------------------------------------------
// Modal da ação do card. Tem duas etapas dentro do MESMO modal:
//   1) "selecionar" — lista as pessoas (foto + nome completo);
//   2) "sucesso"    — confirma que a ação foi concluída.
// Mantê-las no mesmo Dialog evita o empilhamento de dois modais.

// Mensagem amigável por ação (o {nome} é preenchido na renderização).
const SUCESSO_MENSAGEM: Record<InsightAcao, (nome: string) => string> = {
  "Criar Tarefa": (n) => `Tarefa criada para ${n}.`,
  "Agendar Reunião": (n) => `Reunião agendada com ${n}.`,
  "Enviar via Chat": (n) => `Mensagem enviada para ${n}.`,
  "Adicionar pauta para 1:1": (n) => `Pauta adicionada ao 1:1 com ${n}.`,
  "Upload Documento": (n) => `Documento enviado para ${n}.`,
  "Fazer Elogio": (n) => `Elogio enviado para ${n}.`,
};

function ActionDialog({
  acao,
  onClose,
}: {
  acao: InsightAcao | null;
  onClose: () => void;
}) {
  const isReuniao = acao === "Agendar Reunião";

  // Etapa de seleção de pessoa (demais ações).
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<InsightUser | null>(null);
  // Campos do formulário de reunião.
  const [titulo, setTitulo] = useState("");
  const [comentario, setComentario] = useState("");
  const [dataReuniao, setDataReuniao] = useState("");
  const [convidados, setConvidados] = useState<Set<string>>(new Set());
  // Mensagem da etapa de sucesso (null = ainda não confirmado).
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  const usuarios = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return INSIGHT_USUARIOS;
    return INSIGHT_USUARIOS.filter(
      (u) =>
        u.nome.toLowerCase().includes(termo) ||
        u.cargo.toLowerCase().includes(termo),
    );
  }, [busca]);

  // Reseta tudo ao fechar.
  const close = () => {
    onClose();
    setBusca("");
    setSelecionado(null);
    setTitulo("");
    setComentario("");
    setDataReuniao("");
    setConvidados(new Set());
    setSucessoMsg(null);
  };

  const toggleConvidado = (id: string) =>
    setConvidados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const agendarReuniao = () => {
    const n = convidados.size;
    setSucessoMsg(
      `Reunião "${titulo.trim()}" agendada${
        n ? ` com ${n} convidado${n > 1 ? "s" : ""}` : ""
      }.`,
    );
  };

  // Validação mínima do formulário de reunião.
  const reuniaoValida = titulo.trim().length > 0 && dataReuniao.length > 0;

  return (
    <Transition show={acao !== null}>
      <Dialog onClose={close} className="relative z-100">
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="dark:bg-black/50 fixed inset-0 bg-gray-900/40 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel
              className={clsx(
                "dark:bg-dark-700 w-full overflow-hidden rounded-2xl bg-white shadow-xl",
                sucessoMsg
                  ? "max-w-sm"
                  : isReuniao
                    ? "flex max-h-[85vh] max-w-lg flex-col"
                    : "flex max-h-[80vh] max-w-md flex-col",
              )}
            >
              {sucessoMsg ? (
                /* Etapa final — sucesso */
                <div className="px-6 py-7 text-center">
                  <span className="dark:bg-emerald-500/15 mx-auto grid size-14 place-items-center rounded-full bg-emerald-50">
                    <CheckCircleSolidIcon className="size-9 text-emerald-500" />
                  </span>
                  <DialogTitle className="dark:text-dark-50 mt-4 text-lg font-semibold text-gray-800">
                    Ação concluída
                  </DialogTitle>
                  <p className="dark:text-dark-200 mt-1.5 text-sm text-gray-500">
                    {sucessoMsg}
                  </p>
                  <Button color="primary" onClick={close} className="mt-6 w-full">
                    Concluir
                  </Button>
                </div>
              ) : isReuniao ? (
                /* Etapa 1 (reunião) — formulário de agendamento */
                <MeetingForm
                  titulo={titulo}
                  setTitulo={setTitulo}
                  comentario={comentario}
                  setComentario={setComentario}
                  dataReuniao={dataReuniao}
                  setDataReuniao={setDataReuniao}
                  convidados={convidados}
                  toggleConvidado={toggleConvidado}
                  valido={reuniaoValida}
                  onCancel={close}
                  onSubmit={agendarReuniao}
                />
              ) : (
                /* Etapa 1 — seleção da pessoa */
                <>
                  {/* Cabeçalho */}
                  <div className="dark:border-dark-500 flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
                    <div>
                      <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                        {acao}
                      </DialogTitle>
                      <p className="dark:text-dark-300 mt-0.5 text-xs-plus text-gray-500">
                        Selecione a pessoa para esta ação.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={close}
                      aria-label="Fechar"
                      className="dark:text-dark-300 dark:hover:bg-dark-500 grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                      <XMarkIcon className="size-5" />
                    </button>
                  </div>

                  {/* Busca */}
                  <div className="dark:border-dark-500 border-b border-gray-100 px-5 py-3">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <MagnifyingGlassIcon className="size-4.5 text-gray-400" />
                      </span>
                      <input
                        type="text"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar pessoa…"
                        autoFocus
                        className="form-input dark:bg-dark-800 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:ring-0"
                      />
                    </div>
                  </div>

                  {/* Lista de pessoas */}
                  <ul className="min-h-0 flex-1 overflow-y-auto py-2">
                    {usuarios.length === 0 ? (
                      <li className="dark:text-dark-300 px-5 py-8 text-center text-sm text-gray-400">
                        Nenhuma pessoa encontrada.
                      </li>
                    ) : (
                      usuarios.map((u) => {
                        const ativo = selecionado?.id === u.id;
                        return (
                          <li key={u.id}>
                            <button
                              type="button"
                              onClick={() => setSelecionado(u)}
                              className={clsx(
                                "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
                                ativo
                                  ? "bg-primary-50 dark:bg-primary-500/15"
                                  : "dark:hover:bg-dark-600 hover:bg-gray-100",
                              )}
                            >
                              <Avatar
                                size={10}
                                src={u.face}
                                name={u.nome}
                                classNames={{ root: "shrink-0", display: "rounded-full" }}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="dark:text-dark-100 block truncate text-sm font-medium text-gray-800">
                                  {u.nome}
                                </span>
                                <span className="dark:text-dark-300 block truncate text-tiny text-gray-400">
                                  {u.cargo}
                                </span>
                              </span>
                              {ativo && (
                                <CheckCircleIcon className="text-primary-600 dark:text-primary-400 size-5 shrink-0" />
                              )}
                            </button>
                          </li>
                        );
                      })
                    )}
                  </ul>

                  {/* Rodapé */}
                  <div className="dark:border-dark-500 flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
                    <Button variant="outlined" color="neutral" onClick={close}>
                      Cancelar
                    </Button>
                    <Button
                      color="primary"
                      disabled={!selecionado}
                      onClick={() => {
                        if (selecionado && acao)
                          setSucessoMsg(SUCESSO_MENSAGEM[acao](selecionado.nome));
                      }}
                    >
                      Confirmar
                    </Button>
                  </div>
                </>
              )}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

// ----------------------------------------------------------------------
// Formulário de "Agendar Reunião": conector de e-mail conectado + título +
// comentário + data + convidados.

function MeetingForm({
  titulo,
  setTitulo,
  comentario,
  setComentario,
  dataReuniao,
  setDataReuniao,
  convidados,
  toggleConvidado,
  valido,
  onCancel,
  onSubmit,
}: {
  titulo: string;
  setTitulo: (v: string) => void;
  comentario: string;
  setComentario: (v: string) => void;
  dataReuniao: string;
  setDataReuniao: (v: string) => void;
  convidados: Set<string>;
  toggleConvidado: (id: string) => void;
  valido: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const conn = MEETING_EMAIL_CONNECTOR;

  return (
    <>
      {/* Cabeçalho */}
      <div className="dark:border-dark-500 flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
        <div>
          <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
            Agendar Reunião
          </DialogTitle>
          <p className="dark:text-dark-300 mt-0.5 text-xs-plus text-gray-500">
            O evento será criado na sua agenda conectada.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar"
          className="dark:text-dark-300 dark:hover:bg-dark-500 grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <XMarkIcon className="size-5" />
        </button>
      </div>

      {/* Corpo rolável */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {/* Conector de e-mail conectado */}
        <div className="dark:border-dark-500 dark:bg-dark-600 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold text-white shadow-sm"
            style={{
              backgroundImage: `linear-gradient(140deg, ${conn.brand}, ${conn.brand}cc)`,
            }}
            aria-hidden="true"
          >
            {conn.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="dark:text-dark-100 truncate text-sm font-medium text-gray-800">
              {conn.nome}
            </p>
            <p className="dark:text-dark-300 truncate text-tiny text-gray-400">
              {conn.conta}
            </p>
          </div>
          <Badge color="success" variant="soft" className="shrink-0 gap-1 rounded-full">
            <CheckCircleIcon className="size-3.5" />
            Conectado
          </Badge>
        </div>

        {/* Título */}
        <Field label="Título" required>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Alinhamento sobre rotatividade"
            className="form-input dark:bg-dark-800 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:ring-0"
          />
        </Field>

        {/* Comentário */}
        <Field label="Comentário">
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            placeholder="Pauta, contexto ou observações…"
            className="form-textarea dark:bg-dark-800 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:ring-0"
          />
        </Field>

        {/* Data */}
        <Field label="Data e hora" required>
          <input
            type="datetime-local"
            value={dataReuniao}
            onChange={(e) => setDataReuniao(e.target.value)}
            className="form-input dark:bg-dark-800 dark:border-dark-450 dark:text-dark-100 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-primary-500 focus:ring-0"
          />
        </Field>

        {/* Convidados */}
        <Field
          label={`Convidados${convidados.size ? ` (${convidados.size})` : ""}`}
        >
          <div className="dark:border-dark-500 max-h-44 overflow-y-auto rounded-lg border border-gray-200">
            {INSIGHT_USUARIOS.map((u) => {
              const marcado = convidados.has(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleConvidado(u.id)}
                  className={clsx(
                    "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                    marcado
                      ? "bg-primary-50 dark:bg-primary-500/15"
                      : "dark:hover:bg-dark-600 hover:bg-gray-50",
                  )}
                >
                  <Avatar
                    size={9}
                    src={u.face}
                    name={u.nome}
                    classNames={{ root: "shrink-0", display: "rounded-full" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="dark:text-dark-100 block truncate text-sm font-medium text-gray-800">
                      {u.nome}
                    </span>
                    <span className="dark:text-dark-300 block truncate text-tiny text-gray-400">
                      {u.cargo}
                    </span>
                  </span>
                  <span
                    className={clsx(
                      "grid size-5 shrink-0 place-items-center rounded-lg border transition-colors",
                      marcado
                        ? "border-primary-600 bg-primary-600 text-white dark:border-primary-500 dark:bg-primary-500"
                        : "dark:border-dark-400 border-gray-300",
                    )}
                  >
                    {marcado && <CheckIcon className="size-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      {/* Rodapé */}
      <div className="dark:border-dark-500 flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
        <Button variant="outlined" color="neutral" onClick={onCancel}>
          Cancelar
        </Button>
        <Button color="primary" disabled={!valido} onClick={onSubmit}>
          Agendar
        </Button>
      </div>
    </>
  );
}

// ----------------------------------------------------------------------
// Campo de formulário (label + controle).

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="dark:text-dark-200 mb-1.5 block text-xs-plus font-medium text-gray-600">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

// ----------------------------------------------------------------------
// Select estilizado (label + nativo).

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="dark:text-dark-300 text-xs font-medium text-gray-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-select dark:bg-dark-700 dark:border-dark-450 dark:text-dark-100 h-9 rounded-lg border border-gray-300 bg-white pl-3 pr-8 text-xs-plus text-gray-700 focus:border-primary-500 focus:ring-0"
      >
        {options.map((opt) => (
          <option key={opt.value || "vazio"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ----------------------------------------------------------------------

// Enquanto os insights carregam da API.
function LoadingState() {
  return (
    <div className="dark:border-dark-600 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
      <Spinner className="size-7 text-primary-500" />
      <p className="dark:text-dark-200 mt-3 text-sm text-gray-500">
        Carregando insights…
      </p>
    </div>
  );
}

// Falha ao carregar da API — oferece tentar de novo.
function ErrorState({
  mensagem,
  onRetry,
}: {
  mensagem: string;
  onRetry: () => void;
}) {
  return (
    <div className="dark:border-dark-600 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
      <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
        {mensagem}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="text-primary-600 dark:text-primary-400 mt-4 text-sm font-semibold"
      >
        Tentar novamente
      </button>
    </div>
  );
}

// Estado exibido quando ainda não há nenhum insight — a IA gera os insights a
// partir dos dados das áreas; enquanto não houver dados, a lista fica vazia.
function NoInsightsState() {
  return (
    <div className="dark:border-dark-600 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
      <SparklesIcon className="dark:text-dark-400 size-10 text-gray-300" />
      <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
        Nenhum insight ainda
      </p>
      <p className="dark:text-dark-300 mt-1 max-w-sm text-xs-plus text-gray-400">
        Os insights aparecem aqui quando a IA os gera a partir dos dados das
        suas áreas.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="dark:border-dark-600 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
      <MagnifyingGlassIcon className="dark:text-dark-400 size-10 text-gray-300" />
      <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
        Nenhum insight encontrado
      </p>
      <p className="dark:text-dark-300 mt-1 text-xs-plus text-gray-400">
        Ajuste a busca ou os filtros para ver mais resultados.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="text-primary-600 dark:text-primary-400 mt-4 text-sm font-semibold"
      >
        Limpar filtros
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------

interface CardProps<T extends PersonalInsight> {
  item: T;
  liked: boolean;
  disliked: boolean;
  onLike: () => void;
  onDislike: () => void;
  onHide: () => void;
}
