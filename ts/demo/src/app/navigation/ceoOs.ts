import { NavigationTree } from "@/@types/navigation";
import i18n from "@/i18n/config";

// ----------------------------------------------------------------------
// CEO OS — produtos e navegação
// Replica a estrutura de menus do protótipo (app antigo) no formato de
// navegação nativo do Tailux. Cada produto expõe uma lista de "seções"
// (NavigationTree do tipo "root") renderizadas como grupos na sidebar.
// Rótulos: `title` é fallback; `transKey` resolve via i18n (PT/EN).
// ----------------------------------------------------------------------

export interface Product {
  code: string;
  name: string;
}

export const products: Product[] = [
  { code: "behuman", name: "BeHuman" },
  { code: "learning", name: "Learning" },
  { code: "performance", name: "Performance" },
  { code: "project-management", name: "Project Management" },
  { code: "hiring", name: "Hiring" },
];

export const DEFAULT_PRODUCT_CODE = "behuman";

// ----------------------------------------------------------------------
// Squads — catálogo do produto Business Partner (IA).
// ----------------------------------------------------------------------

/** Produto ao qual os squads pertencem. */
export const SQUADS_PRODUCT_CODE = "behuman";

export interface Squad {
  id: string;
  slug: string;
  title: string;
  icon: string;
}

/** Caminho de um squad (a partir do slug) dentro do produto Business Partner. */
export function squadPathFromSlug(slug: string): string {
  return `/${SQUADS_PRODUCT_CODE}/${slug}`;
}

/** Caminho de um squad dentro do produto Business Partner. */
export function squadPath(squad: Pick<Squad, "slug">): string {
  return squadPathFromSlug(squad.slug);
}

const k = (key: string) => `nav.ceo.${key}`;

// Seção "Home" — presente em todos os produtos (exceto behuman).
const home = (base: string): NavigationTree => ({
  id: `${base}.home`,
  type: "root",
  title: "Home",
  transKey: k("home"),
  childs: [
    {
      id: `${base}.feed`,
      type: "item",
      path: `/${base}/feed`,
      title: "Feed",
      transKey: k("feed"),
      icon: "ceo.feed",
    },
    {
      id: `${base}.insights`,
      type: "item",
      path: `/${base}/insights`,
      title: "Insights",
      transKey: k("insights"),
      icon: "ceo.insights",
    },
    {
      id: `${base}.relatorios`,
      type: "item",
      path: `/${base}/relatorios`,
      title: "Relatórios",
      transKey: k("reports"),
      icon: "ceo.relatorios",
    },
  ],
});

const behumanHome = (base: string): NavigationTree => ({
  id: `${base}.home`,
  type: "root",
  title: "Painel",
  transKey: k("panel"),
  childs: [
    {
      id: `${base}.memoria-grafo`,
      type: "collapse",
      path: `/${base}/memoria-grafo`,
      title: "Repositório",
      transKey: k("memory"),
      icon: "ceo.memoria",
      childs: [
        {
          id: `${base}.upload-documento`,
          type: "item",
          path: `/${base}/ia?fn=documento`,
          title: "Upload Documento",
          transKey: k("uploadDocument"),
          icon: "ceo.upload-documento",
        },
        {
          id: `${base}.upload-audio`,
          type: "item",
          path: `/${base}/ia?fn=audio`,
          title: "Upload Áudio",
          transKey: k("uploadAudio"),
          icon: "ceo.upload-audio",
        },
        {
          id: `${base}.upload-transcricao`,
          type: "item",
          path: `/${base}/ia?fn=transcricao`,
          title: "Upload Transcrição",
          transKey: k("uploadTranscript"),
          icon: "ceo.upload-transcricao",
        },
      ],
    },
    {
      id: `${base}.insights`,
      type: "item",
      path: `/${base}/insights`,
      title: "Insights",
      transKey: k("insights"),
      icon: "ceo.insights",
    },
    {
      id: `${base}.notas`,
      type: "item",
      path: `/${base}/notas`,
      title: "Notas",
      transKey: k("notes"),
      icon: "ceo.notas",
    },
    {
      id: `${base}.email`,
      type: "item",
      path: `/${base}/email`,
      title: "Email",
      transKey: k("email"),
      icon: "ceo.email",
    },
    {
      id: `${base}.slack`,
      type: "item",
      path: `/${base}/slack`,
      title: "Slack",
      transKey: k("slack"),
      icon: "ceo.slack",
    },
    {
      id: `${base}.agenda`,
      type: "item",
      path: `/${base}/agenda`,
      title: "Agenda",
      transKey: k("calendar"),
      icon: "ceo.agenda",
    },
  ],
});

