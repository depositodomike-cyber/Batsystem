// Orientador de insights (antes "Direcionador") — seção de Configurações de
// usuário (menu de perfil); antes era a 2ª aba da página de Insights.
// Orientações da organização para a IA sobre o que observar e como tratar os
// insights. Elas entram na geração dos próximos insights (só as ativas) e
// orientam foco e critério — nunca a conclusão. A organização visual segue a
// tela de Regras (header + botão "Nova…", modal de criação) e as listagens de
// Estrutura (tabela, menu ••• com Editar/Desativar/Excluir, ConfirmModal).

// Import Dependencies
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
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
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon,
  MinusCircleIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { toast } from "sonner";

// Local Imports
import {
  Badge,
  Button,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui";
import { Input, Switch, Textarea } from "@/components/ui/Form";
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { PageTitle } from "@/components/shared/PageTitle";
import {
  DIRECIONAMENTO_MAX_INSTRUCAO,
  DIRECIONAMENTO_MAX_NOME,
  DIRECIONAMENTO_TIPOS,
  type DirecionamentoInput,
  type DirecionamentoPrioridade,
  type DirecionamentoTipo,
  type InsightDirecionamento,
} from "@/app/data/insights";
import {
  atualizarDirecionamentoApi,
  criarDirecionamentoApi,
  excluirDirecionamentoApi,
  listarDirecionamentosApi,
  mensagemDeErroApi,
  opcoesFocoApi,
  type OpcoesFoco,
} from "@/services/api/insightDirecionamentos";
import { usePodeGerenciarDirecionadores } from "./usePodeGerenciarDirecionadores";

// ----------------------------------------------------------------------

/** Estado do modal: fechado, criando (com pré-preenchimento opcional) ou editando. */
type ModalEstado =
  | { modo: "fechado" }
  | { modo: "criar"; inicial?: Partial<DirecionamentoInput> }
  | { modo: "editar"; item: InsightDirecionamento };

export function DirecionadorDeInsights({
  sugestao,
}: {
  /**
   * Direcionamento sugerido a partir de um 👎 — abre o modal pré-preenchido.
   * Cada sugestão nova é um objeto novo; a página a descarta ao sair da aba.
   */
  sugestao: Partial<DirecionamentoInput> | null;
}) {
  const podeGerenciar = usePodeGerenciarDirecionadores();
  const [itens, setItens] = useState<InsightDirecionamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState<ModalEstado>({ modo: "fechado" });
  const [aExcluir, setAExcluir] = useState<InsightDirecionamento | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [estadoConfirm, setEstadoConfirm] = useState<
    "pending" | "success" | "error"
  >("pending");

  const buscar = () =>
    listarDirecionamentosApi()
      .then(setItens)
      .catch(() => setErro("Não foi possível carregar as orientações."))
      .finally(() => setCarregando(false));

  const carregar = () => {
    setCarregando(true);
    setErro("");
    void buscar();
  };

  useEffect(() => {
    void buscar();
  }, []);

  // A sugestão vinda do feedback vira a abertura do modal — o usuário revisa
  // antes de salvar. Derivado no render (e não num efeito): cada sugestão
  // abre o modal uma única vez.
  const [sugestaoVista, setSugestaoVista] =
    useState<Partial<DirecionamentoInput> | null>(null);
  if (sugestao && sugestao !== sugestaoVista) {
    setSugestaoVista(sugestao);
    setModal({ modo: "criar", inicial: sugestao });
  }

  const salvar = async (input: DirecionamentoInput & { ativo?: boolean }) => {
    try {
      if (modal.modo === "editar") {
        const atualizado = await atualizarDirecionamentoApi(
          modal.item.id,
          input,
        );
        setItens((l) =>
          l.map((i) => (i.id === atualizado.id ? atualizado : i)),
        );
        toast.success("Orientação atualizada.");
      } else {
        const criado = await criarDirecionamentoApi(input);
        setItens((l) => [criado, ...l]);
        toast.success(
          "Orientação criada. Ela passa a valer nas próximas análises.",
        );
      }
      setModal({ modo: "fechado" });
    } catch (e) {
      toast.error(
        mensagemDeErroApi(e, "Não foi possível salvar a orientação."),
      );
    }
  };

  const alternarStatus = async (item: InsightDirecionamento) => {
    const ativo = !item.ativo;
    setItens((l) => l.map((i) => (i.id === item.id ? { ...i, ativo } : i)));
    try {
      const atualizado = await atualizarDirecionamentoApi(item.id, { ativo });
      setItens((l) => l.map((i) => (i.id === atualizado.id ? atualizado : i)));
    } catch (e) {
      setItens((l) => l.map((i) => (i.id === item.id ? item : i)));
      toast.error(mensagemDeErroApi(e, "Não foi possível alterar o status."));
    }
  };

  const confirmarExclusao = async () => {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await excluirDirecionamentoApi(aExcluir.id);
      setItens((l) => l.filter((i) => i.id !== aExcluir.id));
      setEstadoConfirm("success");
    } catch {
      setEstadoConfirm("error");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho — mesmo arranjo das seções da org com título no fundo
          (Regras, Colaboradores): `PageTitle` com ajuda + subtítulo, ação à
          direita alinhada à base. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <PageTitle
            help={{
              description: (
                <>
                  <p>
                    O <strong>Orientador de insights</strong> reúne as
                    orientações que você dá à IA: assuntos que merecem mais
                    atenção e o que não deve ser considerado relevante.
                  </p>
                  <p>
                    Só as orientações ativas entram nas próximas análises. Elas
                    direcionam o olhar da IA, sem forçar conclusões: os insights
                    continuam dependendo do que o material mostra. Criar e
                    editar orientações depende da sua permissão.
                  </p>
                </>
              ),
            }}
          >
            Orientador de insights
          </PageTitle>
          <p className="dark:text-dark-300 max-w-xl text-sm text-gray-500">
            Defina o que a IA deve observar com mais atenção ao analisar seus
            dados e quais tipos de insight são mais relevantes para você.
          </p>
        </div>
        {podeGerenciar && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              color="primary"
              className="h-10 gap-2 rounded-lg px-4"
              onClick={() => setModal({ modo: "criar" })}
            >
              <PlusIcon className="size-4.5" />
              Nova orientação
            </Button>
          </div>
        )}
      </div>

      {carregando ? (
        <div className="dark:text-dark-300 flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
          <Spinner className="size-5" /> Carregando orientações…
        </div>
      ) : erro ? (
        <div className="dark:border-dark-600 grid place-items-center gap-3 rounded-xl border border-gray-200 py-14 text-center">
          <p className="dark:text-dark-200 text-sm text-gray-600">{erro}</p>
          <Button variant="outlined" className="rounded-lg" onClick={carregar}>
            Tentar de novo
          </Button>
        </div>
      ) : itens.length === 0 ? (
        <div className="dark:border-dark-600 grid place-items-center rounded-xl border border-gray-200 px-6 py-14 text-center">
          <AdjustmentsHorizontalIcon className="dark:text-dark-400 size-8 text-gray-300" />
          <h3 className="dark:text-dark-100 mt-3 text-sm font-semibold text-gray-700">
            Nenhuma orientação ainda
          </h3>
          <p className="dark:text-dark-300 mt-1 max-w-md text-sm text-gray-500">
            Diga à IA quais assuntos importam para você — por exemplo, “Turnover
            em Produto” — ou o que não deve ser considerado relevante.
            {!podeGerenciar &&
              " Fale com um administrador para criar uma orientação."}
          </p>
        </div>
      ) : (
        <div className="dark:border-dark-600 overflow-x-auto rounded-xl border border-gray-200">
          <Table hoverable className="w-full text-left">
            <THead>
              <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                {["Orientação", "Status"].map((t) => (
                  <Th
                    key={t}
                    className="dark:text-dark-200 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                  >
                    {t}
                  </Th>
                ))}
                <Th className="w-12 py-3">
                  <span className="sr-only">Ações</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {itens.map((d) => (
                <Tr
                  key={d.id}
                  className={clsx(
                    "dark:border-dark-600 border-b border-gray-100 last:border-0",
                    podeGerenciar && "cursor-pointer",
                  )}
                  onClick={
                    podeGerenciar
                      ? () => setModal({ modo: "editar", item: d })
                      : undefined
                  }
                >
                  <Td className="py-3">
                    <div className={clsx("min-w-0", !d.ativo && "opacity-60")}>
                      <span className="dark:text-dark-100 block text-sm font-medium text-gray-800">
                        {d.nome}
                      </span>
                      <span className="dark:text-dark-300 line-clamp-1 block max-w-md text-xs text-gray-400">
                        {d.instrucao}
                      </span>
                    </div>
                  </Td>
                  <Td className="py-3">
                    <Badge
                      color={d.ativo ? "success" : "neutral"}
                      variant="soft"
                      className="rounded-full"
                    >
                      {d.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </Td>
                  <Td className="py-3">
                    {podeGerenciar && (
                      // stopPropagation: a linha inteira abre a edição.
                      <div onClick={(e) => e.stopPropagation()}>
                        <AcoesMenu
                          item={d}
                          onEditar={() => setModal({ modo: "editar", item: d })}
                          onAlternarStatus={() => void alternarStatus(d)}
                          onExcluir={() => {
                            setEstadoConfirm("pending");
                            setAExcluir(d);
                          }}
                        />
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <DirecionamentoModal
        estado={modal}
        onClose={() => setModal({ modo: "fechado" })}
        onSalvar={salvar}
      />

      <ConfirmModal
        show={aExcluir != null}
        onClose={() => {
          setAExcluir(null);
          setEstadoConfirm("pending");
        }}
        onOk={() => void confirmarExclusao()}
        confirmLoading={excluindo}
        state={estadoConfirm}
        messages={{
          pending: {
            title: "Excluir esta orientação?",
            // Diz o que NÃO acontece: os insights antigos continuam.
            description: `"${aExcluir?.nome ?? "Esta orientação"}" deixa de orientar as próximas análises. Os insights já gerados continuam disponíveis.`,
            actionText: "Excluir",
          },
          success: {
            title: "Orientação excluída",
            description: "Ele não vai mais orientar as próximas análises.",
            actionText: "Ok",
          },
          error: {
            title: "Não foi possível excluir",
            description: "Verifique a conexão e tente de novo.",
            actionText: "Tentar de novo",
          },
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// Menu ••• — mesmo desenho do `ItemMenu` de EstruturaLista.

function AcoesMenu({
  item,
  onEditar,
  onAlternarStatus,
  onExcluir,
}: {
  item: InsightDirecionamento;
  onEditar: () => void;
  onAlternarStatus: () => void;
  onExcluir: () => void;
}) {
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label={`Ações de ${item.nome}`}
        className="dark:text-dark-300 dark:hover:bg-dark-500 dark:hover:text-dark-100 grid size-7 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
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
        <ItemAcao icon={PencilSquareIcon} onClick={onEditar}>
          Editar
        </ItemAcao>
        {item.ativo ? (
          <ItemAcao
            icon={MinusCircleIcon}
            onClick={onAlternarStatus}
            destrutivo
          >
            Desativar
          </ItemAcao>
        ) : (
          <ItemAcao icon={ArrowPathIcon} onClick={onAlternarStatus}>
            Ativar
          </ItemAcao>
        )}
        <ItemAcao icon={TrashIcon} onClick={onExcluir} destrutivo>
          Excluir
        </ItemAcao>
      </Transition>
    </Menu>
  );
}

function ItemAcao({
  icon: Icon,
  onClick,
  destrutivo,
  children,
}: {
  icon: React.ElementType;
  onClick: () => void;
  destrutivo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <MenuItem>
      {({ focus }) => (
        <button
          type="button"
          onClick={onClick}
          className={clsx(
            "flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm transition-colors",
            destrutivo
              ? "this:error text-this dark:text-this-light"
              : "dark:text-dark-100 text-gray-700",
            focus &&
              (destrutivo
                ? "bg-this/10 dark:bg-this-light/10"
                : "dark:bg-dark-600 bg-gray-100"),
          )}
        >
          <Icon className="size-4" />
          {children}
        </button>
      )}
    </MenuItem>
  );
}

// ----------------------------------------------------------------------
// Modal de criar/editar — mesmo Dialog do "Nova regra" (Memoria.tsx).

/** Valor do <Select> para "Toda a organização" (o <option> não aceita null). */
const TODA_ORG = "";

function DirecionamentoModal({
  estado,
  onClose,
  onSalvar,
}: {
  estado: ModalEstado;
  onClose: () => void;
  onSalvar: (input: DirecionamentoInput & { ativo?: boolean }) => Promise<void>;
}) {
  const aberto = estado.modo !== "fechado";
  const editando = estado.modo === "editar" ? estado.item : null;

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<DirecionamentoTipo>("priorizar_assunto");
  const [instrucao, setInstrucao] = useState("");
  // Sem campo na tela: valores padrão na criação, os já salvos na edição.
  const [areaId, setAreaId] = useState<string>(TODA_ORG);
  const [prioridade, setPrioridade] =
    useState<DirecionamentoPrioridade>("normal");
  const [ativo, setAtivo] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcoesFoco | null>(null);

  // Preenche ao abrir (edição, sugestão do feedback ou vazio). Derivado no
  // render quando `estado` muda, no padrão "ajustar estado ao mudar prop".
  const [estadoVisto, setEstadoVisto] = useState<ModalEstado>({
    modo: "fechado",
  });
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (estado.modo !== "fechado") {
      const base: Partial<DirecionamentoInput> =
        estado.modo === "editar"
          ? {
              nome: estado.item.nome,
              tipo: estado.item.tipo,
              instrucao: estado.item.instrucao,
              areaId: estado.item.area?.id ?? null,
              prioridade: estado.item.prioridade,
            }
          : (estado.inicial ?? {});
      setNome(base.nome ?? "");
      setTipo(base.tipo ?? "priorizar_assunto");
      setInstrucao(base.instrucao ?? "");
      setAreaId(base.areaId ?? TODA_ORG);
      setPrioridade(base.prioridade ?? "normal");
      setAtivo(estado.modo === "editar" ? estado.item.ativo : true);
      setOpcoes(null);
    }
  }

  // Busca as áreas que ESTE usuário pode escolher — o servidor valida de novo.
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    opcoesFocoApi()
      .then((o) => {
        if (!vivo) return;
        setOpcoes(o);
        // Sem "toda a organização", o foco padrão é a (única) área permitida.
        if (estado.modo === "criar" && !o.podeTodaOrganizacao) {
          setAreaId(o.areas[0]?.id ?? TODA_ORG);
        }
      })
      .catch(() => vivo && setOpcoes({ podeTodaOrganizacao: true, areas: [] }));
    return () => {
      vivo = false;
    };
  }, [aberto, estado]);

  const opcoesSelect = useMemo(() => {
    const lista: { label: string; value: string }[] = [];
    if (opcoes?.podeTodaOrganizacao)
      lista.push({ label: "Toda a organização", value: TODA_ORG });
    for (const a of opcoes?.areas ?? [])
      lista.push({ label: a.nome, value: a.id });
    // Editando um item cuja área saiu das opções (desativada): mantém visível.
    const atual = editando?.area;
    if (atual && !lista.some((o) => o.value === atual.id))
      lista.push({ label: `${atual.nome} (inativa)`, value: atual.id });
    return lista;
  }, [opcoes, editando]);

  const semFoco = opcoes != null && opcoesSelect.length === 0;
  const meta = DIRECIONAMENTO_TIPOS.find((t) => t.value === tipo)!;
  const podeSalvar =
    nome.trim().length > 0 &&
    instrucao.trim().length > 0 &&
    opcoes != null &&
    !semFoco &&
    !salvando;

  const enviar = async () => {
    setSalvando(true);
    try {
      await onSalvar({
        nome: nome.trim(),
        tipo,
        instrucao: instrucao.trim(),
        areaId: areaId === TODA_ORG ? null : areaId,
        prioridade,
        ...(editando ? { ativo } : {}),
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Transition show={aberto}>
      <Dialog onClose={onClose} className="relative z-60">
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
            <DialogPanel className="dark:bg-dark-750 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="dark:bg-primary-500/15 bg-primary-50 grid size-10 shrink-0 place-items-center rounded-xl">
                    <AdjustmentsHorizontalIcon className="text-primary-600 dark:text-primary-400 size-5.5" />
                  </span>
                  <div>
                    <DialogTitle className="dark:text-dark-50 text-base font-semibold text-gray-800">
                      {editando ? "Editar orientação" : "Nova orientação"}
                    </DialogTitle>
                    <p className="dark:text-dark-300 text-xs-plus text-gray-500">
                      Oriente o que a IA deve observar nas próximas análises.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={onClose}
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
                  label="Nome"
                  value={nome}
                  maxLength={DIRECIONAMENTO_MAX_NOME}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Turnover em Produto"
                  description="Use um nome que facilite identificar esta orientação."
                />

                {/* "O que você deseja fazer?" saiu do formulário. O tipo segue
                    no dado: Priorizar assunto por padrão, Ajustar insights
                    quando vem de um 👎, e o já salvo na edição. */}
                <Textarea
                  label={meta.labelInstrucao}
                  rows={4}
                  value={instrucao}
                  maxLength={DIRECIONAMENTO_MAX_INSTRUCAO}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setInstrucao(e.target.value)
                  }
                  placeholder={meta.placeholderInstrucao}
                />

                {/* "Onde observar?" e "Prioridade" saíram do formulário. O
                    foco segue o padrão permitido ao usuário (toda a
                    organização, ou a própria área para quem não administra a
                    conta — o servidor exige) e a prioridade é Normal; na
                    edição, os dois ficam como já estavam. */}
                {semFoco && (
                  <p className="dark:border-dark-500 dark:bg-dark-800 dark:text-dark-200 text-xs-plus rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600">
                    Você ainda não está vinculado a uma área. Fale com um
                    administrador da organização.
                  </p>
                )}

                {editando && (
                  <div className="dark:border-dark-500 flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
                    <div>
                      <p className="dark:text-dark-100 text-sm font-medium text-gray-700">
                        Ativo
                      </p>
                      <p className="dark:text-dark-300 text-xs-plus text-gray-500">
                        Inativo continua salvo, mas não orienta novas análises.
                      </p>
                    </div>
                    <Switch
                      checked={ativo}
                      onChange={() => setAtivo((v) => !v)}
                      color="success"
                      aria-label="Orientação ativa"
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outlined"
                  className="rounded-lg"
                  onClick={onClose}
                >
                  Cancelar
                </Button>
                <Button
                  color="primary"
                  className="gap-1.5 rounded-lg"
                  disabled={!podeSalvar}
                  onClick={() => void enviar()}
                >
                  {salvando ? (
                    <Spinner color="primary" className="size-4" />
                  ) : editando ? null : (
                    <PlusIcon className="size-4.5" />
                  )}
                  {editando ? "Salvar alterações" : "Salvar orientação"}
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
