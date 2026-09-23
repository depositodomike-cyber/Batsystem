// Import Dependencies
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
} from "@headlessui/react";
import {
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PresentationChartBarIcon,
  SparklesIcon,
  TableCellsIcon,
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
import { ConfirmModal } from "@/components/shared/ConfirmModal";
import { toast } from "sonner";
import {
  excluirCriacaoApi,
  listarCriacoesApi,
  salvarCriacaoApi,
  type CriacaoResumo,
  type CriacaoStatus,
  type CriacaoTipo,
} from "@/services/api/criacoes";
import { aiFunctionScreenPath } from "./ia-functions";

// ----------------------------------------------------------------------
// Criações recentes — a Home do AI Studio.
//
// Responde "no que eu estou trabalhando?". A outra pergunta ("o que a IA pode
// criar?") é do collapse AI STUDIO no sidebar, que continua sendo o lugar de
// começar — por isso não há CTA de nova criação aqui.
//
// A lista é PRIVADA: o servidor devolve só o que é do usuário autenticado, e a
// busca, os filtros e a paginação acontecem lá, dentro da mesma consulta
// escopada. Nada aqui filtra por dono, porque nada aqui poderia — e é
// exatamente esse o ponto.
//
// Molde de `MarcasLista`: mesma barra de busca com contagem, mesma cascata
// carregando → erro → vazio → tabela, mesmo kebab, mesma rolagem horizontal em
// tela estreita.
// ----------------------------------------------------------------------

const PAGINA = 25;

const TIPOS: { id: CriacaoTipo; label: string; Icon: React.ElementType }[] = [
  {
    id: "apresentacao",
    label: "Apresentação",
    Icon: PresentationChartBarIcon,
  },
  { id: "planilha", label: "Planilha", Icon: TableCellsIcon },
];

/**
 * Rótulo e cor de cada estado.
 *
 * O rótulo é sempre texto — a cor é reforço, nunca a informação (§64 do
 * briefing e a regra de acessibilidade da casa). Quem não distingue as cores lê
 * "Plano pronto" do mesmo jeito.
 */
const STATUS: Record<
  CriacaoStatus,
  { label: string; color: "neutral" | "info" | "primary" | "success" | "error" }
> = {
  rascunho: { label: "Rascunho", color: "neutral" },
  planejando: { label: "Planejando", color: "info" },
  plano_pronto: { label: "Plano pronto", color: "primary" },
  gerando: { label: "Gerando", color: "info" },
  concluido: { label: "Concluído", color: "success" },
  erro: { label: "Erro", color: "error" },
};

/** Ordem dos filtros: a do fluxo de trabalho, não a alfabética. */
const STATUS_ORDEM: CriacaoStatus[] = [
  "rascunho",
  "planejando",
  "plano_pronto",
  "gerando",
  "concluido",
  "erro",
];

const SELECT =
  "form-select dark:border-dark-450 dark:bg-dark-900 dark:text-dark-100 h-9 rounded-lg border border-gray-300 bg-white text-sm";

function rotuloTipo(tipo: CriacaoTipo): string {
  return TIPOS.find((t) => t.id === tipo)?.label ?? tipo;
}

/** Título de uma criação que a IA ainda não nomeou. */
function tituloDe(c: CriacaoResumo): string {
  return c.titulo.trim() || `${rotuloTipo(c.tipo)} sem título`;
}

/**
 * "agora", "há 5 min", "há 3 h", depois a data.
 *
 * As mesmas regras de `formatCommentDate` em `FeedDetail.tsx`. Repetidas de
 * propósito: extrair o helper de lá obrigaria a mexer num arquivo que não tem
 * nada a ver com esta tarefa, e dez linhas não pagam esse risco.
 */
function quandoFoi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  if (horas < 48) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function CriacoesLista({ produto }: { produto: string }) {
  const navigate = useNavigate();

  const [itens, setItens] = useState<CriacaoResumo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<CriacaoTipo | "">("");
  const [status, setStatus] = useState<CriacaoStatus | "">("");

  /** Id da linha em renomeação inline, e o texto sendo digitado. */
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [rascunhoNome, setRascunhoNome] = useState("");

  const [aExcluir, setAExcluir] = useState<CriacaoResumo | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [estadoConfirm, setEstadoConfirm] = useState<
    "pending" | "success" | "error"
  >("pending");

  /**
   * A busca e os filtros vão ao servidor, porque é lá que o escopo por dono
   * existe. Debounce para não disparar uma consulta por tecla.
   */
  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listarCriacoesApi({
        q: query,
        tipo: tipo || undefined,
        status: status || undefined,
        limit: PAGINA,
      });
      setItens(r.itens);
      setCursor(r.proximoCursor);
    } catch {
      setErro("Não foi possível carregar suas criações.");
    } finally {
      setCarregando(false);
    }
  }, [query, tipo, status]);

  // `vivo` evita que uma resposta atrasada sobrescreva uma busca mais nova.
  const primeiraRef = useRef(true);
  useEffect(() => {
    let vivo = true;
    const espera = primeiraRef.current ? 0 : 300;
    primeiraRef.current = false;
    const t = setTimeout(() => {
      if (vivo) void buscar();
    }, espera);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [buscar]);

  const carregarMais = async () => {
    if (!cursor || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const r = await listarCriacoesApi({
        q: query,
        tipo: tipo || undefined,
        status: status || undefined,
        limit: PAGINA,
        cursor,
      });
      setItens((atual) => [...atual, ...r.itens]);
      setCursor(r.proximoCursor);
    } catch {
      toast.error("Não foi possível carregar mais criações.");
    } finally {
      setCarregandoMais(false);
    }
  };

  /** Abre a criação existente — nunca começa uma nova. */
  const abrir = (c: CriacaoResumo) => {
    const tela = aiFunctionScreenPath(c.tipo, produto);
    if (!tela) {
      toast.error("Este gerador ainda não abre uma criação salva.");
      return;
    }
    navigate(`${tela}?criacao=${c.id}`);
  };

  /**
   * Renomear é edição INLINE — o mesmo desenho de `SidebarListItem`: input no
   * lugar do nome, Enter confirma, Escape cancela, sair do campo confirma.
   * Nada de `window.prompt`, que é caixa do navegador e não do produto.
   */
  const abrirRename = (c: CriacaoResumo) => {
    setRascunhoNome(c.titulo.trim());
    setRenomeando(c.id);
  };

  const confirmarRename = async (c: CriacaoResumo) => {
    const limpo = rascunhoNome.trim();
    setRenomeando(null);
    if (!limpo || limpo === c.titulo.trim()) return;
    // Otimista: o nome novo aparece na hora, e volta ao anterior se falhar.
    setItens((atual) =>
      atual.map((x) => (x.id === c.id ? { ...x, titulo: limpo } : x)),
    );
    try {
      await salvarCriacaoApi(c.id, { titulo: limpo });
    } catch {
      setItens((atual) =>
        atual.map((x) => (x.id === c.id ? { ...x, titulo: c.titulo } : x)),
      );
      toast.error("Não foi possível renomear.");
    }
  };

  const confirmarExclusao = async () => {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await excluirCriacaoApi(aExcluir.id);
      setItens((atual) => atual.filter((x) => x.id !== aExcluir.id));
      setEstadoConfirm("success");
    } catch {
      setEstadoConfirm("error");
    } finally {
      setExcluindo(false);
    }
  };

  const filtrando = Boolean(query.trim() || tipo || status);

  return (
    <div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <MagnifyingGlassIcon className="dark:text-dark-300 pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar criações…"
            aria-label="Buscar criações"
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

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="dark:text-dark-300 text-xs-plus text-gray-500">
              Tipo
            </span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as CriacaoTipo | "")}
              className={SELECT}
            >
              <option value="">Todos</option>
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="dark:text-dark-300 text-xs-plus text-gray-500">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CriacaoStatus | "")}
              className={SELECT}
            >
              <option value="">Todos</option>
              {STATUS_ORDEM.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {carregando && itens.length === 0 ? (
        <div className="mt-8 grid place-items-center py-16">
          <Spinner color="primary" className="size-8" />
        </div>
      ) : erro ? (
        <EstadoVazio
          icon={SparklesIcon}
          titulo="Não foi possível carregar suas criações"
          hint={erro}
          acao={{ rotulo: "Tentar de novo", onClick: () => void buscar() }}
        />
      ) : itens.length === 0 ? (
        filtrando ? (
          <EstadoVazio
            icon={MagnifyingGlassIcon}
            titulo="Nenhuma criação encontrada"
            hint="Ajuste a busca ou os filtros para ver mais resultados."
            acao={{
              rotulo: "Limpar filtros",
              onClick: () => {
                setQuery("");
                setTipo("");
                setStatus("");
              },
            }}
          />
        ) : (
          <EstadoVazio
            icon={SparklesIcon}
            titulo="Você ainda não criou nada no AI Studio."
            hint="Escolha uma opção no menu lateral para começar."
          />
        )
      ) : (
        <>
          <div className="dark:border-dark-600 mt-5 overflow-x-auto rounded-xl border border-gray-200">
            <Table hoverable className="w-full min-w-2xl text-left">
              <THead>
                <Tr className="dark:border-dark-600 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
                  {/* Sem "Criado por": tudo aqui é do próprio usuário, e uma
                      coluna com o mesmo nome em todas as linhas não informa. */}
                  {["Criação", "Tipo", "Status", "Atualizado em"].map(
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
                {itens.map((c) => {
                  const meta = TIPOS.find((t) => t.id === c.tipo);
                  const Icon = meta?.Icon ?? SparklesIcon;
                  const st = STATUS[c.status] ?? STATUS.rascunho;
                  return (
                    <Tr
                      key={c.id}
                      className="dark:border-dark-600 cursor-pointer border-b border-gray-100 last:border-0"
                      onClick={() => abrir(c)}
                    >
                      <Td className="py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Icon className="dark:text-dark-300 size-4.5 shrink-0 text-gray-400" />
                          {renomeando === c.id ? (
                            <input
                              autoFocus
                              value={rascunhoNome}
                              aria-label={`Renomear ${tituloDe(c)}`}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setRascunhoNome(e.target.value)}
                              onBlur={() => void confirmarRename(c)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void confirmarRename(c);
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  setRenomeando(null);
                                }
                              }}
                              className="border-primary-500 focus:border-primary-500 dark:border-primary-500 dark:bg-dark-700 dark:text-dark-100 w-full min-w-0 rounded-md border bg-white px-2 py-1 text-sm font-medium text-gray-800 outline-hidden focus:ring-0"
                            />
                          ) : (
                            <span
                              className={clsx(
                                "truncate text-sm font-medium",
                                c.titulo.trim()
                                  ? "dark:text-dark-100 text-gray-800"
                                  : "dark:text-dark-300 text-gray-400",
                              )}
                            >
                              {tituloDe(c)}
                            </span>
                          )}
                        </div>
                      </Td>

                      <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600">
                        {rotuloTipo(c.tipo)}
                      </Td>

                      <Td className="py-3">
                        <Badge
                          color={st.color}
                          variant="soft"
                          className="shrink-0 rounded-full"
                        >
                          {st.label}
                        </Badge>
                      </Td>

                      <Td className="dark:text-dark-200 text-sm-plus py-3 text-gray-600 tabular-nums">
                        {quandoFoi(c.atualizadoEm)}
                      </Td>

                      <Td className="py-3">
                        {/* stopPropagation: a linha inteira abre a criação. */}
                        <div onClick={(e) => e.stopPropagation()}>
                          <CriacaoMenu
                            criacao={c}
                            onAbrir={() => abrir(c)}
                            onRenomear={() => abrirRename(c)}
                            onExcluir={() => {
                              setEstadoConfirm("pending");
                              setAExcluir(c);
                            }}
                          />
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="dark:text-dark-300 text-xs-plus text-gray-500">
              {itens.length}{" "}
              {itens.length === 1 ? "criação listada" : "criações listadas"}
            </p>
            {cursor && (
              <Button
                variant="outlined"
                onClick={() => void carregarMais()}
                disabled={carregandoMais}
                className="h-9 gap-2 rounded-lg px-3"
              >
                {carregandoMais && <Spinner className="size-4" />}
                Carregar mais
              </Button>
            )}
          </div>
        </>
      )}

      <ConfirmModal
        show={aExcluir != null}
        onClose={() => {
          setAExcluir(null);
          setEstadoConfirm("pending");
        }}
        onOk={() => void confirmarExclusao()}
        confirmLoading={excluindo}
        state={estadoConfirm}
        messages={{
          pending: {
            title: "Excluir esta criação?",
            // Diz o que NÃO acontece de propósito: quem já salvou no
            // Repositório não perde o que disponibilizou por lá.
            description: `"${aExcluir ? tituloDe(aExcluir) : "Esta criação"}" sai do seu AI Studio. O que você já salvou no Repositório não muda.`,
            actionText: "Excluir",
          },
          success: {
            title: "Criação excluída",
            description: "Ela não aparece mais nas suas criações recentes.",
            actionText: "Ok",
          },
          error: {
            title: "Não foi possível excluir",
            description: "Verifique a conexão e tente de novo.",
            actionText: "Tentar de novo",
          },
        }}
      />
    </div>
  );
}

/** Ações secundárias. Só o que a criação realmente suporta. */
function CriacaoMenu({
  criacao,
  onAbrir,
  onRenomear,
  onExcluir,
}: {
  criacao: CriacaoResumo;
  onAbrir: () => void;
  onRenomear: () => void;
  onExcluir: () => void;
}) {
  // Sem item "Baixar": o arquivo é remontado a partir do que a criação
  // guardou, e isso acontece na tela dela. Um "Baixar" que na verdade só
  // navega prometeria download e entregaria navegação — e o §38 pede só o que
  // está de fato disponível.
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        aria-label={`Ações de ${tituloDe(criacao)}`}
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
        <ItemMenu Icon={SparklesIcon} onClick={onAbrir}>
          Abrir
        </ItemMenu>
        <ItemMenu Icon={PencilSquareIcon} onClick={onRenomear}>
          Renomear
        </ItemMenu>
        <ItemMenu Icon={TrashIcon} onClick={onExcluir} perigo>
          Excluir
        </ItemMenu>
      </Transition>
    </Menu>
  );
}

function ItemMenu({
  Icon,
  onClick,
  perigo,
  children,
}: {
  Icon: React.ElementType;
  onClick: () => void;
  perigo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <MenuItem>
      {({ focus }) => (
        <button
          type="button"
          onClick={onClick}
          className={clsx(
            "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors",
            focus && "dark:bg-dark-600 bg-gray-100",
            perigo
              ? "text-error"
              : "dark:text-dark-100 dark:hover:text-dark-100 text-gray-700",
          )}
        >
          <Icon className="size-4 shrink-0" />
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
