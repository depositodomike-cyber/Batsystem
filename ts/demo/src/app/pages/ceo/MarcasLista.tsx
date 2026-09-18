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
  CheckCircleIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  SwatchIcon,
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
import type { MarcaLocal } from "./design-system";

// ----------------------------------------------------------------------
// Tabela de guias de marca — Configurações › Geral › Aparência › Guia de marca.
//
// Componente de apresentação: não busca, não grava, não confirma. Quem faz isso
// é `AparenciaSection`, que é dona do estado do store e da permissão.
//
// Molde de `EstruturaLista` (Áreas/Cargos): mesma barra de busca + contagem +
// CTA, mesma cascata carregando → erro → vazio → tabela, mesmo kebab. A tabela
// rola na horizontal em telas estreitas em vez de comprimir as colunas, que é a
// decisão já tomada e comentada lá.
// ----------------------------------------------------------------------

/** Quantos contextos aparecem antes do "+N". */
const CONTEXTOS_VISIVEIS = 2;

export function MarcasLista({
  marcas,
  activeId,
  carregando,
  erro,
  podeGerenciar,
  onRecarregar,
  onCriar,
  onEditar,
  onAtivar,
  onExcluir,
}: {
  marcas: MarcaLocal[];
  activeId: string;
  carregando: boolean;
  erro: string | null;
  /** `false` esconde o CTA e o kebab: a role do usuário não permite escrever. */
  podeGerenciar: boolean;
  onRecarregar: () => void;
  onCriar: () => void;
  onEditar: (marca: MarcaLocal) => void;
  onAtivar: (marca: MarcaLocal) => void;
  onExcluir: (marca: MarcaLocal) => void;
}) {
  const [query, setQuery] = useState("");

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return marcas;
    return marcas.filter((m) =>
      [m.ds.marca.nome, m.ds.marca.tom, ...(m.ds.marca.contexto ?? [])].some(
        (campo) => campo.toLowerCase().includes(q),
      ),
    );
  }, [marcas, query]);

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <MagnifyingGlassIcon className="dark:text-dark-300 pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar marca…"
            aria-label="Buscar marcas"
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
            {marcas.length} {marcas.length === 1 ? "marca" : "marcas"}
          </p>
          {podeGerenciar && (
            <Button
              onClick={onCriar}
              color="primary"
              className="h-9 shrink-0 gap-1.5 rounded-lg px-3"
            >
              <PlusIcon className="size-4.5 stroke-[1.5]" />
              Nova marca
            </Button>
          )}
        </div>
      </div>

      {carregando && marcas.length === 0 ? (
        <div className="mt-8 grid place-items-center py-16">
          <Spinner color="primary" className="size-8" />
        </div>
      ) : erro && marcas.length === 0 ? (
        <EstadoVazio
          icon={SwatchIcon}
          titulo="Não foi possível carregar as marcas"
          hint={erro}
          acao={{ rotulo: "Tentar de novo", onClick: onRecarregar }}
        />
      ) : filtradas.length === 0 ? (
        marcas.length === 0 ? (
          <EstadoVazio
            icon={SwatchIcon}
            titulo="Nenhuma marca cadastrada"
            hint="Crie um guia de marca para que o conteúdo gerado pela IA saia na identidade da sua organização. Sem nenhum, ele sai no estilo padrão da plataforma."
            acao={
              podeGerenciar
                ? { rotulo: "Nova marca", onClick: onCriar }
                : undefined
            }
          />
        ) : (
          <EstadoVazio
            icon={MagnifyingGlassIcon}
            titulo="Nenhuma marca encontrada"
            hint="Ajuste a busca para ver mais resultados."
            acao={{ rotulo: "Limpar busca", onClick: () => setQuery("") }}
          />
        )
      ) : (
        <div className="dark:border-dark-600 mt-5 overflow-x-auto rounded-xl border border-gray-200">
          <Table hoverable className="w-full min-w-2xl text-left">
            <THead>
              <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                {[
                  "Marca",
                  "Identidade visual",
                  "Contextos",
                  "Atualizado em",
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
              {filtradas.map((m) => (
                <Tr
                  key={m.id}
                  className="dark:border-dark-600 cursor-pointer border-b border-gray-100 last:border-0"
                  onClick={() => onEditar(m)}
                >
                  <Td className="py-3">
                    <div className="min-w-0">
                      <span className="dark:text-dark-100 flex items-center gap-2 text-sm font-medium text-gray-800">
                        <span className="truncate">
                          {m.ds.marca.nome?.trim() || "Sem nome"}
                        </span>
                        {m.id === activeId && (
                          <Badge
                            color="primary"
                            variant="soft"
                            className="shrink-0 rounded-full"
                          >
                            Ativa
                          </Badge>
                        )}
                      </span>
                      {m.ds.marca.tom && (
                        <span className="dark:text-dark-300 line-clamp-1 block max-w-md text-xs text-gray-400">
                          {m.ds.marca.tom}
                        </span>
                      )}
                    </div>
                  </Td>

                  <Td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex gap-1">
                        {[
                          m.ds.cores.primaria,
                          m.ds.cores.secundaria,
                          m.ds.cores.acento,
                          m.ds.cores.fundo,
                          m.ds.cores.superficie,
                        ].map((cor, i) => (
                          <span
                            key={`${cor}-${i}`}
                            title={cor}
                            className="size-4 shrink-0 rounded-full border border-black/10"
                            style={{ background: cor }}
                          />
                        ))}
                      </span>
                      {m.ds.logos?.claro && (
                        <img
                          src={m.ds.logos.claro}
                          alt=""
                          className="h-5 max-w-16 shrink-0 object-contain"
                        />
                      )}
                    </div>
                  </Td>

                  <Td className="py-3">
                    <Contextos lista={m.ds.marca.contexto ?? []} />
                  </Td>

                  <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600 tabular-nums">
                    {formatarData(m.atualizadoEm)}
                  </Td>

                  <Td className="py-3">
                    {/* stopPropagation: a linha inteira abre a edição. */}
                    <div onClick={(e) => e.stopPropagation()}>
                      {podeGerenciar ? (
                        <MarcaMenu
                          marca={m}
                          ehAtiva={m.id === activeId}
                          onEditar={() => onEditar(m)}
                          onAtivar={() => onAtivar(m)}
                          onExcluir={() => onExcluir(m)}
                        />
                      ) : (
                        <span className="sr-only">Sem ações disponíveis</span>
                      )}
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

/** Contextos de uso, com "+N" quando passam de dois. */
function Contextos({ lista }: { lista: string[] }) {
  if (!lista.length) return <span className="text-gray-400">—</span>;
  const visiveis = lista.slice(0, CONTEXTOS_VISIVEIS);
  const resto = lista.length - visiveis.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visiveis.map((c) => (
        <Badge key={c} variant="soft" className="rounded-full">
          {c}
        </Badge>
      ))}
      {resto > 0 && (
        <Badge
          variant="soft"
          color="neutral"
          className="rounded-full"
          title={lista.slice(CONTEXTOS_VISIVEIS).join(", ")}
        >
          +{resto}
        </Badge>
      )}
    </div>
  );
}

/**
 * Data de `atualizadoEm`.
 *
 * Pode faltar: uma marca criada no modo offline nasce sem carimbo do servidor.
 */
function formatarData(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function MarcaMenu({
  marca,
  ehAtiva,
  onEditar,
  onAtivar,
  onExcluir,
}: {
  marca: MarcaLocal;
  ehAtiva: boolean;
  onEditar: () => void;
  onAtivar: () => void;
  onExcluir: () => void;
}) {
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label={`Ações de ${marca.ds.marca.nome || "Sem nome"}`}
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
          Editar guia
        </ItemAcao>
        {/* A marca ativa é preferência DESTE navegador, não da organização —
            por isso a ação some quando já é ela, em vez de ficar desabilitada. */}
        {!ehAtiva && (
          <ItemAcao icon={CheckCircleIcon} onClick={onAtivar}>
            Definir como marca ativa
          </ItemAcao>
        )}
        <ItemAcao icon={TrashIcon} onClick={onExcluir} destrutivo>
          Excluir marca
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

// TODO: `EstadoVazio` é o mesmo de EstruturaLista, AcessoRoles e MembrosLista —
// quatro cópias. Extrair para @/components/shared numa passagem própria, para
// que migrar os outros três não seja pré-requisito desta tela.
function EstadoVazio({
  icon: Icon,
  titulo,
  hint,
  acao,
}: {
  icon: React.ElementType;
  titulo: string;
  hint: string;
  acao?: { rotulo: string; onClick: () => void };
}) {
  return (
    <div className="dark:border-dark-600 mt-8 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
      <Icon className="dark:text-dark-400 size-10 text-gray-300" />
      <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
        {titulo}
      </p>
      <p className="dark:text-dark-300 text-xs-plus mt-1 max-w-md text-gray-400">
        {hint}
      </p>
      {acao && (
        <Button
          variant="outlined"
          className="mt-4 rounded-lg"
          onClick={acao.onClick}
        >
          {acao.rotulo}
        </Button>
      )}
    </div>
  );
}