const ceoNavigationSections: Record<string, NavigationTree[]> = {
  behuman: [],

  learning: [
    {
      id: "learning.lng",
      type: "root",
      title: "Learning",
      transKey: k("learning"),
      childs: [
        {
          id: "lng.universidade",
          type: "item",
          path: "/learning/universidade",
          title: "Universidade",
          transKey: k("university"),
          icon: "ceo.universidade",
        },
        {
          id: "lng.treinamentos",
          type: "item",
          path: "/learning/meus-treinamentos",
          title: "Meus Treinamentos",
          transKey: k("myTrainings"),
          icon: "ceo.treinamentos",
        },
        {
          id: "lng.equipe",
          type: "item",
          path: "/learning/equipe-lms",
          title: "Equipe · LMS",
          transKey: k("teamLms"),
          icon: "ceo.equipe",
        },
      ],
    },
  ],

  performance: [
    {
      id: "performance.1on1",
      type: "root",
      title: "One on One",
      transKey: k("oneOnOne"),
      childs: [
        {
          id: "perf.1on1.meus",
          type: "item",
          path: "/performance/one-on-one/meus",
          title: "Meus 1:1",
          transKey: k("myOneOnOnes"),
          icon: "ceo.1on1",
        },
        {
          id: "perf.1on1.agendamento",
          type: "item",
          path: "/performance/one-on-one/agendamento",
          title: "Agendamento",
          transKey: k("scheduling"),
          icon: "ceo.agendamento",
        },
        {
          id: "perf.1on1.equipe",
          type: "item",
          path: "/performance/one-on-one/equipe",
          title: "Equipe",
          transKey: k("team"),
          icon: "ceo.equipe",
        },
      ],
    },
    {
      id: "performance.ciclo",
      type: "root",
      title: "Ciclo de Desempenho",
      transKey: k("performanceCycle"),
      childs: [
        {
          id: "perf.ciclo.auto",
          type: "item",
          path: "/performance/ciclo-de-desempenho/autoavaliacao",
          title: "Autoavaliação",
          transKey: k("selfReview"),
          icon: "ceo.autoavaliacao",
        },
        {
          id: "perf.ciclo.360",
          type: "item",
          path: "/performance/ciclo-de-desempenho/avaliacao-360",
          title: "Avaliação 360",
          transKey: k("review360"),
          icon: "ceo.av360",
        },
        {
          id: "perf.ciclo.gestor",
          type: "item",
          path: "/performance/ciclo-de-desempenho/avaliacao-do-gestor",
          title: "Avaliação do Gestor",
          transKey: k("managerReview"),
          icon: "ceo.avgestor",
        },
        {
          id: "perf.ciclo.feedback",
          type: "item",
          path: "/performance/ciclo-de-desempenho/feedback",
          title: "Feedback",
          transKey: k("feedback"),
          icon: "ceo.feedback",
        },
        {
          id: "perf.ciclo.pdi",
          type: "item",
          path: "/performance/ciclo-de-desempenho/pdi",
          title: "PDI",
          transKey: k("pdi"),
          icon: "ceo.pdi",
        },
        {
          id: "perf.ciclo.calibracao",
          type: "item",
          path: "/performance/ciclo-de-desempenho/calibracao",
          title: "Calibração",
          transKey: k("calibration"),
          icon: "ceo.calibracao",
        },
      ],
    },
    {
      id: "performance.elogios",
      type: "root",
      title: "Elogios",
      transKey: k("praise"),
      childs: [
        {
          id: "perf.elogios.recebidos",
          type: "item",
          path: "/performance/elogios/recebidos",
          title: "Recebidos",
          transKey: k("received"),
          icon: "ceo.recebidos",
        },
        {
          id: "perf.elogios.enviados",
          type: "item",
          path: "/performance/elogios/enviados",
          title: "Enviados",
          transKey: k("sent"),
          icon: "ceo.enviados",
        },
        {
          id: "perf.elogios.equipe",
          type: "item",
          path: "/performance/elogios/equipe",
          title: "Equipe",
          transKey: k("team"),
          icon: "ceo.equipe",
        },
      ],
    },
    {
      id: "performance.metas",
      type: "root",
      title: "Metas",
      transKey: k("goals"),
      childs: [
        {
          id: "perf.metas.minhas",
          type: "item",
          path: "/performance/metas/minhas-metas",
          title: "Minhas Metas",
          transKey: k("myGoals"),
          icon: "ceo.metas",
        },
        {
          id: "perf.metas.corporativa",
          type: "item",
          path: "/performance/metas/corporativa",
          title: "Corporativa",
          transKey: k("corporate"),
          icon: "ceo.corporativa",
        },
        {
          id: "perf.metas.area",
          type: "item",
          path: "/performance/metas/area",
          title: "Área",
          transKey: k("area"),
          icon: "ceo.area",
        },
        {
          id: "perf.metas.individual",
          type: "item",
          path: "/performance/metas/individual",
          title: "Individual",
          transKey: k("individual"),
          icon: "ceo.individual",
        },
      ],
    },
  ],

  "project-management": [
    {
      id: "project-management.pjt",
      type: "root",
      title: "Project Management",
      transKey: k("projectManagement"),
      childs: [
        {
          id: "pjt.horas",
          type: "item",
          path: "/project-management/alocacao-de-horas",
          title: "Alocação de Horas",
          transKey: k("hourAllocation"),
          icon: "ceo.horas",
        },
        {
          id: "pjt.organizacao",
          type: "item",
          path: "/project-management/organizacao",
          title: "Organização",
          transKey: k("organization"),
          icon: "ceo.organizacao",
        },
      ],
    },
  ],

  hiring: [
    {
      id: "hiring.rec",
      type: "root",
      title: "Hiring",
      transKey: k("hiring"),
      childs: [
        {
          id: "rec.vagas",
          type: "item",
          path: "/hiring/vagas",
          title: "Vagas",
          transKey: k("jobs"),
          icon: "ceo.vagas",
        },
        {
          id: "rec.candidatos",
          type: "item",
          path: "/hiring/candidatos",
          title: "Candidatos",
          transKey: k("candidates"),
          icon: "ceo.candidatos",
        },
        {
          id: "rec.cvs",
          type: "item",
          path: "/hiring/banco-de-cvs",
          title: "Banco de CV's",
          transKey: k("cvBank"),
          icon: "ceo.cvs",
        },
        {
          id: "rec.whatsapp",
          type: "item",
          path: "/hiring/whatsapp",
          title: "Whatsapp",
          transKey: k("whatsapp"),
          icon: "ceo.whatsapp",
        },
        {
          id: "rec.documentacao",
          type: "item",
          path: "/hiring/documentacao",
          title: "Documentação",
          transKey: k("documentation"),
          icon: "ceo.relatorios",
        },
        {
          id: "rec.divulgacao",
          type: "item",
          path: "/hiring/paginas-de-divulgacao",
          title: "Páginas de divulgação",
          transKey: k("jobPages"),
          icon: "ceo.divulgacao",
        },
        {
          id: "rec.campanhas",
          type: "item",
          path: "/hiring/campanhas",
          title: "Campanhas",
          transKey: k("campaigns"),
          icon: "ceo.campanhas",
        },
      ],
    },
  ],
};

