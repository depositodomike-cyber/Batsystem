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
  EllipsisVerticalIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import {
  Avatar,
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
import type { Membro } from "@/services/api/membros";
import { rotuloArea, rotuloCargo, STATUS_MEMBRO } from "./membros-status";

// ----------------------------------------------------------------------
// Aba "Membros" da tela Estrutura: listagem + ações por linha.
//
// Componente de apresentação. Os dados e todos os modais vivem em
// Estrutura.tsx, porque a aba Hierarquia usa a MESMA lista e o MESMO drawer —
// duplicar esse estado deixaria as duas abas divergindo.
// ----------------------------------------------------------------------

export function MembrosLista({
  membros,
  carregando,
  erroCarga,
  onRecarregar,
  onAdicionar,
  onAbrirMembro,
  onEditar,
  onDesativar,
  onReativar,
  onCancelarConvite,
}: {
  membros: Membro[];
  carregando: boolean;
  erroCarga: string | null;
  onRecarregar: () => void;
  onAdicionar: () => void;
  onAbrirMembro: (membro: Membro) => void;
  onEditar: (membro: Membro) => void;
  onDesativar: (membro: Membro) => void;
  onReativar: (membro: Membro) => void;
  onCancelarConvite: (membro: Membro) => void;
}) {
  const [query, setQuery] = useState("");

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return membros;
    return membros.filter((m) =>
      [
        m.nome,
        m.email,
        rotuloArea(m),
        rotuloCargo(m),
        m.gestor?.nome ?? "",
        // Os nomes das duas: com `m.role?.nome` a linha sumiria da busca por
        // causa da segunda role.
        m.roles.map((r) => r.nome).join(" "),
        STATUS_MEMBRO[m.status].rotulo,
      ].some((campo) => campo.toLowerCase().includes(q)),
    );
  }, [membros, query]);

  const ativos = membros.filter((m) => m.status === "ativo").length;
  const pendentes = membros.filter(
    (m) => m.status === "convite_pendente",
  ).length;

  return (
    <div>
      {/* Busca + resumo + ação primária */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <MagnifyingGlassIcon className="dark:text-dark-300 pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail, área, cargo, gestor ou role…"
            aria-label="Buscar membros"
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
            {membros.length} {membros.length === 1 ? "membro" : "membros"}
            {" · "}
            {ativos} {ativos === 1 ? "ativo" : "ativos"}
            {pendentes > 0 && ` · ${pendentes} com convite pendente`}
          </p>
          <Button
            onClick={onAdicionar}
            color="primary"
            className="h-9 shrink-0 gap-1.5 rounded-lg px-3"
          >
            <PlusIcon className="size-4.5 stroke-[1.5]" />
            Adicionar membro
          </Button>
        </div>
      </div>

      {/* Listagem */}
      {carregando ? (
        <div className="mt-8 grid place-items-center py-16">
          <Spinner color="primary" className="size-8" />
        </div>
      ) : erroCarga ? (
        <EstadoVazio
          icon={UsersIcon}
          titulo="Não foi possível carregar os membros"
          hint={erroCarga}
          acao={{ rotulo: "Tentar de novo", onClick: onRecarregar }}
        />
      ) : filtrados.length === 0 ? (
        membros.length === 0 ? (
          <EstadoVazio
            icon={UsersIcon}
            titulo="Nenhum membro ainda"
            hint="Adicione as pessoas da sua organização para começar."
            acao={{ rotulo: "Adicionar membro", onClick: onAdicionar }}
          />
        ) : (
          <EstadoVazio
            icon={MagnifyingGlassIcon}
            titulo="Nenhum membro encontrado"
            hint="Ajuste a busca para ver mais pessoas."
            acao={{ rotulo: "Limpar busca", onClick: () => setQuery("") }}
          />
        )
      ) : (
        <div className="dark:border-dark-600 mt-5 overflow-x-auto rounded-xl border border-gray-200">
          {/* A largura mínima cresceu a cada versão (3xl → 4xl → 5xl → 6xl):
              entraram as colunas Gestor e Role, e a de Role passou a caber dois
              badges. O contêiner rola na horizontal em vez de comprimir as
              demais. */}
          <Table hoverable className="w-full min-w-6xl text-left">
            <THead>
              <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                {[
                  "Membro",
                  "E-mail",
                  "Área",
                  "Cargo",
                  "Gestor",
                  "Roles",
                  "Status",
                ].map((titulo) => (
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
              {filtrados.map((m) => {
                const status = STATUS_MEMBRO[m.status];
                return (
                  <Tr
                    key={m.id}
                    className="dark:border-dark-600 cursor-pointer border-b border-gray-100 last:border-0"
                    onClick={() => onAbrirMembro(m)}
                  >
                    <Td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          size={9}
                          name={m.nome}
                          initialColor="auto"
                          classNames={{ display: "text-xs" }}
                        />
                        <span className="dark:text-dark-100 text-sm font-medium text-gray-800">
                          {m.nome}
                        </span>
                      </div>
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                      {m.email}
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                      {rotuloArea(m) || <Vazio />}
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                      {rotuloCargo(m) || <Vazio />}
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                      {m.gestor ? (
                        <span className="flex items-center gap-1.5">
                          {m.gestor.nome}
                          {/* Gestor inativo é sinalizado, não desfeito. */}
                          {m.gestor.status === "inativo" && (
                            <Badge
                              color="warning"
                              variant="soft"
                              className="rounded-full"
                            >
                              inativo
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <Vazio />
                      )}
                    </Td>
                    <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                      {m.roles.length > 0 ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          {m.roles.map((r) => (
                            <Badge
                              key={r.id}
                              color={r.tipo === "sistema" ? "info" : "neutral"}
                              variant="soft"
                              className="rounded-full"
                            >
                              {r.nome}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <Vazio />
                      )}
                    </Td>
                    <Td className="py-3">
                      <Badge
                        color={status.cor}
                        variant="soft"
                        className="rounded-full"
                      >
                        {status.rotulo}
                      </Badge>
                    </Td>
                    <Td className="py-3">
                      {/* stopPropagation: a linha inteira abre o drawer. */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <MembroMenu
                          membro={m}
                          onVisualizar={() => onAbrirMembro(m)}
                          onEditar={() => onEditar(m)}
                          onDesativar={() => onDesativar(m)}
                          onReativar={() => onReativar(m)}
                          onCancelarConvite={() => onCancelarConvite(m)}
                        />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------

function Vazio() {
  return <span className="text-gray-400">—</span>;
}

/** Menu de ações da linha. Mesma casca do KeyMenu em AiConnectionCard.tsx. */
function MembroMenu({
  membro,
  onVisualizar,
  onEditar,
  onDesativar,
  onReativar,
  onCancelarConvite,
}: {
  membro: Membro;
  onVisualizar: () => void;
  onEditar: () => void;
  onDesativar: () => void;
  onReativar: () => void;
  onCancelarConvite: () => void;
}) {
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label={`Ações de ${membro.nome}`}
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
        <ItemMenu icon={EyeIcon} onClick={onVisualizar}>
          Visualizar membro
        </ItemMenu>
        <ItemMenu icon={PencilSquareIcon} onClick={onEditar}>
          Editar membro
        </ItemMenu>
        {membro.status === "inativo" ? (
          <ItemMenu icon={UserPlusIcon} onClick={onReativar}>
            Reativar membro
          </ItemMenu>
        ) : (
          <ItemMenu icon={UserMinusIcon} onClick={onDesativar} destrutivo>
            Desativar membro
          </ItemMenu>
        )}
        {/* Excluir só existe para convite: quem tem conta vira Inativo. */}
        {!membro.temConta && (
          <ItemMenu icon={TrashIcon} onClick={onCancelarConvite} destrutivo>
            Cancelar convite
          </ItemMenu>
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
  icon: Icon,
  titulo,
  hint,
  acao,
}: {
  icon: React.ElementType;
  titulo: string;
  hint: string;
  acao: { rotulo: string; onClick: () => void };
}) {
  return (
    <div className="dark:border-dark-600 mt-8 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
      <Icon className="dark:text-dark-400 size-10 text-gray-300" />
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
