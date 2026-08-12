import { RouteObject } from "react-router";

import LegacyFunnelGuard from "@/middleware/LegacyFunnelGuard";

/**
 * Public routes configuration
 * These routes are accessible without authentication
 * Includes error pages, authentication pages, and other public content
 */
const publicRoutes: RouteObject = {
  id: "public",
  children: [
    // Funil legado de criação de conta (cadastro + precificador + onboarding).
    // O código das páginas permanece no repositório para reuso; o guard só as
    // torna inacessíveis enquanto as flags `legacy*` estiverem `true`.
    {
      id: "legacy-funnel",
      Component: LegacyFunnelGuard,
      children: [
        {
          path: "cadastro",
          lazy: async () => ({
            Component: (await import("@/app/pages/cadastro")).default,
          }),
        },
        {
          path: "calculadora",
          lazy: async () => ({
            Component: (await import("@/app/pages/calculadora")).default,
          }),
        },
        {
          path: "onboarding",
          lazy: async () => ({
            Component: (await import("@/app/pages/onboarding")).default,
          }),
        },
      ],
    },
    {
      path: "prototypes",
      children: [
        // Protótipo do novo modelo de contas: criar conta → confirmação de
        // e-mail → criar organização → entrar no produto (sessão automática).
        // Telas distintas, sem wizard numerado. A entrada é o login único da
        // app (`/login`); este fluxo é só o cadastro. O seletor de contexto
        // (`repositorios`) permanece para “Criar organização” no perfil.
        {
          path: "contas",
          lazy: async () => ({
            Component: (await import("@/app/pages/prototypes/contas")).default,
          }),
          children: [
            {
              index: true,
              lazy: async () => ({
                Component: (
                  await import("@/app/pages/prototypes/contas/screens/Roteiro")
                ).default,
              }),
            },
            {
              path: "criar-conta",
              lazy: async () => ({
                Component: (
                  await import("@/app/pages/prototypes/contas/screens/CriarConta")
                ).default,
              }),
            },
            {
              path: "confirmar-email",
              lazy: async () => ({
                Component: (
                  await import(
                    "@/app/pages/prototypes/contas/screens/ConfirmarEmail"
                  )
                ).default,
              }),
            },
            {
              path: "organizacao",
              lazy: async () => ({
                Component: (
                  await import(
                    "@/app/pages/prototypes/contas/screens/ConfigurarOrganizacao"
                  )
                ).default,
              }),
            },
            {
              path: "repositorios",
              lazy: async () => ({
                Component: (
                  await import(
                    "@/app/pages/prototypes/contas/screens/SelecionarRepositorio"
                  )
                ).default,
              }),
            },
          ],
        },
        {
          path: "errors",
          children: [
            {
              path: "404-v1",
              lazy: async () => ({
                Component: (
                  await import("@/app/pages/prototypes/errors/404/v1")
                ).default,
              }),
            },
            {
              path: "404-v2",
              lazy: async () => ({
                Component: (
                  await import("@/app/pages/prototypes/errors/404/v2")
                ).default,
              }),
            },
            {
              path: "404-v3",
              lazy: async () => ({
                Component: (
                  await import("@/app/pages/prototypes/errors/404/v3")
                ).default,
              }),
            },
            {
              path: "401",
              lazy: async () => ({
                Component: (await import("@/app/pages/prototypes/errors/401"))
                  .default,
              }),
            },
            {
              path: "429",
              lazy: async () => ({
                Component: (await import("@/app/pages/prototypes/errors/429"))
                  .default,
              }),
            },
            {
              path: "500",
              lazy: async () => ({
                Component: (await import("@/app/pages/prototypes/errors/500"))
                  .default,
              }),
            },
          ],
        },
        {
          path: "sign-in",
          children: [
            {
              path: "sign-in-1",
              lazy: async () => ({
                Component: (await import("@/app/pages/prototypes/sign-in-1"))
                  .default,
              }),
            },
            {
              path: "sign-in-2",
              lazy: async () => ({
                Component: (await import("@/app/pages/prototypes/sign-in-2"))
                  .default,
              }),
            },
          ],
        },
        {
          path: "sign-up",
          children: [
            {
              path: "sign-up-1",
              lazy: async () => ({
                Component: (await import("@/app/pages/prototypes/sign-up-1"))
                  .default,
              }),
            },
            {
              path: "sign-up-2",
              lazy: async () => ({
                Component: (await import("@/app/pages/prototypes/sign-up-2"))
                  .default,
              }),
            },
          ],
        },
      ],
    },
  ],
};

export { publicRoutes };
