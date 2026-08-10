// Relatórios — produto Business Partner (IA).
// Cada produto tem a SUA própria página de Relatórios (diferente do Feed, que é
// o mesmo para todos os produtos). Mock inspirado na página /relatorios do
// protótipo (engajaí), reescrito para o design system do Tailux.

export type StatusRelatorio = "Atualizado" | "Finalizado" | "Em andamento";

export interface RelatorioItem {
  id: number;
  relatorio: string;
  categoria: string;
  objetivo: string;
  publico: string;
  ultimaAtualizacao: string;
  periodo: string;
  fonteDados: string;
  status: StatusRelatorio;
}

export const RELATORIOS_LISTA: RelatorioItem[] = [
  {
    id: 1,
    relatorio: "Acessos à Plataforma",
    categoria: "Acessos & Uso",
    objetivo: "Frequência de acessos, sessões e usuários ativos no módulo",
    publico: "Admin, Líder",
    ultimaAtualizacao: "Hoje, 14:32",
    periodo: "Últimos 30 dias",
    fonteDados: "Logs de Acesso",
    status: "Atualizado",
  },
  {
    id: 2,
    relatorio: "Usuários Ativos (DAU/MAU)",
    categoria: "Acessos & Uso",
    objetivo: "Acompanhar usuários ativos diários e mensais e retenção",
    publico: "Admin, Diretoria",
    ultimaAtualizacao: "Ontem, 18:10",
    periodo: "Últimos 90 dias",
    fonteDados: "Telemetria",
    status: "Atualizado",
  },
  {
    id: 3,
    relatorio: "Criação de Grupos",
    categoria: "Agrupamentos",
    objetivo: "Volume de agrupamentos criados, ativos e arquivados",
    publico: "Admin, Gestor",
    ultimaAtualizacao: "Hoje, 09:12",
    periodo: "Mês Atual",
    fonteDados: "Agrupamentos",
    status: "Atualizado",
  },
  {
    id: 4,
    relatorio: "Documentos Gerados",
    categoria: "Documentos",
    objetivo: "Quantidade e tipos de documentos gerados pela IA",
    publico: "Admin, Líder",
    ultimaAtualizacao: "Hoje, 11:48",
    periodo: "Últimos 30 dias",
    fonteDados: "Documentos",
    status: "Atualizado",
  },
  {
    id: 5,
    relatorio: "Performance dos Squads",
    categoria: "Squads",
    objetivo: "Tempo de resposta, satisfação e entregas por squad",
    publico: "Admin, Diretoria",
    ultimaAtualizacao: "Ontem, 16:40",
    periodo: "Mês Atual",
    fonteDados: "Squads + Histórico",
    status: "Atualizado",
  },
  {
    id: 6,
    relatorio: "Squads Mais Acionados",
    categoria: "Squads",
    objetivo: "Ranking de squads por volume de interações",
    publico: "Admin, Líder",
    ultimaAtualizacao: "03 Fev",
    periodo: "Últimos 90 dias",
    fonteDados: "Histórico",
    status: "Finalizado",
  },
  {
    id: 7,
    relatorio: "Ações Executadas",
    categoria: "Ações & Automações",
    objetivo: "Ações disparadas pelos agentes e taxa de sucesso",
    publico: "Admin, Gestor",
    ultimaAtualizacao: "Hoje, 16:01",
    periodo: "Últimos 30 dias",
    fonteDados: "Agentes",
    status: "Atualizado",
  },
  {
    id: 8,
    relatorio: "Interações de Chat",
    categoria: "Chat & Interações",
    objetivo: "Volume de conversas, mensagens e temas mais consultados",
    publico: "Admin, Líder",
    ultimaAtualizacao: "01 Fev",
    periodo: "Últimos 30 dias",
    fonteDados: "Histórico de Chat",
    status: "Atualizado",
  },
  {
    id: 9,
    relatorio: "Tarefas Criadas via IA",
    categoria: "Ações & Automações",
    objetivo: "Tarefas geradas, concluídas e em aberto pela IA",
    publico: "Admin, Gestor",
    ultimaAtualizacao: "02 Fev",
    periodo: "Mês Atual",
    fonteDados: "Tarefas",
    status: "Atualizado",
  },
  {
    id: 10,
    relatorio: "Uso dos Conectores",
    categoria: "Conectores",
    objetivo: "Status, volume de consultas e saúde das fontes integradas",
    publico: "Admin, TI",
    ultimaAtualizacao: "05 Fev",
    periodo: "Últimos 30 dias",
    fonteDados: "Conectores",
    status: "Em andamento",
  },
  {
    id: 11,
    relatorio: "Repositórios Registrados",
    categoria: "Repositório",
    objetivo: "Volume e reuso da base de memória da IA por área",
    publico: "Admin, Líder",
    ultimaAtualizacao: "04 Fev",
    periodo: "Acumulado",
    fonteDados: "Repositório",
    status: "Em andamento",
  },
  {
    id: 12,
    relatorio: "Adoção por Área",
    categoria: "Acessos & Uso",
    objetivo: "Penetração e uso do módulo por área e equipe da empresa",
    publico: "Admin, Diretoria",
    ultimaAtualizacao: "06 Fev",
    periodo: "Trimestre Atual",
    fonteDados: "Telemetria",
    status: "Finalizado",
  },
];

