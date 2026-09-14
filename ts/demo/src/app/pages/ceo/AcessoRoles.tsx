// Import Dependencies
import { useMemo, useState } from "react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import {
  ArrowsRightLeftIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  KeyIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
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
// Aba "Acesso" da tela de Administração: listagem e CRUD dos acessos.
//
// Duas roles são protegidas e aparecem na lista como qualquer outra: a Owner,
// que só admite visualizar e transferir a propriedade, e a Convidado, que só
// admite visualizar — ela é atribuída pelo TIPO do membro, não escolhida aqui.
// Admin, Editor e Viewer são de sistema por ORIGEM e administráveis como as
// personalizadas.
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
  onTransferirPropriedade,
}: {
  roles: Role[];
  carregando: boolean;
  erroCarga: string | null;
  onRecarregar: () => void;
  onNova: () => void;
  onAbrirRole: (role: Role) => void;
  onEditar: (role: Role) => void;
  onExcluir: (role: Role) => void;
  /** Abre a transferência de propriedade — única ação da role Owner. */
  onTransferirPropriedade: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roles;
    // A Owner aparece normalmente quando casa com a busca: ser do sistema não
    // a esconde da listagem.
    return roles.filter((r) =>
      [r.nome, r.descricao ?? ""].some((campo) =>
        campo.toLowerCase().includes(q),
      ),
    );
  }, [roles, query]);

  const personalizadas = roles.filter((r) => r.tipo === "personalizada").length;

  return (
    <div>
      {/* Busca + resumo + ação primária, mesma composição de MembrosLista. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <MagnifyingGlassIcon className="dark:text-dark-300 pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar acesso…"
            aria-label="Buscar acessos"
            className="form-input dark:border-dark-450 dark:bg-dark-900 dark:text-dark-100 dark:placeholder:text-dark-300 h-9 w-full rounded-lg border border-gray-300 bg-white ps-9 pe-9 text-sm placeholder:text-gray-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="dark:text-dark-300 dark:hover:text-dark-100 absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-lg text-gray-400 hover:text-gray-700"
            >
              <XMarkIcon className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <p className="dark:text-dark-300 text-xs-plus text-gray-500">
            {roles.length} {roles.length === 1 ? "acesso" : "acessos"}
            {" · "}
            {personalizadas}{" "}
            {personalizadas === 1 ? "personalizado" : "personalizados"}
          </p>
          <Button
            onClick={onNova}
            color="primary"
            className="h-9 shrink-0 gap-1.5 rounded-lg px-3"
          >
            <PlusIcon className="size-4.5 stroke-[1.5]" />
            Novo acesso
          </Button>
        </div>
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
      ) : filtrados.length === 0 ? (
        // A Owner sempre existe, então "nenhum acesso" não é alcançável: este
        // estado só cobre a busca sem resultado.
        <EstadoVazio
          titulo="Nenhum acesso encontrado"
          hint="Ajuste a busca para ver mais resultados."
          acao={{ rotulo: "Limpar busca", onClick: () => setQuery("") }}
        />
      ) : (
        <div className="dark:border-dark-600 mt-5 overflow-x-auto rounded-xl border border-gray-200">
          <Table hoverable className="w-full min-w-2xl text-left">
            <THead>
              <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                {["Acesso", "Descrição", "Colaboradores", "Status"].map(
                  (titulo) => (
                    <Th
                      key={titulo}
                      className="dark:text-dark-200 py-3 text-xs font-semibold tracking-wider text-gray-500 uppercase"
                    >
                      {titulo}
                    </Th>
                  ),
                )}
                <Th className="w-12 py-3">
                  <span className="sr-only">Ações</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {filtrados.map((r) => (
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
                      <span className="dark:text-dark-300 block text-xs text-gray-400">
                        {r.permissoes.length} de {TOTAL_PERMISSOES} permissões
                      </span>
                    </div>
                  </Td>
                  <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                    {r.descricao ? (
                      <span className="line-clamp-2 block max-w-sm">
                        {r.descricao}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Td>
                  <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                    {r.membros > 0 ? (
                      `${r.membros} ${r.membros === 1 ? "colaborador" : "colaboradores"}`
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Td>
                  <Td className="py-3">
                    {/* Derivado de `editavel`, não de um campo de status:
                        `Role` não tem ciclo de vida. E `editavel` e não
                        `proprietaria`, porque o que este selo comunica é
                        IMUTABILIDADE — e são duas as roles imutáveis: Owner e
                        Convidado. Quem distingue as duas é o menu, não o
                        selo. */}
                    <Badge
                      color={r.editavel ? "success" : "info"}
                      variant="soft"
                      className="gap-1 rounded-full"
                    >
                      {!r.editavel && <LockClosedIcon className="size-3" />}
                      {r.editavel ? "Ativo" : "Sistema"}
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
                        onTransferirPropriedade={onTransferirPropriedade}
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
 * Menu de ações da linha, em TRÊS ramos — e a ordem deles é estrutural:
 *
 *   proprietaria  → Visualizar + Transferir propriedade
 *   !editavel     → Visualizar, e só
 *   senão         → Visualizar + Editar + Excluir
 *
 * A Owner satisfaz os dois primeiros. Testar `!editavel` antes de
 * `proprietaria` faria ela PERDER a transferência — que é a única operação que
 * ela admite. Não inverta.
 *
 * As roles protegidas são duas: Owner (transferível) e Convidado (atribuída
 * pelo tipo do membro, sem ação nenhuma). As opções não aparecem em vez de
 * aparecerem desabilitadas: é melhor a opção não existir do que existir e
 * recusar.
 *
 * As demais, incluindo Admin, Editor e Viewer, têm o menu completo.
 */
function RoleMenu({
  role,
  onVisualizar,
  onEditar,
  onExcluir,
  onTransferirPropriedade,
}: {
  role: Role;
  onVisualizar: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onTransferirPropriedade: () => void;
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
          Visualizar acesso
        </ItemMenu>
        {role.proprietaria ? (
          <ItemMenu
            icon={ArrowsRightLeftIcon}
            onClick={onTransferirPropriedade}
          >
            Transferir propriedade
          </ItemMenu>
        ) : role.editavel ? (
          <>
            <ItemMenu icon={PencilSquareIcon} onClick={onEditar}>
              Editar acesso
            </ItemMenu>
            <ItemMenu icon={TrashIcon} onClick={onExcluir} destrutivo>
              Excluir acesso
            </ItemMenu>
          </>
        ) : null}
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
