// Import Dependencies
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import {
  CheckIcon,
  ChevronRightIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/20/solid";
import {
  FolderArrowDownIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { ElementType, Fragment, KeyboardEvent, useState } from "react";
import { NavLink } from "react-router";

// Local Imports
import { Badge } from "@/components/ui";
import {
  ConfirmModal,
  type ConfirmMessages,
} from "@/components/shared/ConfirmModal";
import { DISABLED_MENU_CLASS } from "@/app/data/temporarilyDisabledFeatures";

// ----------------------------------------------------------------------

interface SidebarListItemProps {
  /** Rota de destino do item. */
  to: string;
  /** Título exibido (e editável). */
  title: string;
  /** Ícone à esquerda. */
  icon: ElementType;
  /** Disparado ao navegar (ex.: fechar o sidebar no mobile). */
  onNavigate: () => void;
  /** Persiste o novo título. */
  onRename: (title: string) => void;
  /** Remove o item. */
  onDelete: () => void;
  /** Rótulo acessível para o input de renomeação. */
  renameLabel: string;
  /** Mensagens do modal de confirmação de exclusão. */
  confirmMessages: ConfirmMessages;
  /**
   * Grupos (agrupamentos) para os quais o item pode ser movido. Quando
   * informado junto de `onMoveToGroup`, exibe a opção "Mudar para o grupo".
   */
  groups?: { id: string; title: string }[];
  /** Move o item para o grupo informado (ou remove, quando null). */
  onMoveToGroup?: (groupId: string | null) => void;
  /** Grupo atual do item, marcado com check na lista. */
  currentGroupId?: string;
  /** Rótulo opcional exibido como badge antes do menu (ex.: nome do squad). */
  badge?: string;
  /**
   * Quando true, o item fica visível e opaco, sem navegação nem ações
   * (desabilitação temporária — ver temporarilyDisabledFeatures).
   */
  disabled?: boolean;
}

export function SidebarListItem({
  to,
  title,
  icon: Icon,
  onNavigate,
  onRename,
  onDelete,
  renameLabel,
  confirmMessages,
  groups,
  onMoveToGroup,
  currentGroupId,
  badge,
  disabled = false,
}: SidebarListItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showGroups, setShowGroups] = useState(false);

  const canMove = typeof onMoveToGroup === "function";

  const startRename = () => {
    setDraft(title);
    setIsRenaming(true);
  };

  const commitRename = () => {
    const value = draft.trim();
    if (value && value !== title) onRename(value);
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setDraft(title);
    setIsRenaming(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  const openDelete = () => setDeleteOpen(true);

  // Ao confirmar, o item é removido da lista e este componente (chaveado por id)
  // desmonta junto com o modal — por isso basta o estado "pending".
  const confirmDelete = () => {
    setDeleteOpen(false);
    onDelete();
  };

  if (isRenaming && !disabled) {
    return (
      <div className="px-3">
        <input
          autoFocus
          value={draft}
          aria-label={renameLabel}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitRename}
          className="border-primary-500 focus:border-primary-500 dark:border-primary-500 dark:bg-dark-700 dark:text-dark-100 w-full rounded-md border bg-white px-3 py-1 text-xs font-medium tracking-wide text-gray-800 outline-hidden focus:ring-0"
        />
      </div>
    );
  }

  const itemBody = (isActive: boolean) => (
    <>
      <div
        data-menu-active={disabled ? false : isActive}
        className="flex min-w-0 items-center gap-2.5 text-xs tracking-wide"
      >
        <Icon
          className={clsx(
            "size-4.5 shrink-0 stroke-[1.5]",
            !disabled && !isActive && "opacity-80 group-hover:opacity-100",
          )}
        />
        <span className="truncate">{title}</span>
      </div>
      {!disabled && isActive && (
        <div className="bg-primary-600 dark:bg-primary-400 absolute top-1 bottom-1 w-1 ltr:left-0 ltr:rounded-r-full rtl:right-0 rtl:rounded-l-lg" />
      )}
    </>
  );

  return (
    <>
      <div className="group/item relative flex items-center px-3">
        {disabled ? (
          <div
            aria-disabled="true"
            className={clsx(
              "dark:text-dark-200 min-w-0 flex-1 rounded-md py-1 pr-1 pl-3 font-medium text-gray-800 outline-hidden",
              DISABLED_MENU_CLASS,
            )}
          >
            {itemBody(false)}
          </div>
        ) : (
          <NavLink
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "group min-w-0 flex-1 rounded-md py-1 pr-1 pl-3 font-medium outline-hidden transition-colors ease-in-out",
                isActive
                  ? "text-primary-600 dark:text-primary-400"
                  : "dark:text-dark-200 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 dark:focus:bg-dark-300/10 text-gray-800 hover:bg-gray-100 hover:text-gray-950 focus:bg-gray-100 focus:text-gray-950",
              )
            }
          >
            {({ isActive }) => itemBody(isActive)}
          </NavLink>
        )}

        {badge && (
          <Badge
            color="primary"
            variant="soft"
            className="mr-1 shrink-0 text-tiny"
          >
            {badge}
          </Badge>
        )}

        {!disabled && (
        <Menu as="div" className="shrink-0">
          {({ open }) => (
            <>
              <MenuButton
                aria-label="Ações do item"
                onClick={() => setShowGroups(false)}
                className={clsx(
                  "dark:text-dark-300 dark:hover:bg-dark-300/10 dark:hover:text-dark-50 grid size-6 place-items-center rounded-md text-gray-400 outline-hidden transition-all hover:bg-gray-200 hover:text-gray-700 focus:opacity-100",
                  open
                    ? "opacity-100"
                    : "opacity-0 group-focus-within/item:opacity-100 group-hover/item:opacity-100",
                )}
              >
                <EllipsisHorizontalIcon className="size-5" />
              </MenuButton>
              <Transition
                as={Fragment}
                enter="transition ease-out"
                enterFrom="opacity-0 translate-y-2"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-2"
              >
                <MenuItems
                  anchor={{ to: "bottom end", gap: 4 }}
                  className="dark:border-dark-500 dark:bg-dark-750 z-100 min-w-[9rem] rounded-lg border border-gray-300 bg-white py-1 text-xs shadow-lg shadow-gray-200/50 outline-hidden focus-visible:outline-hidden dark:shadow-none"
                >
                  <MenuItem>
                    {({ focus }) => (
                      <button
                        onClick={startRename}
                        className={clsx(
                          "flex h-8 w-full items-center gap-2.5 px-3 tracking-wide outline-hidden transition-colors",
                          focus &&
                            "dark:bg-dark-600 dark:text-dark-100 bg-gray-100 text-gray-800",
                        )}
                      >
                        <PencilSquareIcon className="size-4 stroke-[1.5]" />
                        <span>Renomear</span>
                      </button>
                    )}
                  </MenuItem>

                  {canMove && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowGroups((v) => !v)}
                        className="dark:text-dark-100 dark:hover:bg-dark-600 flex h-8 w-full items-center gap-2.5 px-3 tracking-wide text-gray-800 outline-hidden transition-colors hover:bg-gray-100"
                      >
                        <FolderArrowDownIcon className="size-4 stroke-[1.5]" />
                        <span className="flex-1 text-start">
                          Mudar para o grupo
                        </span>
                        <ChevronRightIcon
                          className={clsx(
                            "size-4 transition-transform",
                            showGroups && "rotate-90",
                          )}
                        />
                      </button>

                      {showGroups && (
                        <div className="dark:border-dark-600 ml-4 border-l border-gray-200">
                          {!groups || groups.length === 0 ? (
                            <p className="dark:text-dark-400 px-3 py-1.5 text-tiny text-gray-400">
                              Nenhum grupo criado ainda.
                            </p>
                          ) : (
                            groups.map((g) => {
                              const active = g.id === currentGroupId;
                              return (
                                <MenuItem key={g.id}>
                                  {({ focus }) => (
                                    <button
                                      onClick={() => onMoveToGroup?.(g.id)}
                                      className={clsx(
                                        "flex h-8 w-full items-center gap-2.5 px-3 tracking-wide outline-hidden transition-colors",
                                        focus &&
                                          "dark:bg-dark-600 bg-gray-100",
                                        active
                                          ? "text-primary-600 dark:text-primary-400 font-medium"
                                          : "dark:text-dark-200 text-gray-700",
                                      )}
                                    >
                                      <span className="min-w-0 flex-1 truncate text-start">
                                        {g.title}
                                      </span>
                                      {active && (
                                        <CheckIcon className="size-4 shrink-0" />
                                      )}
                                    </button>
                                  )}
                                </MenuItem>
                              );
                            })
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <MenuItem>
                    {({ focus }) => (
                      <button
                        onClick={openDelete}
                        className={clsx(
                          "this:error text-this dark:text-this-light flex h-8 w-full items-center gap-2.5 px-3 tracking-wide outline-hidden transition-colors",
                          focus && "bg-this/10 dark:bg-this-light/10",
                        )}
                      >
                        <TrashIcon className="size-4 stroke-[1.5]" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </MenuItem>
                </MenuItems>
              </Transition>
            </>
          )}
        </Menu>
        )}
      </div>

      {!disabled && (
        <ConfirmModal
          show={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onOk={confirmDelete}
          messages={confirmMessages}
          state="pending"
        />
      )}
    </>
  );
}
