import { Navigate, useParams, type RouteObject } from "react-router";

import Placeholder from "@/app/pages/ceo/Placeholder";
import ProjectDetail from "@/app/pages/ceo/ProjectDetail";
import ChatDetail from "@/app/pages/ceo/ChatDetail";
import SquadDetail from "@/app/pages/ceo/SquadDetail";
import Conectores from "@/app/pages/ceo/Conectores";
import Documentos from "@/app/pages/ceo/Documentos";
import Email from "@/app/pages/ceo/Email";
import Slack from "@/app/pages/ceo/Slack";
import Ia from "@/app/pages/ceo/Ia";
import Notas from "@/app/pages/ceo/Notas";
import ToDo from "@/app/pages/ceo/ToDo";
import MemoriaGrafo from "@/app/pages/ceo/MemoriaGrafo";
import MemoriaLista from "@/app/pages/ceo/MemoriaLista";
import Documento from "@/app/pages/ceo/Documento";
import Configuracoes from "@/app/pages/ceo/Configuracoes";
import Feed from "@/app/pages/ceo/Feed";
import FeedDetail from "@/app/pages/ceo/FeedDetail";
import BusinessPartnerInsights from "@/app/pages/ceo/Insights";
import BusinessPartnerRelatorios from "@/app/pages/ceo/Relatorios";
import RelatorioDetail from "@/app/pages/ceo/RelatorioDetail";
import {
  allCeoPaths,
  products,
  SQUADS_PRODUCT_CODE,
} from "@/app/navigation/ceoOs";
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";

const GRAFO_DESABILITADO = isFeatureTemporarilyDisabled("memoryGraph");
const REPOSITORIO_HOME = GRAFO_DESABILITADO ? "memoria-lista" : "memoria-grafo";

// Insights é por produto (cada produto tem a sua própria página, diferente do
// Feed). Aqui só o Business Partner tem página dedicada; os demais caem no
// Placeholder até ganharem a sua.
const insightsPages: Record<string, RouteObject["Component"]> = {
  behuman: BusinessPartnerInsights,
};

// Relatórios também é por produto. Só o Business Partner tem página dedicada;
// os demais caem no Placeholder até ganharem a sua.
const relatoriosPages: Record<string, RouteObject["Component"]> = {
  behuman: BusinessPartnerRelatorios,
};

// Páginas dedicadas por slug (último segmento do caminho). O lookup é por
// igualdade, então não há ordem a respeitar entre slugs parecidos como
// "memoria" e "memoria-grafo". O que não estiver aqui cai no Placeholder.
const pageBySlug: Record<string, RouteObject["Component"]> = {
  configuracoes: Configuracoes,
  conectores: Conectores,
  documentos: Documentos,
  email: Email,
  slack: Slack,
  "memoria-grafo": MemoriaGrafo,
  ia: Ia,
  notas: Notas,
  todo: ToDo,
};

