import { RouteObject } from "react-router";

/**
 * Public routes configuration
 * These routes are accessible without authentication
 * Includes error pages, authentication pages, and other public content
 */
const publicRoutes: RouteObject = {
  id: "public",
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
    {
      path: "prototypes",
      children: [
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
