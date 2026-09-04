// Import Dependencies
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import {
  ChevronDownIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState, type ReactNode } from "react";
import clsx from "clsx";

// Local Imports
import { Avatar, Badge, Button, ScrollShadow } from "@/components/ui";
import { rotuloArea, rotuloCargo } from "./membros-status";
import type { Membro } from "@/services/api/membros";
import { STATUS_MEMBRO } from "./membros-status";
import { equipeDireta } from "./hierarquia-membros";
import { TOTAL_PERMISSOES } from "@/app/data/permissoes";
import { MatrizPermissoes } from "./MatrizPermissoes";

// ----------------------------------------------------------------------
// Tela 03 — detalhe do membro, no drawer lateral direito (mesma casca do
// ConnectorDrawer em Conectores.tsx).
//
// O corpo é uma pilha de <Secao>. As próximas versões entram como seções
// irmãs — Role e Permissões, Escopo de acesso — sem reconstruir a tela, que foi
// o que permitiu a V2 acrescentar Gestor direto e Equipe direta aqui.
// ----------------------------------------------------------------------

export function MembroDrawer({
  membro,
  membros,
  close,
  onEditar,
  onAbrirMembro,
}: {
  /** Nulo = fechado. */
  membro: Membro | null;
  /** Lista completa, de onde a equipe direta é derivada. */
  membros: Membro[];
  close: () => void;
  onEditar: () => void;
  /** Navegar para outro membro dentro do próprio drawer. */
  onAbrirMembro: (membro: Membro) => void;
}) {
  const status = membro ? STATUS_MEMBRO[membro.status] : undefined;
  // Derivada das relações, nunca cadastrada: quem aponta este membro como
  // gestor. É por isso que não existe um segundo cadastro de subordinados.
  const equipe = membro ? equipeDireta(membros, membro.id) : [];
  // Permissões ficam recolhidas: o resumo responde "quanto acesso" e quem
  // precisa do detalhe abre. Só leitura — para mudar, mudam-se as roles.
  const [verPermissoes, setVerPermissoes] = useState(false);

  return (
    <Transition show={!!membro}>
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
          {membro && status && (
            <>
              {/* Cabeçalho */}
              <div className="dark:border-dark-600 flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    size={14}
                    name={membro.nome}
                    initialColor="auto"
                    classNames={{ display: "rounded-2xl" }}
                  />
                  <div className="min-w-0">
                    <DialogTitle className="dark:text-dark-50 truncate text-base font-semibold text-gray-800">
                      {membro.nome}
                    </DialogTitle>
                    <p className="dark:text-dark-300 text-xs-plus truncate text-gray-500">
                      {rotuloCargo(membro) || "Sem cargo definido"}
                    </p>
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
                  <Secao titulo="Informações pessoais">
                    <Campo rotulo="Nome" valor={membro.nome} />
                    <Campo rotulo="E-mail" valor={membro.email} />
                    <Campo rotulo="Status">
                      <div className="flex flex-col items-start gap-1">
                        <Badge
                          color={status.cor}
                          variant="soft"
                          className="rounded-full"
                        >
                          {status.rotulo}
                        </Badge>
                        <span className="dark:text-dark-300 text-xs text-gray-400">
                          {status.descricao}
                        </span>
                      </div>
                    </Campo>
                  </Secao>

                  <Secao titulo="Estrutura organizacional">
                    <Campo
                      rotulo="Área"
                      valor={rotuloArea(membro) || "Sem área definida"}
                    />
                    <Campo
                      rotulo="Cargo"
                      valor={rotuloCargo(membro) || "Sem cargo definido"}
                    />
                    <Campo rotulo="Gestor direto">
                      {membro.gestor ? (
                        <div className="flex min-w-0 flex-col items-end gap-0.5">
                          <span className="dark:text-dark-100 text-xs-plus text-right break-words text-gray-800">
                            {membro.gestor.nome}
                          </span>
                          {rotuloCargo(membro.gestor) && (
                            <span className="dark:text-dark-300 text-xs text-gray-400">
                              {rotuloCargo(membro.gestor)}
                            </span>
                          )}
                          {/* Gestor inativo é sinalizado, nunca desfeito
                              automaticamente: a relação histórica fica, e o
                              Owner/Admin decide se troca. */}
                          {membro.gestor.status === "inativo" && (
                            <Badge
                              color="warning"
                              variant="soft"
                              className="mt-0.5 rounded-full"
                            >
                              Gestor inativo
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="dark:text-dark-300 text-xs-plus text-right text-gray-400">
                          Nenhum — topo da estrutura
                        </span>
                      )}
                    </Campo>
                  </Secao>

                  {/* Acesso — o que a pessoa pode fazer. Separado da estrutura
                      de propósito: cargo e gestor não determinam a role. */}
                  <Secao titulo="Acesso">
                    <Campo rotulo={membro.roles.length > 1 ? "Roles" : "Role"}>
                      {membro.roles.length > 0 ? (
                        <div className="flex min-w-0 flex-col items-end gap-0.5">
                          {membro.roles.map((r) => (
                            <span
                              key={r.id}
                              className="dark:text-dark-100 text-xs-plus text-right text-gray-800"
                            >
                              {r.nome}
                              {r.tipo === "sistema" && (
                                <span className="dark:text-dark-300 ml-1 text-xs text-gray-400">
                                  · sistema
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="dark:text-dark-300 text-xs-plus text-right text-gray-400">
                          Nenhuma role atribuída
                        </span>
                      )}
                    </Campo>
                    <Campo rotulo="Permissões">
                      {membro.roles.length > 0 ? (
                        <span className="dark:text-dark-100 text-xs-plus text-right text-gray-800">
                          {/* A UNIÃO calculada pelo backend, não a soma dos
                              arrays: com duas roles as permissões se repetem, e
                              somar daria um número maior que o total. */}
                          {membro.permissoesEfetivas.length} de{" "}
                          {TOTAL_PERMISSOES}
                        </span>
                      ) : (
                        <span className="dark:text-dark-300 text-xs-plus text-right text-gray-400">
                          —
                        </span>
                      )}
                    </Campo>
                    {membro.roles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setVerPermissoes((v) => !v)}
                        aria-expanded={verPermissoes}
                        className="dark:hover:bg-dark-600 flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-gray-50"
                      >
                        <span className="text-primary-600 dark:text-primary-400 text-xs-plus">
                          {verPermissoes
                            ? "Ocultar permissões"
                            : "Ver permissões"}
                        </span>
                        <ChevronDownIcon
                          className={clsx(
                            "text-primary-600 dark:text-primary-400 size-4 transition-transform",
                            verPermissoes && "rotate-180",
                          )}
                        />
                      </button>
                    )}
                  </Secao>

                  {membro.roles.length > 0 && verPermissoes && (
                    <section>
                      <p className="dark:text-dark-300 text-xs-plus mb-3 text-gray-500">
                        {membro.roles.length > 1
                          ? "Permissões efetivas de "
                          : "Permissões herdadas de "}
                        <strong className="dark:text-dark-100 text-gray-700">
                          {membro.roles.map((r) => r.nome).join(" e ")}
                        </strong>
                        {membro.roles.length > 1
                          ? ": a soma das duas roles, sem repetição. Se qualquer uma concede, a pessoa pode."
                          : ". Para alterar, edite a role — não há permissão individual por membro."}
                      </p>
                      {/* A matriz é somente leitura sem `onChange`, e recebe um
                          conjunto — então nenhuma permissão aparece duas vezes,
                          mesmo quando as duas roles concedem a mesma. */}
                      <MatrizPermissoes
                        selecionadas={membro.permissoesEfetivas}
                      />
                    </section>
                  )}

                  {/* Equipe direta — derivada de quem aponta este membro como
                      gestor. Não existe cadastro manual de subordinados. */}
                  <Secao
                    titulo={`Equipe direta${equipe.length > 0 ? ` (${equipe.length})` : ""}`}
                  >
                    {equipe.length === 0 ? (
                      <p className="dark:text-dark-300 text-xs-plus px-3.5 py-3 text-gray-400">
                        Ninguém responde a este membro no momento.
                      </p>
                    ) : (
                      equipe.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onAbrirMembro(sub)}
                          className="dark:hover:bg-dark-600 flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-gray-50"
                        >
                          <Avatar
                            size={8}
                            name={sub.nome}
                            initialColor="auto"
                            classNames={{ display: "text-tiny-plus" }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="dark:text-dark-100 text-xs-plus block truncate text-gray-800">
                              {sub.nome}
                            </span>
                            <span className="dark:text-dark-300 block truncate text-xs text-gray-400">
                              {rotuloCargo(sub) || "Sem cargo definido"}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </Secao>
                </div>
              </ScrollShadow>

              {/* Rodapé */}
              <div className="dark:border-dark-600 shrink-0 border-t border-gray-200 px-5 py-4">
                <Button
                  color="primary"
                  className="w-full gap-2"
                  onClick={onEditar}
                >
                  <PencilSquareIcon className="size-4.5 stroke-[1.5]" />
                  Editar membro
                </Button>
              </div>
            </>
          )}
        </TransitionChild>
      </Dialog>
    </Transition>
  );
}

// ----------------------------------------------------------------------

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <p className="dark:text-dark-200 text-xs font-semibold tracking-wider text-gray-500 uppercase">
        {titulo}
      </p>
      <div className="dark:divide-dark-600 dark:border-dark-600 mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
        {children}
      </div>
    </section>
  );
}

function Campo({
  rotulo,
  valor,
  children,
}: {
  rotulo: string;
  valor?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
      <span className="dark:text-dark-300 text-xs-plus shrink-0 text-gray-500">
        {rotulo}
      </span>
      {children ?? (
        <span className="dark:text-dark-100 text-xs-plus min-w-0 text-right break-words text-gray-800">
          {valor}
        </span>
      )}
    </div>
  );
}
