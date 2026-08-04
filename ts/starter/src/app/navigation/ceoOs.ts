import { NavigationTree } from "@/@types/navigation";

// ----------------------------------------------------------------------
// CEO OS — produtos e navegação
// Replica a estrutura de menus do protótipo (app antigo) no formato de
// navegação nativo do Tailux. Cada produto expõe uma lista de "seções"
// (NavigationTree do tipo "root") renderizadas como grupos na sidebar.
// ----------------------------------------------------------------------

export interface Product {
  code: string;
  name: string;
}

export const products: Product[] = [
  { code: "comunicacao", name: "Comunicação" },
  { code: "business-partner", name: "Business Partner (IA)" },
  { code: "learning", name: "Learning" },
  { code: "performance", name: "Performance" },
  { code: "projetos", name: "Projetos e Tarefas" },
  { code: "recrutamento", name: "Recrutamento" },
];

export const SYSTEM_CODE = "sistema";
export const systemProduct: Product = { code: SYSTEM_CODE, name: "Sistema" };

export const DEFAULT_PRODUCT_CODE = "business-partner";

const cockpit = (base: string): NavigationTree => ({
  id: `${base}.cockpit`,
  type: "root",
  title: "Cockpit",
  childs: [
    { id: `${base}.insights`, type: "item", path: `/${base}/insights`, title: "Insights", icon: "ceo.insights" },
    { id: `${base}.relatorios`, type: "item", path: `/${base}/relatorios`, title: "Relatórios", icon: "ceo.relatorios" },
  ],
});

