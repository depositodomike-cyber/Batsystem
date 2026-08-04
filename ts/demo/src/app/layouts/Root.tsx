// Import Dependencies
import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { lazy, useEffect, useState } from "react";

// Local Imports
import { useAuthContext } from "@/app/contexts/auth/context";
import {
  SplashScreen,
  SPLASH_AFTER_LOGIN_KEY,
} from "@/components/template/SplashScreen";
import { Loadable } from "@/components/shared/Loadable";
import { Progress } from "@/components/template/Progress";
import RouteThemeSync from "@/app/layouts/RouteThemeSync";

const Toaster = Loadable(lazy(() => import("@/components/template/Toaster")));
const Customizer = Loadable(
  lazy(() => import("@/components/template/Customizer")),
);
const Tooltip = Loadable(lazy(() => import("@/components/template/Tooltip")));

// Minimum time the splash screen stays visible so the brand animation can
// play through, even when auth initializes almost instantly.
// O logo se forma em ~2s e depois respira; mantemos a tela até este tempo.
const SPLASH_MIN_DURATION = 4000;

// ----------------------------------------------------------------------

function Root() {
  const { isInitialized, isAuthenticated } = useAuthContext();
  const { pathname } = useLocation();
  const [showSplash, setShowSplash] = useState(false);

  // A animação só aparece logo após um login (flag gravada pelo AuthProvider).
  // Refresh/reaberturas não exibem de novo; logout limpa a flag, então um novo
  // login volta a exibir.
  useEffect(() => {
    if (
      isAuthenticated &&
      window.sessionStorage.getItem(SPLASH_AFTER_LOGIN_KEY) === "1"
    ) {
      setShowSplash(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => {
      window.sessionStorage.removeItem(SPLASH_AFTER_LOGIN_KEY);
      setShowSplash(false);
    }, SPLASH_MIN_DURATION);
    return () => clearTimeout(timer);
  }, [showSplash]);

  // Skip the loading screen on the public funnel (registration + onboarding).
  const isFunnelRoute =
    pathname.startsWith("/cadastro") || pathname.startsWith("/onboarding");

  // Esconde o customizer (engrenagem) também na tela de login.
  const hideCustomizer = isFunnelRoute || pathname.startsWith("/login");

  if (!isFunnelRoute && showSplash) {
    return <SplashScreen />;
  }

  // Aguarda a checagem da sessão sem exibir a animação (evita flash de
  // conteúdo protegido em refresh).
  if (!isInitialized) {
    return null;
  }

  return (
    <>
      <RouteThemeSync />
      <Progress />
      <ScrollRestoration />
      <Outlet />
      <Tooltip />
      <Toaster />
      {/* Esconde o customizer (engrenagem) no login e no funil de cadastro/onboarding. */}
      {!hideCustomizer && <Customizer />}
    </>
  );
}

export default Root;
