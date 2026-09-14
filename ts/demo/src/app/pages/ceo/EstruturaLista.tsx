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
  ArrowPathIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  MinusCircleIcon,
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
import type { EstruturaItem } from "@/services/api/estrutura";

// ----------------------------------------------------------------------
// Listagem de Áreas ou de Cargos — as duas abas de Estrutura que gerenciam
// entidades. Um componente só, parametrizado pela cópia, porque as duas telas
// são idênticas em estrutura e mudam apenas em gênero e substantivo.
//
// Componente de apresentação: os dados e todos os modais vivem em
// Administracao.tsx, que é dono da carga — a contagem de membros por área e a
// área exibida em cada membro derivam uma da outra, e estados separados por
// aba divergiriam depois de qualquer edição.
// ----------------------------------------------------------------------

/** Tudo que muda entre Áreas e Cargos. */
export interface CopyEstruturaLista {
  /** "Áreas" */
  titulo: string;
  /** "Organize as áreas que compõem a estrutura da organização." */
  subtitulo: string;
  /** Cabeçalho da primeira coluna: "Nome" | "Cargo". */
  colunaNome: string;
  /** "área" / "cargo" — usado nas contagens e no placeholder da busca. */
  singular: string;
  /** "áreas" / "cargos" */
  plural: string;
  /** "+ Nova área" / "+ Novo cargo" */
  acaoCriar: string;
  /** ["Ativa", "Inativa"] / ["Ativo", "Inativo"] */
  statusRotulo: Record<EstruturaItem["status"], string>;
  /** Plural de "inativa"/"inativo", para o resumo acima da tabela. */
  inativosRotulo: string;
  /** "Nenhuma área cadastrada" */
  vazioTitulo: string;
  /** "Crie áreas para organizar onde os membros estão alocados." */
  vazioHint: string;
  /** "Nenhuma área encontrada" */
  buscaVaziaTitulo: string;
  icon: React.ElementType;
}

