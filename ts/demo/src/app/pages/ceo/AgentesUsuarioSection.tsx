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
  excluirAgenteOrganizacaoApi,
  excluirAgenteSistemaOrganizacaoApi,
  listarAgentesApi,
  type AgentePessoal,
  type AgenteSistema,
} from "@/services/api/agentes";
import { SectionCard } from "./configuracoes-ui";
import { AgenteFormModal } from "./AgenteFormModal";
import {
  useDonoRepositorio,
  usePodeGerenciarRepositorio,
} from "./repositorio-org/useDocumentosOrg";

// ----------------------------------------------------------------------
// Configurações de usuário → Agentes e Configurações da organização → IA →
// Agentes. A MESMA tela nos dois lugares; `escopo` diz de quem são os agentes
// personalizados — do usuário ou da organização ativa.
//
// Na organização, criar/editar/excluir segue o papel (mesmo funil do
// Repositório da organização): admin gerencia, usuário comum só vê.
//
// Dois tipos de agente, os dois chamados por @menção no Assistente:
// - ORGANIZAÇÃO: os pré-programados (catálogo do sistema, configuração
//   protegida) e os criados pelos admins. Visíveis a todos da organização; só
//   aparecem na tabela da organização.
// - PERSONALIZADO: os criados pelo próprio usuário. Só ele vê; só aparecem na
//   tabela de Configurações de usuário.
//
// Salvar/excluir recarrega o AgentesProvider: o "@" do Assistente reflete na
// hora. Excluir não toca nas conversas: as respostas antigas guardam o nome.

const TH =
  "dark:text-dark-200 px-3 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase";
const LINHA = "dark:border-dark-600 border-b border-gray-100 last:border-0";

type Escopo = "pessoal" | "organizacao";

/** Linha da tabela; `sistemaId` marca um agente pré-programado. */
type Linha = AgentePessoal & { sistemaId?: string };

const COPIA: Record<
  Escopo,
  { descricao: string; vazio: string; vazioLeitura: string }
> = {
  pessoal: {
    descricao:
      "Crie e configure especialistas para ajudar em tarefas específicas nas conversas com o Assistente.",
    vazio:
      "Você ainda não criou agentes. Use “Criar agente” para montar um especialista com as suas instruções e chamá-lo com @menção no Assistente.",
    vazioLeitura: "",
  },
  organizacao: {
    descricao:
      "Crie e configure especialistas para toda a organização usar em tarefas específicas nas conversas com o Assistente.",
    vazio:
      "A organização ainda não tem agentes. Use “Criar agente” para montar um especialista que todos possam chamar com @menção no Assistente.",
    vazioLeitura: "A organização ainda não tem agentes.",
  },
};

/** Configurações da organização → IA → Agentes. */
export function AgentesOrganizacaoSection() {
  return <AgentesUsuarioSection escopo="organizacao" />;
}