export const ceoNavigation: Record<string, NavigationTree[]> = Object.fromEntries(
  Object.entries(ceoNavigationSections).map(([code, sections]) => [
    code,
    [code === "behuman" ? behumanHome(code) : home(code), ...sections],
  ]),
);

// ----------------------------------------------------------------------
// Áreas de "Sistema" — acessadas pelos ícones do menu superior.
// ----------------------------------------------------------------------

export interface SystemArea {
  slug: string;
  title: string;
  transKey: string;
  icon: string;
}

export const systemAreas: SystemArea[] = [
  { slug: "feed", title: "Feed", transKey: k("feed"), icon: "ceo.feed" },
  { slug: "email", title: "Email", transKey: k("email"), icon: "ceo.email" },
  { slug: "slack", title: "Slack", transKey: k("slack"), icon: "ceo.slack" },
  { slug: "agenda", title: "Agenda", transKey: k("calendar"), icon: "ceo.agenda" },
  { slug: "crm", title: "CRM", transKey: k("crm"), icon: "ceo.crm" },
  { slug: "whatsapp", title: "WhatsApp", transKey: k("whatsapp"), icon: "ceo.whatsapp" },
  { slug: "eventos", title: "Eventos", transKey: k("events"), icon: "ceo.eventos" },
  { slug: "comunidades", title: "Comunidades", transKey: k("communities"), icon: "ceo.comunidades" },
  { slug: "organograma", title: "Organograma", transKey: k("orgChart"), icon: "ceo.organograma" },
  { slug: "pesquisas", title: "Pesquisas", transKey: k("surveys"), icon: "ceo.pesquisas" },
  { slug: "memoria", title: "Regras", transKey: k("guidelines"), icon: "ceo.memoria" },
  { slug: "conectores", title: "Conectores", transKey: k("connectors"), icon: "ceo.conectores" },
  { slug: "agentes", title: "Agentes", transKey: k("agents"), icon: "ceo.agentes" },
  { slug: "chat", title: "Chat", transKey: k("chat"), icon: "ceo.chat" },
  { slug: "documentos", title: "Documentos", transKey: k("documents"), icon: "ceo.documentos" },
  { slug: "minhas-tarefas", title: "Minhas Tarefas", transKey: k("myTasks"), icon: "ceo.tarefas" },
  { slug: "calendario", title: "Calendário", transKey: k("calendarPage"), icon: "ceo.calendario" },
  { slug: "faq", title: "FAQ", transKey: k("faq"), icon: "ceo.faq" },
  { slug: "aprovacoes", title: "Aprovações", transKey: k("approvals"), icon: "ceo.aprovacoes" },
  { slug: "atalhos", title: "Atalhos", transKey: k("shortcuts"), icon: "ceo.atalhos" },
  { slug: "bloco-de-notas", title: "Bloco de Notas", transKey: k("notepad"), icon: "ceo.notas" },
  { slug: "formularios", title: "Formulários", transKey: k("forms"), icon: "ceo.formularios" },
  { slug: "automacoes", title: "Automações", transKey: k("automations"), icon: "ceo.automacoes" },
  { slug: "tour", title: "Tour", transKey: k("tour"), icon: "ceo.tour" },
  { slug: "atualizacoes", title: "Atualizações", transKey: k("updates"), icon: "ceo.atualizacoes" },
  { slug: "configuracoes", title: "Configurações", transKey: k("settings"), icon: "ceo.config" },
];

