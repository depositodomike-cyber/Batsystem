import { Navigate, RouteObject } from "react-router";

import Placeholder from "@/app/pages/ceo/Placeholder";
import { allCeoPaths, products } from "@/app/navigation/ceoOs";

// Rotas geradas a partir dos dados de navegação do CEO OS.
// Cada caminho-folha aponta para a página placeholder por enquanto.
const leafRoutes: RouteObject[] = allCeoPaths().map((p) => ({
  path: p.replace(/^\//, ""),
  Component: Placeholder,
}));

// Acessar a raiz de um produto (ex.: /business-partner) redireciona para o Insights.
const productRedirects: RouteObject[] = products.map((p) => ({
  path: p.code,
  element: <Navigate to={`/${p.code}/insights`} replace />,
}));

export const ceoRoutes: RouteObject[] = [...productRedirects, ...leafRoutes];