// Categorias distintas, ordenadas, para o filtro de categoria.
export const CATEGORIAS_OPCOES: { value: string; label: string }[] = [
  { value: "todos", label: "Todas" },
  ...Array.from(new Set(RELATORIOS_LISTA.map((r) => r.categoria)))
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((cat) => ({ value: cat, label: cat })),
];

export const STATUS_OPCOES: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "Atualizado", label: "Atualizado" },
  { value: "Finalizado", label: "Finalizado" },
  { value: "Em andamento", label: "Em andamento" },
];

export type OrdenacaoRelatorio = "alfabetica" | "recente" | "antiga";

export const ORDENACAO_OPCOES: { value: OrdenacaoRelatorio; label: string }[] = [
  { value: "alfabetica", label: "Ordem alfabética" },
  { value: "recente", label: "Mais recentes" },
  { value: "antiga", label: "Mais antigos" },
];

// Cor do Badge (DS do Tailux) por status.
export const STATUS_BADGE_COLOR: Record<
  StatusRelatorio,
  "success" | "primary" | "warning"
> = {
  Atualizado: "success",
  Finalizado: "primary",
  "Em andamento": "warning",
};

/**
 * Ordenação por "recente" / "antiga" usa a expressão textual da última
 * atualização como proxy de data (Hoje > Ontem > DD Fev).
 */
export function compareAtualizacao(
  a: RelatorioItem,
  b: RelatorioItem,
  recentePrimeiro: boolean,
): number {
  const getRank = (s: string) => {
    if (s.startsWith("Hoje")) return 1000;
    if (s.startsWith("Ontem")) return 500;
    const match = s.match(/(\d{1,2})\s*Fev/);
    return match ? 100 - parseInt(match[1], 10) : 0;
  };
  const ra = getRank(a.ultimaAtualizacao);
  const rb = getRank(b.ultimaAtualizacao);
  return recentePrimeiro ? rb - ra : ra - rb;
}

// ----------------------------------------------------------------------
// Slug — usado na URL do dashboard (/relatorios/:slug). Derivado do título
// para não precisar manter um campo extra em cada item.