export function EstruturaLista({
  itens,
  copy,
  carregando,
  erroCarga,
  onRecarregar,
  onCriar,
  onEditar,
  onAlternarStatus,
  onExcluir,
}: {
  itens: EstruturaItem[];
  copy: CopyEstruturaLista;
  carregando: boolean;
  erroCarga: string | null;
  onRecarregar: () => void;
  onCriar: () => void;
  onEditar: (item: EstruturaItem) => void;
  onAlternarStatus: (item: EstruturaItem) => void;
  onExcluir: (item: EstruturaItem) => void;
}) {
  const [query, setQuery] = useState("");

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((i) =>
      [i.nome, i.descricao ?? "", copy.statusRotulo[i.status]].some((campo) =>
        campo.toLowerCase().includes(q),
      ),
    );
  }, [itens, query, copy]);

  const ativos = itens.filter((i) => i.status === "ativo").length;
  const inativos = itens.length - ativos;

  return (
    <div>
      {/* Sem bloco de título aqui: `copy.titulo` e `copy.subtitulo` são
          renderizados pelo cabeçalho da seção, em Administracao.tsx. Enquanto
          Áreas e Cargos eram sub-abas de "Estrutura", o título da página não
          dizia qual das duas estava aberta e este bloco respondia isso; como
          seções próprias, o cabeçalho já responde, e os dois juntos davam dois
          <h2> idênticos. A cópia continua em `estrutura-copy.ts`. */}

      {/* Busca + resumo + ação primária, mesma composição de MembrosLista. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <MagnifyingGlassIcon className="dark:text-dark-300 pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${copy.singular}…`}
            aria-label={`Buscar ${copy.plural}`}
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
            {itens.length} {itens.length === 1 ? copy.singular : copy.plural}
            {inativos > 0 &&
              ` · ${inativos} ${
                inativos === 1
                  ? copy.statusRotulo.inativo.toLowerCase()
                  : copy.inativosRotulo
              }`}
          </p>
          <Button
            onClick={onCriar}
            color="primary"
            className="h-9 shrink-0 gap-1.5 rounded-lg px-3"
          >
            <PlusIcon className="size-4.5 stroke-[1.5]" />
            {copy.acaoCriar}
          </Button>
        </div>
      </div>

      {carregando ? (
        <div className="mt-8 grid place-items-center py-16">
          <Spinner color="primary" className="size-8" />
        </div>
      ) : erroCarga ? (
        <EstadoVazio
          icon={copy.icon}
          titulo={`Não foi possível carregar ${copy.plural === "áreas" ? "as" : "os"} ${copy.plural}`}
          hint={erroCarga}
          acao={{ rotulo: "Tentar de novo", onClick: onRecarregar }}
        />
      ) : filtrados.length === 0 ? (
        itens.length === 0 ? (
          <EstadoVazio
            icon={copy.icon}
            titulo={copy.vazioTitulo}
            hint={copy.vazioHint}
            acao={{ rotulo: copy.acaoCriar, onClick: onCriar }}
          />
        ) : (
          <EstadoVazio
            icon={MagnifyingGlassIcon}
            titulo={copy.buscaVaziaTitulo}
            hint="Ajuste a busca para ver mais resultados."
            acao={{ rotulo: "Limpar busca", onClick: () => setQuery("") }}
          />
        )
      ) : (
        <div className="dark:border-dark-600 mt-5 overflow-x-auto rounded-xl border border-gray-200">
          <Table hoverable className="w-full min-w-2xl text-left">
            <THead>
              <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                {[copy.colunaNome, "Membros", "Status"].map((titulo) => (
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
              {filtrados.map((i) => (
                <Tr
                  key={i.id}
                  className="dark:border-dark-600 cursor-pointer border-b border-gray-100 last:border-0"
                  onClick={() => onEditar(i)}
                >
                  <Td className="py-3">
                    <div className="min-w-0">
                      <span className="dark:text-dark-100 block text-sm font-medium text-gray-800">
                        {i.nome}
                      </span>
                      {i.descricao && (
                        <span className="dark:text-dark-300 line-clamp-1 block max-w-md text-xs text-gray-400">
                          {i.descricao}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                    {i.membros > 0 ? (
                      `${i.membros} ${i.membros === 1 ? "colaborador" : "colaboradores"}`
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </Td>
                  <Td className="py-3">
                    <Badge
                      color={i.status === "ativo" ? "success" : "neutral"}
                      variant="soft"
                      className="rounded-full"
                    >
                      {copy.statusRotulo[i.status]}
                    </Badge>
                  </Td>
                  <Td className="py-3">
                    {/* stopPropagation: a linha inteira abre a edição. */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <ItemMenu
                        item={i}
                        copy={copy}
                        onEditar={() => onEditar(i)}
                        onAlternarStatus={() => onAlternarStatus(i)}
                        onExcluir={() => onExcluir(i)}
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
 * "Excluir" aparece SEMPRE, inclusive com colaboradores vinculados. Antes era
 * escondido, porque a API recusava e mostrar uma opção que seria negada é
 * pior que não mostrá-la; hoje a API aceita, desde que a resolução seja
 * explícita, e quem decide o destino — ou a falta dele — é quem administra.
 * Desativar e Excluir com gente vinculada passam pelo modal de realocação.
 */
function ItemMenu({
  item,
  copy,
  onEditar,
  onAlternarStatus,
  onExcluir,
}: {
  item: EstruturaItem;
  copy: CopyEstruturaLista;
  onEditar: () => void;
  onAlternarStatus: () => void;
  onExcluir: () => void;
}) {
  const inativo = item.status === "inativo";
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
          Editar {copy.singular}
        </ItemAcao>
        {inativo ? (
          <ItemAcao icon={ArrowPathIcon} onClick={onAlternarStatus}>
            Reativar {copy.singular}
          </ItemAcao>
        ) : (
          <ItemAcao
            icon={MinusCircleIcon}
            onClick={onAlternarStatus}
            destrutivo
          >
            Desativar {copy.singular}
          </ItemAcao>
        )}
        <ItemAcao icon={TrashIcon} onClick={onExcluir} destrutivo>
          Excluir {copy.singular}
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
