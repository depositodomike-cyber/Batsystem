// Import Dependencies
import { useCallback, useEffect, useState } from "react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import {
  EllipsisVerticalIcon,
  LockClosedIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

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
import {
  ConfirmModal,
  type ModalState,
} from "@/components/shared/ConfirmModal";
import { AgenteAvatar } from "@/components/shared/AgenteAvatar";
import { useAgentes } from "@/app/contexts/agentes/context";
import {
  excluirAgenteApi,
  listarAgentesApi,
  type AgentePessoal,
  type AgenteSistema,
} from "@/services/api/agentes";
import { formatDate } from "@/utils/arquivos";
import { SectionCard } from "./configuracoes-ui";
import { AgenteFormModal } from "./AgenteFormModal";

// ----------------------------------------------------------------------
// Configurações de usuário → Agentes.
//
// Uma tabela com os agentes do SISTEMA (pré-programados, configuração
// protegida) e os PERSONALIZADOS do usuário (criar, editar, excluir), separados
// pela coluna Tipo. Os dois são chamados por @menção
// no Assistente. Agente pessoal é só de quem criou — não é compartilhado com
// a organização.
//
// Salvar/excluir recarrega o AgentesProvider: o "@" do Assistente reflete na
// hora. Excluir não toca nas conversas: as respostas antigas guardam o nome.

const TH = "dark:text-dark-200 px-3 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase";
const LINHA = "dark:border-dark-600 border-b border-gray-100 last:border-0";

