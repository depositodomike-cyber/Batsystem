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
  { code: "behuman", name: "BeHuman" },
  { code: "learning", name: "Learning" },
  { code: "performance", name: "Performance" },
  { code: "project-management", name: "Project Management" },
  { code: "hiring", name: "Hiring" },
];

export const DEFAULT_PRODUCT_CODE = "behuman";

// ----------------------------------------------------------------------
// Squads — catálogo do produto Business Partner (IA).
// O grupo "Squads" na sidebar começa vazio: o usuário fixa squads pelo
// botão "+" (ver SquadsGroup + SquadsProvider). Este catálogo é a fonte
// de verdade de "todos os squads" disponíveis para fixar.
// ----------------------------------------------------------------------

/** Produto ao qual os squads pertencem. */
export const SQUADS_PRODUCT_CODE = "behuman";

export interface Squad {
  id: string;
  slug: string;
  title: string;
  icon: string;
}

// O catálogo de squads agora vem da API (GET /squads) via SquadsProvider
// (ver ts/demo/src/app/contexts/squads). A rota de squad é dinâmica
// (`behuman/:squadSlug` em ceoRoutes), então a navegação não depende mais
// de uma lista estática aqui.

/** Caminho de um squad (a partir do slug) dentro do produto Business Partner. */
export function squadPathFromSlug(slug: string): string {
  return `/${SQUADS_PRODUCT_CODE}/${slug}`;
}

/** Caminho de um squad dentro do produto Business Partner. */
export function squadPath(squad: Pick<Squad, "slug">): string {
  return squadPathFromSlug(squad.slug);
}

// Seção "Home" — presente em todos os produtos (injetada em ceoNavigation).
// Reúne Feed, Insights e Relatórios (a antiga seção "Cockpit" foi removida).
const home = (base: string): NavigationTree => ({
  id: `${base}.home`,
  type: "root",
  title: "Home",
  childs: [
    { id: `${base}.feed`, type: "item", path: `/${base}/feed`, title: "Feed", icon: "ceo.feed" },
    { id: `${base}.insights`, type: "item", path: `/${base}/insights`, title: "Insights", icon: "ceo.insights" },
    { id: `${base}.relatorios`, type: "item", path: `/${base}/relatorios`, title: "Relatórios", icon: "ceo.relatorios" },
  ],
});

// Seção do behuman — o produto não usa a "Home" completa (Feed/Relatórios foram
// removidos a pedido). Sob o cabeçalho "Painel" ficam o Insights (página inicial
// padrão), os widgets migrados do beculture/Confi (Notas e IA) e os conectores
// Email e Slack (movidos do menu superior). A "Memória" é um item expansível
// (clicar abre o grafo) e traz como subitens os uploads de áudio/documento/
// transcrição, que abrem o modal correspondente na tela de IA.
const behumanHome = (base: string): NavigationTree => ({
  id: `${base}.home`,
  type: "root",
  title: "Painel",
  childs: [
    {
      id: `${base}.memoria-grafo`,
      type: "collapse",
      path: `/${base}/memoria-grafo`,
      title: "Memória",
      icon: "ceo.memoria",
      childs: [
        { id: `${base}.upload-audio`, type: "item", path: `/${base}/ia?fn=audio`, title: "Upload Áudio", icon: "ceo.upload-audio" },
        { id: `${base}.upload-documento`, type: "item", path: `/${base}/ia?fn=documento`, title: "Upload Documento", icon: "ceo.upload-documento" },
        { id: `${base}.upload-transcricao`, type: "item", path: `/${base}/ia?fn=transcricao`, title: "Upload Transcrição", icon: "ceo.upload-transcricao" },
      ],
    },
    { id: `${base}.insights`, type: "item", path: `/${base}/insights`, title: "Insights", icon: "ceo.insights" },
    { id: `${base}.notas`, type: "item", path: `/${base}/notas`, title: "Notas", icon: "ceo.notas" },
    // { id: `${base}.todo`, type: "item", path: `/${base}/todo`, title: "To Do", icon: "ceo.todo" },
    { id: `${base}.email`, type: "item", path: `/${base}/email`, title: "Email", icon: "ceo.email" },
    { id: `${base}.slack`, type: "item", path: `/${base}/slack`, title: "Slack", icon: "ceo.slack" },
    { id: `${base}.agenda`, type: "item", path: `/${base}/agenda`, title: "Agenda", icon: "ceo.agenda" },
  ],
});