export const ceoNavigation: Record<string, NavigationTree[]> = {
  "business-partner": [
    cockpit("business-partner"),
    {
      id: "business-partner.squads",
      type: "root",
      title: "Squads",
      childs: [
        { id: "bp.conselho", type: "item", path: "/business-partner/conselho", title: "Conselho", icon: "ceo.conselho" },
        { id: "bp.operacao", type: "item", path: "/business-partner/operacao", title: "Operação", icon: "ceo.operacao" },
        { id: "bp.clientes", type: "item", path: "/business-partner/clientes", title: "Clientes", icon: "ceo.clientes" },
        { id: "bp.financeiro", type: "item", path: "/business-partner/financeiro", title: "Financeiro", icon: "ceo.financeiro" },
        { id: "bp.pessoas", type: "item", path: "/business-partner/pessoas", title: "Pessoas", icon: "ceo.pessoas" },
        { id: "bp.produto", type: "item", path: "/business-partner/produto", title: "Produto", icon: "ceo.produto" },
        { id: "bp.comercial", type: "item", path: "/business-partner/comercial", title: "Comercial", icon: "ceo.comercial" },
        { id: "bp.marketing", type: "item", path: "/business-partner/marketing", title: "Marketing", icon: "ceo.marketing" },
        { id: "bp.presenca", type: "item", path: "/business-partner/presenca", title: "Presença Executiva", icon: "ceo.presenca" },
      ],
    },
  ],

  comunicacao: [
    cockpit("comunicacao"),
    {
      id: "comunicacao.com",
      type: "root",
      title: "Comunicação",
      childs: [
        { id: "com.feed", type: "item", path: "/comunicacao/feed", title: "Feed", icon: "ceo.feed" },
        { id: "com.comunidades", type: "item", path: "/comunicacao/comunidades", title: "Comunidades", icon: "ceo.comunidades" },
        { id: "com.eventos", type: "item", path: "/comunicacao/eventos", title: "Eventos", icon: "ceo.eventos" },
        { id: "com.organograma", type: "item", path: "/comunicacao/organograma", title: "Organograma", icon: "ceo.organograma" },
        { id: "com.pesquisas", type: "item", path: "/comunicacao/pesquisas", title: "Pesquisas", icon: "ceo.pesquisas" },
      ],
    },
  ],

  learning: [
    cockpit("learning"),
    {
      id: "learning.lng",
      type: "root",
      title: "Learning",
      childs: [
        { id: "lng.universidade", type: "item", path: "/learning/universidade", title: "Universidade", icon: "ceo.universidade" },
        { id: "lng.treinamentos", type: "item", path: "/learning/meus-treinamentos", title: "Meus Treinamentos", icon: "ceo.treinamentos" },
        { id: "lng.equipe", type: "item", path: "/learning/equipe-lms", title: "Equipe · LMS", icon: "ceo.equipe" },
      ],
    },
  ],

  performance: [
    cockpit("performance"),
    {
      id: "performance.1on1",
      type: "root",
      title: "One on One",
      childs: [
        { id: "perf.1on1.meus", type: "item", path: "/performance/one-on-one/meus", title: "Meus 1:1", icon: "ceo.1on1" },
        { id: "perf.1on1.agendamento", type: "item", path: "/performance/one-on-one/agendamento", title: "Agendamento", icon: "ceo.agendamento" },
        { id: "perf.1on1.equipe", type: "item", path: "/performance/one-on-one/equipe", title: "Equipe", icon: "ceo.equipe" },
      ],
    },
    {
      id: "performance.ciclo",
      type: "root",
      title: "Ciclo de Desempenho",
      childs: [
        { id: "perf.ciclo.auto", type: "item", path: "/performance/ciclo-de-desempenho/autoavaliacao", title: "Autoavaliação", icon: "ceo.autoavaliacao" },
        { id: "perf.ciclo.360", type: "item", path: "/performance/ciclo-de-desempenho/avaliacao-360", title: "Avaliação 360", icon: "ceo.av360" },
        { id: "perf.ciclo.gestor", type: "item", path: "/performance/ciclo-de-desempenho/avaliacao-do-gestor", title: "Avaliação do Gestor", icon: "ceo.avgestor" },
        { id: "perf.ciclo.feedback", type: "item", path: "/performance/ciclo-de-desempenho/feedback", title: "Feedback", icon: "ceo.feedback" },
        { id: "perf.ciclo.pdi", type: "item", path: "/performance/ciclo-de-desempenho/pdi", title: "PDI", icon: "ceo.pdi" },
        { id: "perf.ciclo.calibracao", type: "item", path: "/performance/ciclo-de-desempenho/calibracao", title: "Calibração", icon: "ceo.calibracao" },
      ],
    },
    {
      id: "performance.elogios",
      type: "root",
      title: "Elogios",
      childs: [
        { id: "perf.elogios.recebidos", type: "item", path: "/performance/elogios/recebidos", title: "Recebidos", icon: "ceo.recebidos" },
        { id: "perf.elogios.enviados", type: "item", path: "/performance/elogios/enviados", title: "Enviados", icon: "ceo.enviados" },
        { id: "perf.elogios.equipe", type: "item", path: "/performance/elogios/equipe", title: "Equipe", icon: "ceo.equipe" },
      ],
    },
    {
      id: "performance.metas",
      type: "root",
      title: "Metas",
      childs: [
        { id: "perf.metas.minhas", type: "item", path: "/performance/metas/minhas-metas", title: "Minhas Metas", icon: "ceo.metas" },
        { id: "perf.metas.corporativa", type: "item", path: "/performance/metas/corporativa", title: "Corporativa", icon: "ceo.corporativa" },
        { id: "perf.metas.area", type: "item", path: "/performance/metas/area", title: "Área", icon: "ceo.area" },
        { id: "perf.metas.individual", type: "item", path: "/performance/metas/individual", title: "Individual", icon: "ceo.individual" },
      ],
    },
  ],

  projetos: [
    cockpit("projetos"),
    {
      id: "projetos.pjt",
      type: "root",
      title: "Projetos e Tarefas",
      childs: [
        { id: "pjt.horas", type: "item", path: "/projetos/alocacao-de-horas", title: "Alocação de Horas", icon: "ceo.horas" },
        { id: "pjt.organizacao", type: "item", path: "/projetos/organizacao", title: "Organização", icon: "ceo.organizacao" },
      ],
    },
  ],

  recrutamento: [
    cockpit("recrutamento"),
    {
      id: "recrutamento.rec",
      type: "root",
      title: "Recrutamento",
      childs: [
        { id: "rec.vagas", type: "item", path: "/recrutamento/vagas", title: "Vagas", icon: "ceo.vagas" },
        { id: "rec.candidatos", type: "item", path: "/recrutamento/candidatos", title: "Candidatos", icon: "ceo.candidatos" },
        { id: "rec.cvs", type: "item", path: "/recrutamento/banco-de-cvs", title: "Banco de CV's", icon: "ceo.cvs" },
        { id: "rec.whatsapp", type: "item", path: "/recrutamento/whatsapp", title: "Whatsapp", icon: "ceo.whatsapp" },
        { id: "rec.documentacao", type: "item", path: "/recrutamento/documentacao", title: "Documentação", icon: "ceo.relatorios" },
        { id: "rec.divulgacao", type: "item", path: "/recrutamento/paginas-de-divulgacao", title: "Páginas de divulgação", icon: "ceo.divulgacao" },
        { id: "rec.campanhas", type: "item", path: "/recrutamento/campanhas", title: "Campanhas", icon: "ceo.campanhas" },
      ],
    },
  ],
};