export function AgentesUsuarioSection() {
  const { recarregar } = useAgentes();
  const [sistema, setSistema] = useState<AgenteSistema[]>([]);
  const [meus, setMeus] = useState<AgentePessoal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState<{ agente: AgentePessoal | null } | null>(
    null,
  );
  const [excluindo, setExcluindo] = useState<AgentePessoal | null>(null);
  const [estadoConfirm, setEstadoConfirm] = useState<ModalState>("pending");
  const [confirmando, setConfirmando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await listarAgentesApi();
      setSistema(r.sistema);
      setMeus(r.meus);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar os agentes.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await carregar();
    })();
  }, [carregar]);

  const aposMudanca = async () => {
    await Promise.all([carregar(), recarregar()]);
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    setConfirmando(true);
    try {
      await excluirAgenteApi(excluindo.id);
      setEstadoConfirm("success");
      void aposMudanca();
    } catch {
      setEstadoConfirm("error");
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <SectionCard
      titulo="Agentes"
      descricao="Crie e configure especialistas para ajudar em tarefas específicas nas conversas com o Assistente."
    >
      <div className="flex justify-end">
        <Button
          color="primary"
          onClick={() => setForm({ agente: null })}
          className="h-9 gap-1.5 rounded-lg px-3 text-xs"
        >
          <PlusIcon className="size-4" />
          Criar agente
        </Button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-5" />
        </div>
      ) : erro ? (
        <p className="text-xs-plus text-warning py-6 text-center">{erro}</p>
      ) : (
        <>
          {/* Uma tabela só: os do usuário primeiro (editáveis), depois os do
              sistema (protegidos). A coluna Tipo diz qual é qual. */}
          <div className="dark:border-dark-600 mt-4 overflow-x-auto rounded-xl border border-gray-200">
            <Table hoverable className="w-full min-w-2xl text-left">
              <THead>
                <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                  {["Nome", "Menção", "Descrição", "Tipo", "Atualizado em"].map(
                    (t) => (
                      <Th key={t} className={TH}>
                        {t}
                      </Th>
                    ),
                  )}
                  <Th className="w-12 px-3 py-3">
                    <span className="sr-only">Ações</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {meus.map((a) => (
                  <Tr
                    key={a.id}
                    className={clsx(LINHA, "cursor-pointer")}
                    onClick={() => setForm({ agente: a })}
                  >
                    <Td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <AgenteAvatar
                          titulo={a.titulo}
                          icone={a.icone}
                          tamanho="md"
                        />
                        <span className="dark:text-dark-100 text-sm font-medium text-gray-800">
                          {a.titulo}
                        </span>
                      </span>
                    </Td>
                    <Td className="px-3 dark:text-dark-200 py-3 font-mono text-xs text-gray-600">
                      @{a.mencao}
                    </Td>
                    <Td className="px-3 dark:text-dark-200 text-sm-plus py-3 whitespace-normal text-gray-600">
                      {a.descricao ? (
                        <span className="line-clamp-2 max-w-xs min-w-40">
                          {a.descricao}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </Td>
                    <Td className="px-3 py-3">
                      <Badge
                        color="success"
                        variant="soft"
                        className="rounded-full"
                      >
                        Personalizado
                      </Badge>
                    </Td>
                    <Td className="px-3 dark:text-dark-300 py-3 text-xs whitespace-nowrap text-gray-500">
                      {formatDate(a.atualizadoEm)}
                    </Td>
                    <Td className="px-3 py-3">
                      <div onClick={(e) => e.stopPropagation()}>
                        <MenuAgente
                          agente={a}
                          onEditar={() => setForm({ agente: a })}
                          onExcluir={() => {
                            setEstadoConfirm("pending");
                            setExcluindo(a);
                          }}
                        />
                      </div>
                    </Td>
                  </Tr>
                ))}
                {sistema.map((a) => (
                  <Tr key={a.id} className={LINHA}>
                    <Td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <AgenteAvatar
                          titulo={a.titulo}
                          icone={a.icone}
                          tamanho="md"
                        />
                        <span className="dark:text-dark-100 text-sm font-medium text-gray-800">
                          {a.titulo}
                        </span>
                      </span>
                    </Td>
                    <Td className="px-3 dark:text-dark-200 py-3 font-mono text-xs text-gray-600">
                      @{a.mencao}
                    </Td>
                    <Td className="px-3 dark:text-dark-200 text-sm-plus py-3 whitespace-normal text-gray-600">
                      <span className="line-clamp-2 max-w-xs min-w-40">
                        {a.descricao}
                      </span>
                    </Td>
                    <Td className="px-3 py-3">
                      {/* Pré-configurado: não edita nem exclui. */}
                      <Badge
                        color="info"
                        variant="soft"
                        className="gap-1 rounded-full"
                      >
                        <LockClosedIcon className="size-3" />
                        Sistema
                      </Badge>
                    </Td>
                    <Td className="px-3 py-3 text-xs text-gray-400">—</Td>
                    <Td className="px-3 py-3" />
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
          {meus.length === 0 && (
            <p className="dark:text-dark-300 mt-3 text-xs text-gray-500">
              Você ainda não criou agentes. Use “Criar agente” para montar um
              especialista com as suas instruções e chamá-lo com @menção no
              Assistente.
            </p>
          )}
        </>
      )}

      {form && (
        <AgenteFormModal
          key={form.agente?.id ?? "novo"}
          open
          agente={form.agente}
          onClose={() => setForm(null)}
          onSalvo={() => {
            setForm(null);
            void aposMudanca();
          }}
        />
      )}

      <ConfirmModal
        show={excluindo !== null}
        onClose={() => setExcluindo(null)}
        onOk={() => void confirmarExclusao()}
        confirmLoading={confirmando}
        state={estadoConfirm}
        messages={{
          pending: {
            title: "Excluir este agente?",
            description: `@${excluindo?.mencao ?? ""} deixa de poder ser mencionado. As conversas em que “${excluindo?.titulo ?? ""}” já respondeu continuam como estão.`,
            actionText: "Excluir",
          },
          success: {
            title: "Agente excluído",
            description: "Ele não aparece mais na lista nem no Assistente.",
            actionText: "Ok",
          },
          error: {
            title: "Não foi possível excluir",
            description: "Tente novamente em instantes.",
            actionText: "Tentar de novo",
          },
        }}
      />
    </SectionCard>
  );
}

// ----------------------------------------------------------------------

function MenuAgente({
  agente,
  onEditar,
  onExcluir,
}: {
  agente: AgentePessoal;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const item = (
    Icon: React.ElementType,
    texto: string,
    onClick: () => void,
    destrutivo = false,
  ) => (
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
          {texto}
        </button>
      )}
    </MenuItem>
  );

  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label={`Ações do agente ${agente.titulo}`}
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
        className="dark:bg-dark-750 dark:border-dark-500 z-100 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
      >
        {item(PencilSquareIcon, "Editar", onEditar)}
        {item(TrashIcon, "Excluir", onExcluir, true)}
      </Transition>
    </Menu>
  );
}
