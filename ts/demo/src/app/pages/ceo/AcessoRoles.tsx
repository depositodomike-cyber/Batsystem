// Import Dependencies
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import {
  EllipsisVerticalIcon,
  EyeIcon,
  KeyIcon,
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
import { TOTAL_PERMISSOES } from "@/app/data/permissoes";
import type { Role } from "@/services/api/roles";

// ----------------------------------------------------------------------
// Aba "Acesso" da tela de Administração: listagem de roles.
//
// Componente de apresentação — os dados e os modais vivem em Administracao.tsx,
// porque a aba Membros lê a mesma lista de roles para o seletor do membro.
// ----------------------------------------------------------------------

export function AcessoRoles({
  roles,
  carregando,
  erroCarga,
  onRecarregar,
  onNova,
  onAbrirRole,
  onEditar,
  onExcluir,
}: {
  roles: Role[];
  carregando: boolean;
  erroCarga: string | null;
  onRecarregar: () => void;
  onNova: () => void;
  onAbrirRole: (role: Role) => void;
  onEditar: (role: Role) => void;
  onExcluir: (role: Role) => void;
}) {
  const personalizadas = roles.filter((r) => r.tipo === "personalizada").length;

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="dark:text-dark-300 text-xs-plus text-gray-500">
          {roles.length} {roles.length === 1 ? "role" : "roles"}
          {" · "}
          {personalizadas}{" "}
          {personalizadas === 1 ? "personalizada" : "personalizadas"}
        </p>
        <Button
          onClick={onNova}
          color="primary"
          className="h-9 shrink-0 gap-1.5 self-start rounded-lg px-3 lg:self-auto"
        >
          <PlusIcon className="size-4.5 stroke-[1.5]" />
          Nova role
        </Button>
      </div>

      {carregando ? (
        <div className="mt-8 grid place-items-center py-16">
          <Spinner color="primary" className="size-8" />
        </div>
      ) : erroCarga ? (
        <EstadoVazio
          titulo="Não foi possível carregar as roles"
          hint={erroCarga}
          acao={{ rotulo: "Tentar de novo", onClick: onRecarregar }}
        />
      ) : roles.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma role ainda"
          hint="Crie uma role para definir o que os membros podem fazer."
          acao={{ rotulo: "Nova role", onClick: onNova }}
        />
      ) : (
        <div className="dark:border-dark-600 mt-5 overflow-x-auto rounded-xl border border-gray-200">
          <Table hoverable className="w-full min-w-2xl text-left">
            <THead>
              <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                {["Role", "Permissões", "Membros", "Tipo"].map((titulo) => (
                  <Th
                    key={titulo}
                    className="dark:text-dark-200 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                  >
                    {titulo}
                  </Th>
                ))}
                <Th className="w-12 py-3">
                  <span className="sr-only">Ações</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {roles.map((r) => (
                <Tr
                  key={r.id}
                  className="dark:border-dark-600 cursor-pointer border-b border-gray-100 last:border-0"
                  onClick={() => onAbrirRole(r)}
                >
                  <Td className="py-3">
                    <div className="min-w-0">
                      <span className="dark:text-dark-100 block text-sm font-medium text-gray-800">
                        {r.nome}
                      </span>
                      {r.descricao && (
                        <span className="dark:text-dark-300 line-clamp-1 block max-w-md text-xs text-gray-400">
                          {r.descricao}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                    {r.permissoes.length} de {TOTAL_PERMISSOES}
                  </Td>
                  <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                    {r.membros > 0 ? (
                      r.membros
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Td>
                  <Td className="py-3">
                    <Badge
                      color={r.tipo === "sistema" ? "info" : "neutral"}
                      variant="soft"
                      className="gap-1 rounded-full"
                    >
                      {r.tipo === "sistema" && (
                        <LockClosedIcon className="size-3" />
                      )}
                      {r.tipo === "sistema" ? "Sistema" : "Personalizada"}
                    </Badge>
                  </Td>
                  <Td className="py-3">
                    {/* stopPropagation: a linha inteira abre o drawer. */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <RoleMenu
                        role={r}
                        onVisualizar={() => onAbrirRole(r)}
                        onEditar={() => onEditar(r)}
                        onExcluir={() => onExcluir(r)}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------

/**
 * Menu de ações da linha.
 *
 * Role de sistema só tem "Visualizar": editar e excluir não existem para ela,
 * e é melhor a opção não aparecer do que aparecer e recusar.
 */
function RoleMenu({
  role,
  onVisualizar,
  onEditar,
  onExcluir,
}: {
  role: Role;
  onVisualizar: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label={`Ações da role ${role.nome}`}
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
        className="dark:bg-dark-750 dark:border-dark-500 z-100 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-gray-200/60 outline-hidden dark:shadow-none"
      >
        <ItemMenu icon={EyeIcon} onClick={onVisualizar}>
          Visualizar role
        </ItemMenu>
        {role.editavel && (
          <>
            <ItemMenu icon={PencilSquareIcon} onClick={onEditar}>
              Editar role
            </ItemMenu>
            <ItemMenu icon={TrashIcon} onClick={onExcluir} destrutivo>
              Excluir role
            </ItemMenu>
          </>
        )}
      </Transition>
    </Menu>
  );
}

function ItemMenu({
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

function EstadoVazio({
  titulo,
  hint,
  acao,
}: {
  titulo: string;
  hint: string;
  acao: { rotulo: string; onClick: () => void };
}) {
  return (
    <div className="dark:border-dark-600 mt-8 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
      <KeyIcon className="dark:text-dark-400 size-10 text-gray-300" />
      <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
        {titulo}
      </p>
      <p className="dark:text-dark-300 text-xs-plus mt-1 text-gray-400">
        {hint}
      </p>
      <Button
        variant="outlined"
        className="mt-4 rounded-lg"
        onClick={acao.onClick}
      >
        {acao.rotulo}
      </Button>
    </div>
  );
}
