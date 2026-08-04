// Import Dependencies
import { useEffect } from "react";
import { useLocation } from "react-router";

// Local Imports
import { useThemeContext } from "@/app/contexts/theme/context";

// ----------------------------------------------------------------------

/**
 * Mantém o ThemeProvider (que vive acima do RouterProvider) ciente da rota
 * atual, para que as configurações de light/dark sejam aplicadas apenas dentro
 * da aplicação e ignoradas nas telas de login/cadastro/onboarding.
 */
export default function RouteThemeSync() {
  const { pathname } = useLocation();
  const { setActivePathname } = useThemeContext();

  useEffect(() => {
    setActivePathname(pathname);
  }, [pathname, setActivePathname]);

  return null;
}