// Seções por produto (sem a "Home", que é adicionada a todos abaixo).
const ceoNavigationSections: Record<string, NavigationTree[]> = {
  // O grupo "Squads" é renderizado dinamicamente (SquadsGroup) a partir dos
  // squads fixados pelo usuário, por isso não aparece aqui na navegação estática.
  behuman: [],

  learning: [
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

  "project-management": [
    {
      id: "project-management.pjt",
      type: "root",
      title: "Project Management",
      childs: [
        { id: "pjt.horas", type: "item", path: "/project-management/alocacao-de-horas", title: "Alocação de Horas", icon: "ceo.horas" },
        { id: "pjt.organizacao", type: "item", path: "/project-management/organizacao", title: "Organização", icon: "ceo.organizacao" },
      ],
    },
  ],

  hiring: [
    {
      id: "hiring.rec",
      type: "root",
      title: "Hiring",
      childs: [
        { id: "rec.vagas", type: "item", path: "/hiring/vagas", title: "Vagas", icon: "ceo.vagas" },
        { id: "rec.candidatos", type: "item", path: "/hiring/candidatos", title: "Candidatos", icon: "ceo.candidatos" },
        { id: "rec.cvs", type: "item", path: "/hiring/banco-de-cvs", title: "Banco de CV's", icon: "ceo.cvs" },
        { id: "rec.whatsapp", type: "item", path: "/hiring/whatsapp", title: "Whatsapp", icon: "ceo.whatsapp" },
        { id: "rec.documentacao", type: "item", path: "/hiring/documentacao", title: "Documentação", icon: "ceo.relatorios" },
        { id: "rec.divulgacao", type: "item", path: "/hiring/paginas-de-divulgacao", title: "Páginas de divulgação", icon: "ceo.divulgacao" },
        { id: "rec.campanhas", type: "item", path: "/hiring/campanhas", title: "Campanhas", icon: "ceo.campanhas" },
      ],
    },
  ],
};

// Navegação final: cada produto começa pela seção inicial. No behuman é o
// "Painel" (Insights + Notas/IA); nos demais, a "Home" completa
// (Feed/Insights/Relatórios).
export const ceoNavigation: Record<string, NavigationTree[]> = Object.fromEntries(
  Object.entries(ceoNavigationSections).map(([code, sections]) => [
    code,
    [code === "behuman" ? behumanHome(code) : home(code), ...sections],
  ]),
);

// ----------------------------------------------------------------------
// Áreas de "Sistema" — acessadas pelos ícones do menu superior.
// São escopadas pelo produto atual (ex.: /business-partner/memoria), de
// forma que o menu esquerdo permaneça o do produto e só o conteúdo mude.
// ----------------------------------------------------------------------

export interface SystemArea {
  slug: string;
  title: string;
  icon: string;
}

export const systemAreas: SystemArea[] = [
  { slug: "feed", title: "Feed", icon: "ceo.feed" },
  // Conectores migrados do beculture/Confi — fixados no menu superior.
  { slug: "email", title: "Email", icon: "ceo.email" },
  { slug: "slack", title: "Slack", icon: "ceo.slack" },
  { slug: "agenda", title: "Agenda", icon: "ceo.agenda" },
  { slug: "crm", title: "CRM", icon: "ceo.crm" },
  { slug: "whatsapp", title: "WhatsApp", icon: "ceo.whatsapp" },
  { slug: "eventos", title: "Eventos", icon: "ceo.eventos" },
  { slug: "comunidades", title: "Comunidades", icon: "ceo.comunidades" },
  { slug: "organograma", title: "Organograma", icon: "ceo.organograma" },
  { slug: "pesquisas", title: "Pesquisas", icon: "ceo.pesquisas" },
  { slug: "memoria", title: "Diretrizes", icon: "ceo.memoria" },
  { slug: "conectores", title: "Conectores", icon: "ceo.conectores" },
  { slug: "agentes", title: "Agentes", icon: "ceo.agentes" },
  { slug: "chat", title: "Chat", icon: "ceo.chat" },
  { slug: "documentos", title: "Documentos", icon: "ceo.documentos" },
  { slug: "minhas-tarefas", title: "Minhas Tarefas", icon: "ceo.tarefas" },
  { slug: "calendario", title: "Calendário", icon: "ceo.calendario" },
  { slug: "faq", title: "FAQ", icon: "ceo.faq" },
  { slug: "aprovacoes", title: "Aprovações", icon: "ceo.aprovacoes" },
  { slug: "atalhos", title: "Atalhos", icon: "ceo.atalhos" },
  { slug: "bloco-de-notas", title: "Bloco de Notas", icon: "ceo.notas" },
  { slug: "formularios", title: "Formulários", icon: "ceo.formularios" },
  { slug: "automacoes", title: "Automações", icon: "ceo.automacoes" },
  { slug: "tour", title: "Tour", icon: "ceo.tour" },
  { slug: "atualizacoes", title: "Atualizações", icon: "ceo.atualizacoes" },
  { slug: "configuracoes", title: "Configurações", icon: "ceo.config" },
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
      // Ignora a query (ex.: /behuman/ia?fn=audio → /behuman/ia): a rota é a
      // mesma da tela de IA, que lê o parâmetro `fn` para abrir o modal certo.
      // Inclui também os nós "collapse" (ex.: "Memória"), que têm página própria
      // no rótulo além dos subitens — sem isso o path cairia na rota dinâmica de
      // squad e abriria a tela errada.
      if (n.path && (n.type === "item" || n.type === "collapse"))
        out.push(n.path.split("?")[0]);
      if (n.childs) collect(n.childs);
    }
  };
  Object.values(ceoNavigation).forEach(collect);
  // Áreas de sistema escopadas por produto.
  for (const p of products) {
    for (const a of systemAreas) out.push(systemAreaPath(p.code, a.slug));
  }
  // As rotas de squad são dinâmicas (`behuman/:squadSlug` em ceoRoutes),
  // por isso não entram aqui.
  // Remove duplicatas (ex.: /produto/feed vem tanto da seção Home quanto das áreas de sistema).
  return [...new Set(out)];
}

/** Título de uma página a partir do path (para o placeholder/breadcrumb). */
export function getTitleForPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const area = systemAreas.find((a) => a.slug === last);
  if (area) return area.title;
  // Squads têm página própria (SquadDetail) que define o próprio título;
  // este helper só atende rotas estáticas / placeholder.
  for (const root of Object.values(ceoNavigation).flat()) {
    for (const child of root.childs ?? []) {
      if (child.path === pathname) return child.title ?? pathname;
    }
  }
  return pathname;
}
