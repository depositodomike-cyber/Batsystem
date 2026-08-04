// Import Dependencies
import { Outlet } from "react-router";
import { useLayoutEffect } from "react";

// Local Imports
import { useSidebarContext } from "@/app/contexts/sidebar/context";
import { useThemeContext } from "@/app/contexts/theme/context";
import { useBreakpointsContext } from "@/app/contexts/breakpoint/context";

// ----------------------------------------------------------------------

export function AppLayout() {
  const { themeLayout } = useThemeContext();
  const { close, open } = useSidebarContext();
  const { lgAndDown, xlAndUp } = useBreakpointsContext();

  useLayoutEffect(() => {
    if (xlAndUp) open();
    return () => {
      if (lgAndDown) close();
    };
  }, [close, lgAndDown, open, xlAndUp]);

  useLayoutEffect(() => {
    if (document?.body?.dataset) {
      let cancelled = false;

      document.body.dataset.layout = "main-layout";

      // Fix flicker layout
      queueMicrotask(() => {
        if (cancelled) return;
        document.body.dataset.layout = "main-layout";
      });

      return () => {
        cancelled = true;
        document.body.dataset.layout = themeLayout;
      };
    }
  }, [themeLayout]);

  return <Outlet />;
}