export const systemNavigation: NavigationTree[] = [
  {
    id: "sistema.root",
    type: "root",
    title: "Sistema",
    childs: [
      { id: "sis.memoria", type: "item", path: "/memoria", title: "Memória", icon: "ceo.memoria" },
      { id: "sis.conectores", type: "item", path: "/conectores", title: "Conectores", icon: "ceo.conectores" },
      { id: "sis.agentes", type: "item", path: "/agentes", title: "Agentes", icon: "ceo.agentes" },
      { id: "sis.configuracoes", type: "item", path: "/configuracoes", title: "Configurações", icon: "ceo.config" },
    ],
  },
];

const SYSTEM_PATHS = ["/memoria", "/conectores", "/agentes", "/configuracoes"];

/** Resolve o código do produto (ou "sistema") a partir do pathname. */
export function getProductCodeFromPath(pathname: string): string {
  if (SYSTEM_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return SYSTEM_CODE;
  }
  const seg = pathname.split("/")[1] ?? "";
  return ceoNavigation[seg] ? seg : DEFAULT_PRODUCT_CODE;
}

/** Seções de navegação para o produto/sistema atual. */
export function getNavigationForPath(pathname: string): NavigationTree[] {
  const code = getProductCodeFromPath(pathname);
  if (code === SYSTEM_CODE) return systemNavigation;
  return ceoNavigation[code] ?? ceoNavigation[DEFAULT_PRODUCT_CODE]!;
}

/** Produto atual (inclui o pseudo-produto "Sistema") para o switcher. */
export function getCurrentProduct(pathname: string): Product {
  const code = getProductCodeFromPath(pathname);
  if (code === SYSTEM_CODE) return systemProduct;
  return products.find((p) => p.code === code) ?? products.find((p) => p.code === DEFAULT_PRODUCT_CODE)!;
}

/** Todos os caminhos-folha (para geração de rotas). */
export function allCeoPaths(): string[] {
  const out: string[] = [];
  const collect = (nodes: NavigationTree[]) => {
    for (const n of nodes) {
      if (n.path && n.type === "item") out.push(n.path);
      if (n.childs) collect(n.childs);
    }
  };
  Object.values(ceoNavigation).forEach(collect);
  collect(systemNavigation);
  return out;
}

/** Título de uma página a partir do path (para o placeholder/breadcrumb). */
export function getTitleForPath(pathname: string): string {
  const all = [...Object.values(ceoNavigation).flat(), ...systemNavigation];
  for (const root of all) {
    for (const child of root.childs ?? []) {
      if (child.path === pathname) return child.title ?? pathname;
    }
  }
  return pathname;
}