export function slugRelatorio(item: RelatorioItem): string {
  return item.relatorio
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getRelatorioBySlug(slug: string): RelatorioItem | undefined {
  return RELATORIOS_LISTA.find((r) => slugRelatorio(r) === slug);
}

// ----------------------------------------------------------------------
// Dashboards — cada relatório pode ter um painel (KPIs + gráficos + tabela).
// O modelo abaixo é genérico e renderizado por RelatorioDetail.tsx com
// ApexCharts. Relatórios sem dashboard definido caem num placeholder.

export interface KpiCard {
  label: string;
  value: string;
  /** Variação textual, ex.: "+12,4%". */
  delta?: string;
  /** "up" pinta de verde, "down" de vermelho. */
  trend?: "up" | "down";
  /** Texto auxiliar, ex.: "vs. mês anterior". */
  hint?: string;
}

export type ChartKind = "area" | "bar" | "line" | "donut" | "radar";

export interface ChartSeries {
  name: string;
  data: number[];
}

export interface DashboardChart {
  id: string;
  title: string;
  kind: ChartKind;
  /** Quantas colunas (de 2) o gráfico ocupa. */
  span?: 1 | 2;
  height?: number;
  /** Rótulos do eixo X (área/barra/linha/radar) ou fatias (donut). */
  categories?: string[];
  /** Séries (área/barra/linha/radar) ou valores das fatias (donut). */
  series: ChartSeries[] | number[];
  colors?: string[];
  horizontal?: boolean;
}

export interface DashboardTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface RelatorioDashboard {
  resumo: string;
  kpis: KpiCard[];
  charts: DashboardChart[];
  tabela?: DashboardTable;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];

export const RELATORIO_DASHBOARDS: Record<string, RelatorioDashboard> = {
  // 1 ----------------------------------------------------------------
  "acessos-a-plataforma": {
    resumo:
      "Visão de acessos, sessões e usuários ativos no módulo BeHuman nos últimos meses.",
    kpis: [
      { label: "Acessos no período", value: "8.420", delta: "+12,4%", trend: "up", hint: "vs. mês anterior" },
      { label: "Usuários ativos", value: "312", delta: "+5,1%", trend: "up", hint: "MAU" },
      { label: "Sessão média", value: "14m 32s", delta: "+1,2%", trend: "up", hint: "duração" },
      { label: "Taxa de retorno", value: "68%", delta: "-2,3%", trend: "down", hint: "usuários recorrentes" },
    ],
    charts: [
      {
        id: "acessos-mes",
        title: "Acessos por mês",
        kind: "area",
        span: 2,
        categories: MESES,
        series: [{ name: "Acessos", data: [980, 1120, 1340, 1280, 1610, 2090] }],
        colors: ["#4f46e5"],
      },
      {
        id: "acessos-area",
        title: "Acessos por área",
        kind: "bar",
        span: 1,
        horizontal: true,
        categories: ["Vendas", "RH", "Financeiro", "Marketing", "Produto", "CS"],
        series: [{ name: "Acessos", data: [1980, 1560, 1340, 1180, 920, 740] }],
        colors: ["#0ea5e9"],
      },
      {
        id: "acessos-dispositivo",
        title: "Dispositivos",
        kind: "donut",
        span: 1,
        categories: ["Desktop", "Mobile", "Tablet"],
        series: [62, 31, 7],
        colors: ["#4f46e5", "#10b981", "#f59e0b"],
      },
    ],
    tabela: {
      title: "Horários de pico",
      columns: ["Faixa", "Acessos", "% do total"],
      rows: [
        ["08h – 10h", 1980, "23,5%"],
        ["10h – 12h", 1640, "19,5%"],
        ["14h – 16h", 2210, "26,2%"],
        ["16h – 18h", 1490, "17,7%"],
        ["Outros", 1100, "13,1%"],
      ],
    },
  },

  // 3 ----------------------------------------------------------------
  "criacao-de-grupos": {
    resumo:
      "Volume e evolução dos agrupamentos criados pelos usuários, com status e distribuição por área.",
    kpis: [
      { label: "Grupos criados", value: "146", delta: "+18%", trend: "up", hint: "no período" },
      { label: "Grupos ativos", value: "98", delta: "+6%", trend: "up", hint: "em uso" },
      { label: "Arquivados", value: "31", hint: "sem atividade" },
      { label: "Média por usuário", value: "2,4", delta: "+0,3", trend: "up", hint: "grupos/usuário" },
    ],
    charts: [
      {
        id: "grupos-mes",
        title: "Grupos criados por mês",
        kind: "line",
        span: 2,
        categories: MESES,
        series: [{ name: "Grupos", data: [12, 18, 22, 19, 28, 47] }],
        colors: ["#8b5cf6"],
      },
      {
        id: "grupos-area",
        title: "Grupos por área",
        kind: "bar",
        span: 1,
        categories: ["Vendas", "RH", "Financ.", "Mkt", "Produto"],
        series: [{ name: "Grupos", data: [38, 29, 24, 31, 24] }],
        colors: ["#4f46e5"],
      },
      {
        id: "grupos-status",
        title: "Status dos grupos",
        kind: "donut",
        span: 1,
        categories: ["Ativos", "Arquivados", "Rascunho"],
        series: [98, 31, 17],
        colors: ["#10b981", "#94a3b8", "#f59e0b"],
      },
    ],
  },

  // 4 ----------------------------------------------------------------
  "documentos-gerados": {
    resumo:
      "Documentos produzidos pela IA no módulo — volume, tipos e squads que mais geram conteúdo.",
    kpis: [
      { label: "Documentos gerados", value: "1.284", delta: "+22%", trend: "up", hint: "no período" },
      { label: "Páginas geradas", value: "5.930", delta: "+19%", trend: "up" },
      { label: "Exportados", value: "742", delta: "+14%", trend: "up", hint: "PDF / DOCX" },
      { label: "Tempo médio de geração", value: "8,4s", delta: "-1,1s", trend: "up", hint: "mais rápido" },
    ],
    charts: [
      {
        id: "docs-mes",
        title: "Documentos por mês",
        kind: "area",
        span: 2,
        categories: MESES,
        series: [{ name: "Documentos", data: [120, 150, 180, 210, 260, 364] }],
        colors: ["#10b981"],
      },
      {
        id: "docs-tipo",
        title: "Por tipo",
        kind: "donut",
        span: 1,
        categories: ["Relatório", "Ata", "Proposta", "E-mail", "Resumo"],
        series: [38, 22, 16, 14, 10],
        colors: ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e"],
      },
      {
        id: "docs-squad",
        title: "Top squads geradores",
        kind: "bar",
        span: 1,
        horizontal: true,
        categories: ["Marketing", "Vendas", "RH", "Financeiro", "Jurídico"],
        series: [{ name: "Documentos", data: [312, 268, 214, 186, 142] }],
        colors: ["#8b5cf6"],
      },
    ],
  },

  // 5 ----------------------------------------------------------------
  "performance-dos-squads": {
    resumo:
      "Qualidade e volume de atendimento dos squads: tempo de resposta, satisfação e entregas.",
    kpis: [
      { label: "Tempo médio de resposta", value: "3,2s", delta: "-0,4s", trend: "up", hint: "mais rápido" },
      { label: "Satisfação (CSAT)", value: "94%", delta: "+2%", trend: "up" },
      { label: "Entregas concluídas", value: "1.020", delta: "+9%", trend: "up", hint: "no período" },
      { label: "Taxa de resolução", value: "88%", delta: "+3%", trend: "up", hint: "na 1ª interação" },
    ],
    charts: [
      {
        id: "squads-interacoes",
        title: "Interações por squad",
        kind: "bar",
        span: 2,
        horizontal: true,
        categories: ["Marketing", "Vendas", "RH", "Financeiro", "Sucesso do Cliente", "Jurídico"],
        series: [{ name: "Interações", data: [1240, 1080, 960, 720, 680, 410] }],
        colors: ["#4f46e5"],
      },
      {
        id: "squads-qualidade",
        title: "Qualidade média (5 dimensões)",
        kind: "radar",
        span: 1,
        categories: ["Rapidez", "Precisão", "Clareza", "Profundidade", "Ação"],
        series: [{ name: "Média dos squads", data: [88, 92, 90, 84, 86] }],
        colors: ["#10b981"],
      },
      {
        id: "squads-tempo",
        title: "Tempo de resposta (s) por mês",
        kind: "line",
        span: 1,
        categories: MESES,
        series: [{ name: "Segundos", data: [4.1, 3.9, 3.7, 3.6, 3.4, 3.2] }],
        colors: ["#f59e0b"],
      },
    ],
  },

  // 7 ----------------------------------------------------------------
  "acoes-executadas": {
    resumo:
      "Ações disparadas pelos agentes da IA — volume, status e tipos de automação executadas.",
    kpis: [
      { label: "Ações executadas", value: "3.150", delta: "+16%", trend: "up", hint: "no período" },
      { label: "Taxa de sucesso", value: "96,2%", delta: "+0,8%", trend: "up" },
      { label: "Ações automáticas", value: "61%", delta: "+4%", trend: "up", hint: "sem intervenção" },
      { label: "Falhas", value: "118", delta: "-12%", trend: "up", hint: "menos erros" },
    ],
    charts: [
      {
        id: "acoes-mes",
        title: "Ações por mês",
        kind: "area",
        span: 2,
        categories: MESES,
        series: [{ name: "Ações", data: [380, 420, 510, 540, 620, 680] }],
        colors: ["#0ea5e9"],
      },
      {
        id: "acoes-status",
        title: "Por status",
        kind: "donut",
        span: 1,
        categories: ["Sucesso", "Falha", "Pendente"],
        series: [96, 3, 1],
        colors: ["#10b981", "#f43f5e", "#f59e0b"],
      },
      {
        id: "acoes-tipo",
        title: "Ações por tipo",
        kind: "bar",
        span: 1,
        categories: ["Tarefa", "E-mail", "Agenda", "Doc", "CRM", "Notif."],
        series: [{ name: "Ações", data: [820, 610, 540, 480, 380, 320] }],
        colors: ["#8b5cf6"],
      },
    ],
  },
};

export function getDashboard(slug: string): RelatorioDashboard | undefined {
  return RELATORIO_DASHBOARDS[slug];
}
