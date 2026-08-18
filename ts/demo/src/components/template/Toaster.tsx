// Import Dependencies
import { Toaster as SonnerToaster } from "sonner";

// Local Imports
import { defaultTheme } from "@/configs/theme";
import { useThemeContext } from "@/app/contexts/theme/context";

// ----------------------------------------------------------------------

export default function Toaster() {
  const { isDark, notification } = useThemeContext();

  const position =
    notification?.position || defaultTheme?.notification?.position;

  // A bolinha do assistente é fixa no canto inferior direito e ocupa até 76px
  // do fundo. Em posições "bottom-*" o toast subiria por cima dela — e abaixo
  // de 425px ele ocupa a largura toda, então cobriria a bolinha inteira.
  const offset = position?.startsWith("bottom")
    ? "calc(5.25rem + env(safe-area-inset-bottom))"
    : "16px";

  return (
    <SonnerToaster
      theme={isDark ? "dark" : "light"}
      offset={offset}
      position={position}
      expand={
        notification?.isExpanded || defaultTheme?.notification?.isExpanded
      }
      visibleToasts={
        notification?.visibleToasts || defaultTheme?.notification?.visibleToasts
      }
      richColors
    />
  );
}
