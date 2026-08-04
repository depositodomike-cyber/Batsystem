// Import Dependencies
import { createBrowserRouter, RouteObject } from "react-router";

// Local Imports
import Root from "@/app/layouts/Root";
import RootErrorBoundary from "@/app/pages/errors/RootErrorBoundary";
import { SplashScreen } from "@/components/template/SplashScreen";
import { protectedRoutes } from "./protected";
import { ghostRoutes } from "./ghost";
import { publicRoutes } from "./public";

/**
 * Main application router configuration
 * Combines protected, ghost, and public routes under a common root
 */
const router = createBrowserRouter(
  [
    {
      id: "root",
      Component: Root,
      hydrateFallbackElement: <SplashScreen />,
      ErrorBoundary: RootErrorBoundary,
      children: [protectedRoutes, ghostRoutes, publicRoutes] as RouteObject[],
    },
  ],
  {
    // Subpasta do deploy (ex.: "/behuman"). Vite injeta BASE_URL a partir do
    // `base` do build; em dev é "/" (raiz). O basename precisa começar com "/".
    basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/",
  },
);

export default router;