export function AgentesUsuarioSection({
  escopo = "pessoal",
}: {
  escopo?: Escopo;
} = {}) {
  const { recarregar } = useAgentes();
  const dono = useDonoRepositorio();
  const papelGerencia = usePodeGerenciarRepositorio();
  const podeGerenciar = escopo === "pessoal" || papelGerencia;
  const copia = COPIA[escopo];
  const [sistema, setSistema] = useState<AgenteSistema[]>([]);
  const [meus, setMeus] = useState<AgentePessoal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [form, setForm] = useState<{ agente: Linha | null } | null>(null);
  const [excluindo, setExcluindo] = useState<Linha | null>(null);
  const [estadoConfirm, setEstadoConfirm] = useState<ModalState>("pending");
  const [confirmando, setConfirmando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await listarAgentesApi(escopo === "organizacao" ? dono : null);
      // Os pré-programados são agentes da ORGANIZAÇÃO: só entram nessa tabela.
      setSistema(escopo === "organizacao" ? r.sistema : []);
      setMeus(escopo === "organizacao" ? r.organizacao : r.meus);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar os agentes.");
    } finally {
      setCarregando(false);
    }
  }, [escopo, dono]);

  useEffect(() => {
    void (async () => {
      await carregar();
    })();
  }, [carregar]);

  // Uma lista só: os criados (editáveis) e, na organização, os
  // pré-programados — que também têm CRUD, mas por organização: editar cria a
  // versão própria dela e excluir só os tira dela (o catálogo não muda).
  const linhas: Linha[] = [
    ...meus,
    ...sistema.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      mencao: a.mencao,
      descricao: a.descricao,
      instrucoes: "",
      icone: a.icone,
      atualizadoEm: "",
      sistemaId: a.id,
    })),
  ];

  const aposMudanca = async () => {
    await Promise.all([carregar(), recarregar()]);
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    setConfirmando(true);
    try {
      if (escopo === "organizacao") {
        if (!dono) throw new Error("Nenhuma organização ativa.");
        if (excluindo.sistemaId) {
          await excluirAgenteSistemaOrganizacaoApi(dono, excluindo.sistemaId);
        } else {
          await excluirAgenteOrganizacaoApi(dono, excluindo.id);
        }
      } else {
        await excluirAgenteApi(excluindo.id);
      }
      setEstadoConfirm("success");
      void aposMudanca();
    } catch {
      setEstadoConfirm("error");
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <SectionCard titulo="Agentes" descricao={copia.descricao}>
      {podeGerenciar && (
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
      )}

      {carregando ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-5" />
        </div>
      ) : erro ? (
        <p className="text-xs-plus text-warning py-6 text-center">{erro}</p>
      ) : (
        <>
          {/* Na organização: os criados pelos admins e, depois, os
              pré-programados — todos do tipo Organização, todos com CRUD
              para quem gerencia. No usuário: só os dele, do tipo
              Personalizado.

              Layout FIXO, com a largura de cada coluna definida aqui: a mesma
              tabela aparece em Configurações de usuário e da organização, e
              com largura automática as colunas mudavam conforme o conteúdo
              (badge, menu de ações) — e a coluna de Ações saía da área
              visível. O nome quebra em até duas linhas; a
              menção trunca (texto inteiro no tooltip); a descrição fica com o
              espaço que sobra. */}
          <div className="dark:border-dark-600 mt-4 overflow-x-auto rounded-xl border border-gray-200">
            <Table
              hoverable
              className="w-full min-w-[640px] table-fixed text-left"
            >
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[17%]" />
                <col />
                <col className="w-32" />
                <col className="w-10" />
              </colgroup>
              <THead>
                <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                  {["Nome", "Menção", "Descrição", "Tipo"].map((t) => (
                    <Th key={t} className={clsx(TH, "truncate")}>
                      {t}
                    </Th>
                  ))}
                  <Th className="px-3 py-3">
                    <span className="sr-only">Ações</span>
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {linhas.map((a) => (
                  <Tr
                    key={a.id}
                    className={clsx(LINHA, podeGerenciar && "cursor-pointer")}
                    onClick={
                      podeGerenciar ? () => setForm({ agente: a }) : undefined
                    }
                  >
                    <Td className="px-3 py-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <AgenteAvatar
                          titulo={a.titulo}
                          icone={a.icone}
                          tamanho="md"
                        />
                        <span
                          className="dark:text-dark-100 line-clamp-2 min-w-0 text-sm font-medium break-words whitespace-normal text-gray-800"
                          title={a.titulo}
                        >
                          {a.titulo}
                        </span>
                      </span>
                    </Td>
                    <Td
                      className="dark:text-dark-200 truncate px-3 py-3 font-mono text-xs text-gray-600"
                      title={`@${a.mencao}`}
                    >
                      @{a.mencao}
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus px-3 py-3 whitespace-normal text-gray-600">
                      {a.descricao ? (
                        <span className="line-clamp-2" title={a.descricao}>
                          {a.descricao}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </Td>
                    <Td className="px-3 py-3">
                      {/* Pré-programado também é tipo Organização. */}
                      <BadgeTipo
                        escopo={a.sistemaId ? "organizacao" : escopo}
                      />
                    </Td>
                    <Td className="px-3 py-3">
                      {podeGerenciar && (
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
                      )}
                    </Td>
                  </Tr>
                ))}
                {linhas.length === 0 && (
                  <Tr>
                    <Td
                      colSpan={5}
                      className="dark:text-dark-300 px-3 py-8 text-center text-xs whitespace-normal text-gray-500"
                    >
                      {podeGerenciar ? copia.vazio : copia.vazioLeitura}
                    </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
          </div>
        </>
      )}

      {form && (
        <AgenteFormModal
          key={form.agente?.id ?? "novo"}
          open
          agente={form.agente}
          sistemaId={form.agente?.sistemaId}
          escopo={escopo}
          dono={dono}
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
            description: excluindo?.sistemaId
              ? `@${excluindo.mencao} deixa de estar disponível nesta organização. As outras organizações não são afetadas, e as conversas em que “${excluindo.titulo}” já respondeu continuam como estão.`
              : `@${excluindo?.mencao ?? ""} deixa de poder ser mencionado. As conversas em que “${excluindo?.titulo ?? ""}” já respondeu continuam como estão.`,
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

/** Tipo do agente: Organização (todos da organização veem) ou Personalizado (só o usuário). */
function BadgeTipo({ escopo }: { escopo: Escopo }) {
  return escopo === "organizacao" ? (
    <Badge color="info" variant="soft" className="rounded-full">
      Organização
    </Badge>
  ) : (
    <Badge color="success" variant="soft" className="rounded-full">
      Personalizado
    </Badge>
  );
}

function MenuAgente({
  agente,
  onEditar,
  onExcluir,
}: {
  agente: Linha;
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