// Rotas geradas a partir dos dados de navegação do CEO OS. Feed, Insights e
// Relatórios ficam de fora do mapa acima porque variam por produto. (Squads têm
// rota própria dinâmica — ver squadRoute abaixo.)
const leafRoutes: RouteObject[] = allCeoPaths().map((p) => {
  const slug = p.split("/").pop() ?? "";
  const productCode = p.split("/")[1] ?? "";
  if (slug === "memoria-grafo" && GRAFO_DESABILITADO) {
    return {
      path: p.replace(/^\//, ""),
      element: <Navigate to={`/${productCode}/memoria-lista`} replace />,
    };
  }
  return {
    path: p.replace(/^\//, ""),
    Component:
      slug === "feed"
        ? Feed
        : slug === "insights"
          ? (insightsPages[productCode] ?? Placeholder)
          : slug === "relatorios"
            ? (relatoriosPages[productCode] ?? Placeholder)
            : (pageBySlug[slug] ?? Placeholder),
  };
});

// Rota dinâmica de squad: `behuman/:squadSlug`. O catálogo é carregado da API
// (SquadsProvider), então não há mais uma rota estática por squad. As rotas
// estáticas acima (feed, insights, relatórios, conectores e áreas de sistema)
// têm prioridade na correspondência do React Router por serem mais específicas;
// qualquer outro slug de 1 segmento cai aqui e é resolvido pelo SquadDetail.
const squadRoute: RouteObject = {
  path: `${SQUADS_PRODUCT_CODE}/:squadSlug`,
  Component: SquadDetail,
};

// Acessar a raiz de um produto redireciona para a sua página inicial. No behuman
// a home é o Repositório; nos demais produtos continua sendo o Insights.
const productHome: Record<string, string> = {
  behuman: REPOSITORIO_HOME,
};
const productRedirects: RouteObject[] = products.map((p) => ({
  path: p.code,
  element: <Navigate to={`/${p.code}/${productHome[p.code] ?? "insights"}`} replace />,
}));

// Contexto tem duas telas sobre a MESMA pasta de notas .md: o Grafo (item da
// árvore de navegação, logo já coberto por leafRoutes) e a Lista, que a seção
// Context da sidebar renderiza à parte — por não estar na árvore, a rota dela é
// declarada aqui.
const memoriaListaRoutes: RouteObject[] = products.map((p) => ({
  path: `${p.code}/memoria-lista`,
  Component: MemoriaLista,
}));

// Regras agora vive dentro de Configurações. Mantém links e favoritos antigos
// funcionando sem expor uma segunda entrada independente no sistema.
const memoriaRedirects: RouteObject[] = products.map((p) => ({
  path: `${p.code}/memoria`,
  element: (
    <Navigate to={`/${p.code}/configuracoes?secao=regras`} replace />
  ),
}));

// Detalhe de um documento gerado pelo upload de IA (Memória category documentos).
const documentoRoutes: RouteObject[] = products.map((p) => ({
  path: `${p.code}/documento/:documentoId`,
  Component: Documento,
}));

// Detalhe de um projeto criado no grupo "Agrupamentos".
const projectRoutes: RouteObject[] = products.map((p) => ({
  path: `${p.code}/agrupamentos/:projectId`,
  Component: ProjectDetail,
}));

// Detalhe de uma conversa do grupo "Histórico".
const chatRoutes: RouteObject[] = products.map((p) => ({
  path: `${p.code}/historico/:chatId`,
  Component: ChatDetail,
}));

// Detalhe de uma notícia do Feed.
const feedDetailRoutes: RouteObject[] = products.map((p) => ({
  path: `${p.code}/feed/:feedId`,
  Component: FeedDetail,
}));

// Dashboard de um relatório — só para produtos com página de Relatórios.
const relatorioDetailRoutes: RouteObject[] = Object.keys(relatoriosPages).map(
  (code) => ({
    path: `${code}/relatorios/:relatorioId`,
    Component: RelatorioDetail,
  }),
);

// Redireciona URLs antigas do slug "business-partner" para o novo "behuman",
// preservando o restante do caminho (ex.: /business-partner/feed → /behuman/feed).
function LegacyProductRedirect() {
  const rest = useParams()["*"] ?? "";
  return <Navigate to={`/behuman${rest ? `/${rest}` : `/${REPOSITORIO_HOME}`}`} replace />;
}

const legacyRedirects: RouteObject[] = [
  { path: "business-partner", element: <LegacyProductRedirect /> },
  { path: "business-partner/*", element: <LegacyProductRedirect /> },
];

export const ceoRoutes: RouteObject[] = [
  ...legacyRedirects,
  ...productRedirects,
  ...memoriaListaRoutes,
  ...memoriaRedirects,
  ...documentoRoutes,
  ...projectRoutes,
  ...chatRoutes,
  ...feedDetailRoutes,
  ...relatorioDetailRoutes,
  ...leafRoutes,
  squadRoute,
];
