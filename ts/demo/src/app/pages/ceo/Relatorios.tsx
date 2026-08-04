// Relatórios — produto Business Partner (IA).
// Cada produto tem a SUA própria página de Relatórios (diferente do Feed, que é
// o mesmo para todos os produtos). Listagem de relatórios com busca, filtros
// (categoria, status, ordenação) e alternância entre visão em lista (tabela) e
// em cards. Conteúdo inspirado na página /relatorios do protótipo (engajaí),
// reescrito no design system do Tailux.

// Import Dependencies
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ArrowTopRightOnSquareIcon,
  HandThumbDownIcon,
  HandThumbUpIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  ShareIcon,
  Squares2X2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { PageTitle } from "@/components/shared/PageTitle";
import { Badge, Button, Card } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import {
  CATEGORIAS_OPCOES,
  compareAtualizacao,
  ORDENACAO_OPCOES,
  RELATORIOS_LISTA,
  slugRelatorio,
  STATUS_BADGE_COLOR,
  STATUS_OPCOES,
  type OrdenacaoRelatorio,
  type RelatorioItem,
} from "@/app/data/relatorios";

// ----------------------------------------------------------------------

type Visualizacao = "lista" | "card";

// ----------------------------------------------------------------------

export default function Relatorios() {
  const { pathname } = useLocation();
  const product = getCurrentProduct(pathname);
  const base = `/${product.code}/relatorios`;

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoRelatorio>("alfabetica");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("lista");
  const [curtidos, setCurtidos] = useState<Set<number>>(new Set());
  const [descurtidos, setDescurtidos] = useState<Set<number>>(new Set());

  const exibidos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = RELATORIOS_LISTA.filter((item) => {
      const matchBusca =
        !termo ||
        [
          item.relatorio,
          item.categoria,
          item.objetivo,
          item.publico,
          item.fonteDados,
        ].some((campo) => campo.toLowerCase().includes(termo));
      const matchCategoria = categoria === "todos" || item.categoria === categoria;
      const matchStatus = status === "todos" || item.status === status;
      return matchBusca && matchCategoria && matchStatus;
    });

    const ord = [...lista];
    if (ordenacao === "alfabetica") {
      ord.sort((a, b) => a.relatorio.localeCompare(b.relatorio, "pt-BR"));
    } else {
      ord.sort((a, b) => compareAtualizacao(a, b, ordenacao === "recente"));
    }
    return ord;
  }, [busca, categoria, status, ordenacao]);

  const curtir = (id: number) => {
    setCurtidos((prev) => new Set(prev).add(id));
    setDescurtidos((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };
  const descurtir = (id: number) => {
    setDescurtidos((prev) => new Set(prev).add(id));
    setCurtidos((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const limpar = () => {
    setBusca("");
    setCategoria("todos");
    setStatus("todos");
  };

  return (
    <Page title={`Relatórios · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <header className="flex flex-col gap-1">
            <PageTitle help={{ description: (<>
              <p>Os <strong>Relatórios</strong> mostram como o seu time usa o BeHuman: acessos, grupos criados, documentos gerados, performance dos squads e ações executadas.</p>
              <p>Filtre por categoria ou status, ordene a lista, alterne entre visão em tabela e em cards e abra o relatório completo de cada item.</p>
            </>) }}>Relatórios</PageTitle>
            <p className="dark:text-dark-300 max-w-2xl text-sm text-gray-500">
              Acompanhe como o seu time usa o BeHuman: acessos,
              grupos criados, documentos gerados, performance dos squads e ações
              executadas. Filtre por categoria ou status e acesse o relatório
              completo.
            </p>
          </header>

          {/* Barra de filtros */}
          <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon className="size-4.5 text-gray-400" />
              </span>
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por relatório, categoria, objetivo…"
                className="form-input dark:bg-dark-700 dark:border-dark-450 dark:text-dark-100 dark:placeholder:text-dark-300 h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-9 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-500 focus:ring-0"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  aria-label="Limpar busca"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="size-4.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SelectField
                label="Categoria"
                value={categoria}
                onChange={setCategoria}
                options={CATEGORIAS_OPCOES}
              />
              <SelectField
                label="Status"
                value={status}
                onChange={setStatus}
                options={STATUS_OPCOES}
              />
              <SelectField
                label="Ordenar"
                value={ordenacao}
                onChange={(v) => setOrdenacao(v as OrdenacaoRelatorio)}
                options={ORDENACAO_OPCOES}
              />
              <ViewToggle value={visualizacao} onChange={setVisualizacao} />
            </div>
          </Card>

          {/* Conteúdo */}
          {exibidos.length === 0 ? (
            <EmptyState onReset={limpar} />
          ) : visualizacao === "lista" ? (
            <RelatoriosTable items={exibidos} base={base} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {exibidos.map((item) => (
                <RelatorioCard
                  key={item.id}
                  item={item}
                  base={base}
                  liked={curtidos.has(item.id)}
                  disliked={descurtidos.has(item.id)}
                  onLike={() => curtir(item.id)}
                  onDislike={() => descurtir(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

// ----------------------------------------------------------------------
// Visão em lista — tabela.

function RelatoriosTable({
  items,
  base,
}: {
  items: RelatorioItem[];
  base: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="min-w-full overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="dark:border-dark-500 dark:bg-dark-800 border-b border-gray-200 bg-gray-50">
              {[
                "Relatório",
                "Categoria",
                "Objetivo",
                "Público",
                "Última atualização",
                "",
              ].map((col, i) => (
                <th
                  key={i}
                  className="dark:text-dark-200 px-4 py-3 font-semibold text-gray-600"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="dark:divide-dark-500 divide-y divide-gray-100">
            {items.map((item) => (
              <tr
                key={item.id}
                className="dark:hover:bg-dark-700/50 hover:bg-gray-50"
              >
                <td className="dark:text-dark-100 px-4 py-3 font-semibold text-gray-800">
                  {item.relatorio}
                </td>
                <td className="dark:text-dark-300 px-4 py-3 text-gray-600">
                  {item.categoria}
                </td>
                <td className="dark:text-dark-300 max-w-xs px-4 py-3 text-gray-600">
                  <span className="block truncate">{item.objetivo}</span>
                </td>
                <td className="dark:text-dark-300 px-4 py-3 text-gray-600">
                  {item.publico}
                </td>
                <td className="dark:text-dark-300 px-4 py-3 text-gray-600">
                  {item.ultimaAtualizacao}
                </td>
                <td className="px-4 py-3">
                  <Button
                    component={Link}
                    to={`${base}/${slugRelatorio(item)}`}
                    color="primary"
                    className="h-8 gap-1.5 rounded-lg px-3 text-xs-plus"
                  >
                    <ArrowTopRightOnSquareIcon className="size-4" />
                    Acessar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Visão em cards.

function RelatorioCard({
  item,
  base,
  liked,
  disliked,
  onLike,
  onDislike,
}: {
  item: RelatorioItem;
  base: string;
  liked: boolean;
  disliked: boolean;
  onLike: () => void;
  onDislike: () => void;
}) {
  const respondeu = liked || disliked;
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="dark:text-dark-100 text-sm-plus font-semibold text-gray-800">
            {item.relatorio}
          </p>
          <Badge
            color={STATUS_BADGE_COLOR[item.status]}
            variant="soft"
            className="shrink-0 rounded-full text-[10px]"
          >
            {item.status}
          </Badge>
        </div>
        <p className="text-primary-600 dark:text-primary-400 mt-1 text-tiny font-medium">
          {item.categoria}
        </p>
        <p className="dark:text-dark-300 mt-2 line-clamp-2 text-xs-plus text-gray-500">
          {item.objetivo}
        </p>
        <dl className="dark:text-dark-300 mt-3 grid grid-cols-1 gap-1 text-tiny text-gray-400">
          <div>
            <span className="font-medium">Público:</span> {item.publico} ·{" "}
            <span className="font-medium">Período:</span> {item.periodo}
          </div>
          <div>
            <span className="font-medium">Fonte:</span> {item.fonteDados} ·{" "}
            {item.ultimaAtualizacao}
          </div>
        </dl>
      </div>

      <div className="dark:border-dark-500 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Button
            component={Link}
            to={`${base}/${slugRelatorio(item)}`}
            color="primary"
            className="h-8 gap-1.5 rounded-lg px-3 text-xs-plus"
          >
            <ArrowTopRightOnSquareIcon className="size-4" />
            Acessar
          </Button>
          <Button
            component="a"
            href="#"
            color="neutral"
            variant="outlined"
            isIcon
            aria-label="Compartilhar"
            className="size-8 rounded-lg"
          >
            <ShareIcon className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          {respondeu ? (
            <span className="dark:text-dark-300 text-tiny text-gray-400">
              Agradecemos o feedback.
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={onLike}
                aria-label="Curtir"
                className="dark:text-dark-300 dark:hover:bg-dark-500 grid size-7 place-items-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <HandThumbUpIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={onDislike}
                aria-label="Não curtir"
                className="dark:text-dark-300 dark:hover:bg-dark-500 grid size-7 place-items-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <HandThumbDownIcon className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ----------------------------------------------------------------------
// Alternância lista / cards.

function ViewToggle({
  value,
  onChange,
}: {
  value: Visualizacao;
  onChange: (v: Visualizacao) => void;
}) {
  const item = (v: Visualizacao, Icon: typeof ListBulletIcon, label: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      aria-label={label}
      aria-pressed={value === v}
      className={clsx(
        "grid size-9 place-items-center rounded-lg transition-colors",
        value === v
          ? "bg-primary-600 text-white"
          : "dark:text-dark-300 dark:hover:bg-dark-500 text-gray-500 hover:bg-gray-100",
      )}
    >
      <Icon className="size-5" />
    </button>
  );

  return (
    <div className="dark:border-dark-450 flex items-center gap-1 rounded-xl border border-gray-300 p-1">
      {item("lista", ListBulletIcon, "Visualização em lista")}
      {item("card", Squares2X2Icon, "Visualização em cards")}
    </div>
  );
}

// ----------------------------------------------------------------------
// Select estilizado (label + nativo). Mesmo padrão da página de Insights.

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="dark:text-dark-300 text-xs font-medium text-gray-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="form-select dark:bg-dark-700 dark:border-dark-450 dark:text-dark-100 h-9 rounded-lg border border-gray-300 bg-white pl-3 pr-8 text-xs-plus text-gray-700 focus:border-primary-500 focus:ring-0"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ----------------------------------------------------------------------

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="dark:border-dark-600 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-16 text-center">
      <MagnifyingGlassIcon className="dark:text-dark-400 size-10 text-gray-300" />
      <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
        Nenhum relatório encontrado
      </p>
      <p className="dark:text-dark-300 mt-1 text-xs-plus text-gray-400">
        Ajuste a busca ou os filtros para ver mais resultados.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="text-primary-600 dark:text-primary-400 mt-4 text-sm font-semibold"
      >
        Limpar filtros
      </button>
    </div>
  );
}