/** Resolve o código do produto a partir do pathname. */
export function getProductCodeFromPath(pathname: string): string {
  const seg = pathname.split("/")[1] ?? "";
  return ceoNavigation[seg] ? seg : DEFAULT_PRODUCT_CODE;
}

/** Seções de navegação do produto atual (o menu esquerdo nunca vira "sistema"). */
export function getNavigationForPath(pathname: string): NavigationTree[] {
  const code = getProductCodeFromPath(pathname);
  return ceoNavigation[code] ?? ceoNavigation[DEFAULT_PRODUCT_CODE]!;
}

/** Produto atual para o switcher. */
export function getCurrentProduct(pathname: string): Product {
  const code = getProductCodeFromPath(pathname);
  return (
    products.find((p) => p.code === code) ??
    products.find((p) => p.code === DEFAULT_PRODUCT_CODE)!
  );
}

/** Caminho de uma área de sistema dentro de um produto. */
export function systemAreaPath(productCode: string, slug: string): string {
  return `/${productCode}/${slug}`;
}

/** Todos os caminhos-folha (para geração de rotas). */
export function allCeoPaths(): string[] {
  const out: string[] = [];
  const collect = (nodes: NavigationTree[]) => {
    for (const n of nodes) {
      if (n.path && (n.type === "item" || n.type === "collapse"))
        out.push(n.path.split("?")[0]);
      if (n.childs) collect(n.childs);
    }
  };
  Object.values(ceoNavigation).forEach(collect);
  for (const p of products) {
    for (const a of systemAreas) out.push(systemAreaPath(p.code, a.slug));
  }
  return [...new Set(out)];
}

/** Título de uma página a partir do path (para o placeholder/breadcrumb). */
export function getTitleForPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const area = systemAreas.find((a) => a.slug === last);
  if (area) {
    return i18n.t(area.transKey, { defaultValue: area.title });
  }
  for (const root of Object.values(ceoNavigation).flat()) {
    for (const child of root.childs ?? []) {
      if (child.path === pathname) {
        return child.transKey
          ? i18n.t(child.transKey, { defaultValue: child.title })
          : (child.title ?? pathname);
      }
      for (const nested of child.childs ?? []) {
        if (nested.path?.split("?")[0] === pathname) {
          return nested.transKey
            ? i18n.t(nested.transKey, { defaultValue: nested.title })
            : (nested.title ?? pathname);
        }
      }
    }
  }
  return pathname;
}
