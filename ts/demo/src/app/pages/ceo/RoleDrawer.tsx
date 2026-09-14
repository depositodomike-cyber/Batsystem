// Import Dependencies
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  LockClosedIcon,
  PencilSquareIcon,
  XMarkIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";

// Local Imports
import { Avatar, Badge, Button, ScrollShadow } from "@/components/ui";
import { TOTAL_PERMISSOES } from "@/app/data/permissoes";
import { rotuloCargo } from "./membros-status";
import type { Role } from "@/services/api/roles";
import type { Membro } from "@/services/api/membros";
import { MatrizPermissoes } from "./MatrizPermissoes";

// ----------------------------------------------------------------------
// Detalhe da role, no drawer lateral direito (mesma casca do MembroDrawer).
//
// As permissões aparecem em leitura, incluindo as NÃO concedidas — é o que
// deixa claro o alcance da role.
//
// O rodapé muda conforme a role: a Owner só admite transferir a propriedade, e
// as demais — incluindo Admin, Editor e Viewer — abrem o formulário de edição.
// A Owner é imutável porque é ela que garante que a organização nunca perca a
// titularidade; o alcance dela nunca é configurável por aqui.
// ----------------------------------------------------------------------

export function RoleDrawer({
  role,
  membros,
  close,
  onEditar,
  onTransferirPropriedade,
  onAbrirMembro,
}: {
  /** Nulo = fechado. */
  role: Role | null;
  /** Lista completa da organização, de onde saem os membros desta role. */
  membros: Membro[];
  close: () => void;
  onEditar: () => void;
  /** Única ação da role Owner. */
  onTransferirPropriedade: () => void;
  onAbrirMembro: (membro: Membro) => void;
}) {
  // Derivado da lista, não de um segundo cadastro.
  // `roleIds.includes`, e não `roleId ===`: com duas roles o campo de
  // compatibilidade vem nulo, e a lista mostraria menos gente que a contagem da
  // aba Acesso.
  const comEstaRole = role
    ? membros.filter((m) => m.roleIds.includes(role.id))
    : [];

  return (
    <Transition show={!!role}>
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
          {role && (
            <>
              {/* Cabeçalho */}
              <div className="dark:border-dark-600 flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div className="min-w-0">
                  <DialogTitle className="dark:text-dark-50 truncate text-base font-semibold text-gray-800">
                    {role.nome}
                  </DialogTitle>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      color={role.editavel ? "neutral" : "info"}
                      variant="soft"
                      className="gap-1 rounded-full"
                    >
                      {!role.editavel && <LockClosedIcon className="size-3" />}
                      {!role.editavel
                        ? "Role do sistema"
                        : role.tipo === "sistema"
                          ? "Padrão da plataforma"
                          : "Personalizada"}
                    </Badge>
                    <span className="dark:text-dark-300 text-xs text-gray-400">
                      {role.permissoes.length} de {TOTAL_PERMISSOES} permissões
                    </span>
                  </div>
                </div>
                <Button
                  onClick={close}
                  variant="flat"
                  isIcon
                  aria-label="Fechar"
                  className="size-7 shrink-0 rounded-lg"
                >
                  <XMarkIcon className="size-4.5" />
                </Button>
              </div>

              <ScrollShadow className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-5">
                  {role.descricao && (
                    <section>
                      <p className="dark:text-dark-200 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                        Descrição
                      </p>
                      <p className="dark:text-dark-100 text-xs-plus mt-2 text-gray-700">
                        {role.descricao}
                      </p>
                    </section>
                  )}

                  {!role.editavel && (
                    <p className="dark:border-dark-600 dark:text-dark-200 text-xs-plus rounded-xl border border-gray-200 px-3.5 py-2.5 text-gray-600">
                      {role.proprietaria ? (
                        <>
                          Este é o acesso do proprietário da organização: não
                          pode ser editado, desativado nem excluído, e pertence
                          a um único colaborador. Para mudar de proprietário,
                          use &ldquo;Transferir propriedade&rdquo;.
                        </>
                      ) : (
                        // Sem a frase "pertence a um único membro", que é
                        // verdade só da Owner: a Convidado pertence a TODOS os
                        // membros do tipo convidado.
                        <>
                          Este é o acesso dos colaboradores convidados: não pode
                          ser editado nem excluído, e é atribuído
                          automaticamente quando alguém é cadastrado como
                          convidado.
                        </>
                      )}
                    </p>
                  )}

                  <MatrizPermissoes selecionadas={role.permissoes} />

                  <section>
                    <p className="dark:text-dark-200 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                      Colaboradores com esta role
                      {comEstaRole.length > 0 && ` (${comEstaRole.length})`}
                    </p>
                    <div className="dark:divide-dark-600 dark:border-dark-600 mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
                      {comEstaRole.length === 0 ? (
                        <p className="dark:text-dark-300 text-xs-plus px-3.5 py-3 text-gray-400">
                          Nenhum colaborador usa esta role no momento.
                        </p>
                      ) : (
                        comEstaRole.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onAbrirMembro(m)}
                            className="dark:hover:bg-dark-600 flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-gray-50"
                          >
                            <Avatar
                              size={8}
                              name={m.nome}
                              initialColor="auto"
                              classNames={{ display: "text-tiny-plus" }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="dark:text-dark-100 text-xs-plus block truncate text-gray-800">
                                {m.nome}
                              </span>
                              <span className="dark:text-dark-300 block truncate text-xs text-gray-400">
                                {rotuloCargo(m) || "Sem cargo definido"}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </ScrollShadow>

              {/* Rodapé — a Owner troca "Editar" por "Transferir": é a única
                  operação que ela admite. A Convidado não tem ação nenhuma, e
                  aí some a FAIXA inteira, não só o botão: uma borda superior
                  com nada dentro é artefato visual. */}
              {(role.editavel || role.proprietaria) && (
                <div className="dark:border-dark-600 shrink-0 border-t border-gray-200 px-5 py-4">
                  {role.proprietaria ? (
                    <Button
                      color="primary"
                      className="w-full gap-2"
                      onClick={onTransferirPropriedade}
                    >
                      <ArrowsRightLeftIcon className="size-4.5 stroke-[1.5]" />
                      Transferir propriedade
                    </Button>
                  ) : (
                    <Button
                      color="primary"
                      className="w-full gap-2"
                      onClick={onEditar}
                    >
                      <PencilSquareIcon className="size-4.5 stroke-[1.5]" />
                      Editar acesso
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}
