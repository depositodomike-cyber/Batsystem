// Detalhe de um relatório do Business Partner — dashboard com KPIs, gráficos
// (ApexCharts) e tabela. O modelo de dados vem de RELATORIO_DASHBOARDS; cada
// relatório com dashboard definido é renderizado por este componente genérico.
// Relatórios sem dashboard caem num placeholder "em construção".

// Import Dependencies
import { Link, useLocation, useParams } from "react-router";
import {
  ArrowDownIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  CircleStackIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import clsx from "clsx";

// Local Imports
import { Page } from "@/components/shared/Page";
import { Badge, Button, Card } from "@/components/ui";
import { getCurrentProduct } from "@/app/navigation/ceoOs";
import { useThemeContext } from "@/app/contexts/theme/context";
import {
  getDashboard,
  getRelatorioBySlug,
  STATUS_BADGE_COLOR,
  type ChartSeries,
  type DashboardChart,
  type KpiCard,
} from "@/app/data/relatorios";

// ----------------------------------------------------------------------

export default function RelatorioDetail() {
  const { pathname } = useLocation();
  const { relatorioId } = useParams();
  const product = getCurrentProduct(pathname);
  const { isDark } = useThemeContext();

  const base = `/${product.code}/relatorios`;
  const relatorio = relatorioId ? getRelatorioBySlug(relatorioId) : undefined;
  const dashboard = relatorioId ? getDashboard(relatorioId) : undefined;

  if (!relatorio) {
    return (
      <Page title={`Relatório · ${product.name}`}>
        <div className="transition-content w-full px-(--margin-x) py-6">
          <div className="mx-auto max-w-7xl">
            <BackLink to={base} />
            <div className="dark:border-dark-600 mt-5 grid h-64 place-items-center rounded-xl border border-dashed border-gray-300">
              <p className="dark:text-dark-300 text-sm text-gray-400">
                Relatório não encontrado.
              </p>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page title={`${relatorio.relatorio} · ${product.name}`}>
      <div className="transition-content w-full px-(--margin-x) py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <BackLink to={base} />

          {/* Cabeçalho */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-primary-600 dark:text-primary-400 text-tiny-plus font-semibold tracking-wider uppercase">
                {relatorio.categoria}
              </p>
              <div className="mt-1 flex items-center gap-2.5">
                <h2 className="dark:text-dark-50 text-2xl font-semibold tracking-wide text-gray-800">
                  {relatorio.relatorio}
                </h2>
                <Badge
                  color={STATUS_BADGE_COLOR[relatorio.status]}
                  variant="soft"
                  className="rounded-full text-[10px]"
                >
                  {relatorio.status}
                </Badge>
              </div>
              <p className="dark:text-dark-300 mt-1 max-w-2xl text-sm text-gray-500">
                {dashboard?.resumo ?? relatorio.objetivo}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <MetaItem icon={CalendarDaysIcon} label={relatorio.periodo} />
                <MetaItem icon={CircleStackIcon} label={relatorio.fonteDados} />
                <MetaItem
                  icon={ClockIcon}
                  label={`Atualizado ${relatorio.ultimaAtualizacao}`}
                />
              </div>
            </div>

            <Button
              color="primary"
              variant="outlined"
              className="h-9 shrink-0 gap-1.5 rounded-lg px-3 text-xs-plus"
            >
              <ArrowDownTrayIcon className="size-4" />
              Exportar
            </Button>
          </header>

          {dashboard ? (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {dashboard.kpis.map((kpi) => (
                  <KpiCardView key={kpi.label} kpi={kpi} />
                ))}
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {dashboard.charts.map((chart) => (
                  <ChartCardView key={chart.id} chart={chart} isDark={isDark} />
                ))}
              </div>

              {/* Tabela */}
              {dashboard.tabela && <TableCard tabela={dashboard.tabela} />}
            </>
          ) : (
            <div className="dark:border-dark-600 grid place-items-center rounded-xl border border-dashed border-gray-300 px-6 py-20 text-center">
              <ChartBarSquareIcon className="dark:text-dark-400 size-12 text-gray-300" />
              <p className="dark:text-dark-100 mt-3 text-sm font-medium text-gray-700">
                Dashboard em construção
              </p>
              <p className="dark:text-dark-300 mt-1 max-w-md text-xs-plus text-gray-400">
                {relatorio.objetivo}. O painel deste relatório estará disponível
                em breve.
              </p>
              <Link
                to={base}
                className="text-primary-600 dark:text-primary-400 mt-4 text-sm font-semibold"
              >
                Voltar aos relatórios
              </Link>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

// ----------------------------------------------------------------------

function BackLink({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="dark:text-dark-300 dark:hover:text-dark-100 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
    >
      <ArrowLeftIcon className="size-4" />
      Relatórios
    </Link>
  );
}

function MetaItem({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <span className="dark:text-dark-300 flex items-center gap-1.5 text-xs-plus text-gray-500">
      <Icon className="dark:text-dark-400 size-4 text-gray-400" />
      {label}
    </span>
  );
}

// ----------------------------------------------------------------------
// KPI card.

function KpiCardView({ kpi }: { kpi: KpiCard }) {
  const down = kpi.trend === "down";
  return (
    <Card className="flex flex-col p-4">
      <p className="dark:text-dark-300 text-xs font-medium text-gray-500">
        {kpi.label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="dark:text-dark-50 text-2xl font-semibold text-gray-800">
          {kpi.value}
        </p>
        {kpi.delta && (
          <span
            className={clsx(
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-tiny font-semibold",
              down
                ? "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
            )}
          >
            {down ? (
              <ArrowDownIcon className="size-3" />
            ) : (
              <ArrowUpIcon className="size-3" />
            )}
            {kpi.delta}
          </span>
        )}
      </div>
      {kpi.hint && (
        <p className="dark:text-dark-400 mt-1 text-tiny text-gray-400">
          {kpi.hint}
        </p>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------
// Card de gráfico (ApexCharts).

function ChartCardView({
  chart,
  isDark,
}: {
  chart: DashboardChart;
  isDark: boolean;
}) {
  const { type, series, options } = buildChart(chart, isDark);
  return (
    <Card className={clsx("p-4", chart.span === 2 && "lg:col-span-2")}>
      <h3 className="dark:text-dark-100 mb-3 text-sm font-semibold tracking-wide text-gray-800">
        {chart.title}
      </h3>
      <Chart
        key={isDark ? "dark" : "light"}
        type={type}
        series={series as NonNullable<ApexOptions["series"]>}
        options={options}
        height={chart.height ?? 300}
      />
    </Card>
  );
}

// Constrói (tipo, séries, opções) do ApexCharts a partir do modelo genérico,
// ajustando cores de eixo/grade conforme o tema (claro/escuro).
function buildChart(chart: DashboardChart, isDark: boolean) {
  const axis = isDark ? "#a1a1ad" : "#64748b";
  const grid = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)";

  const base: ApexOptions = {
    chart: {
      toolbar: { show: false },
      fontFamily: "inherit",
      background: "transparent",
      parentHeightOffset: 0,
    },
    colors: chart.colors,
    dataLabels: { enabled: false },
    grid: { borderColor: grid, strokeDashArray: 4 },
    legend: {
      position: "bottom",
      fontSize: "13px",
      labels: { colors: axis },
      markers: { strokeWidth: 0 },
    },
    tooltip: { theme: isDark ? "dark" : "light" },
    stroke: { curve: "smooth", width: 3 },
  };

  if (chart.kind === "donut") {
    return {
      type: "donut" as const,
      series: chart.series as number[],
      options: {
        ...base,
        labels: chart.categories,
        stroke: { width: 0 },
        plotOptions: {
          pie: {
            donut: {
              size: "68%",
              labels: {
                show: true,
                value: { color: axis },
                total: { show: true, label: "Total", color: axis },
              },
            },
          },
        },
      } satisfies ApexOptions,
    };
  }

  if (chart.kind === "radar") {
    const n = chart.categories?.length ?? 0;
    return {
      type: "radar" as const,
      series: chart.series as ChartSeries[],
      options: {
        ...base,
        xaxis: {
          categories: chart.categories,
          labels: { style: { colors: Array(n).fill(axis) } },
        },
        yaxis: { show: false },
        fill: { opacity: 0.18 },
        markers: { size: 3 },
        plotOptions: {
          radar: { polygons: { strokeColors: grid, connectorColors: grid } },
        },
      } satisfies ApexOptions,
    };
  }

  // area / bar / line
  return {
    type: chart.kind,
    series: chart.series as ChartSeries[],
    options: {
      ...base,
      stroke: {
        curve: "smooth",
        width: chart.kind === "bar" ? 0 : 3,
      },
      plotOptions: {
        bar: {
          horizontal: chart.horizontal ?? false,
          borderRadius: 6,
          borderRadiusApplication: "end",
          columnWidth: "55%",
        },
      },
      fill:
        chart.kind === "area"
          ? {
              type: "gradient",
              gradient: {
                shadeIntensity: 0.5,
                opacityFrom: 0.4,
                opacityTo: 0.05,
              },
            }
          : { opacity: 1 },
      xaxis: {
        categories: chart.categories,
        labels: { style: { colors: axis } },
        axisBorder: { color: grid },
        axisTicks: { color: grid },
      },
      yaxis: { labels: { style: { colors: axis } } },
    } satisfies ApexOptions,
  };
}

// ----------------------------------------------------------------------
// Tabela.

function TableCard({
  tabela,
}: {
  tabela: { title: string; columns: string[]; rows: (string | number)[][] };
}) {
  return (
    <Card className="overflow-hidden">
      <h3 className="dark:text-dark-100 px-4 pt-4 text-sm font-semibold tracking-wide text-gray-800">
        {tabela.title}
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="dark:border-dark-500 dark:bg-dark-800 border-y border-gray-200 bg-gray-50">
              {tabela.columns.map((col, i) => (
                <th
                  key={i}
                  className={clsx(
                    "dark:text-dark-200 px-4 py-2.5 font-semibold text-gray-600",
                    i > 0 && "text-right",
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="dark:divide-dark-500 divide-y divide-gray-100">
            {tabela.rows.map((row, ri) => (
              <tr key={ri} className="dark:hover:bg-dark-700/50 hover:bg-gray-50">
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={clsx(
                      "px-4 py-2.5",
                      ci === 0
                        ? "dark:text-dark-100 font-medium text-gray-800"
                        : "dark:text-dark-300 text-right text-gray-600",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
