// Import Dependencies
import { ChevronRightIcon, ChevronLeftIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

// Local Imports
import { useLocaleContext } from "@/app/contexts/locale/context";

// ----------------------------------------------------------------------
// Indicador de colapso dos cabeçalhos de grupo da sidebar (Painel, AI Studio,
// Squads, Grupos, Histórico). Aponta para o lado quando o grupo está recolhido
// e gira 90° para baixo quando aberto — mesmo padrão do CollapsibleItem.
// ----------------------------------------------------------------------

export function GroupChevron({ open }: { open: boolean }) {
  const { isRtl } = useLocaleContext();
  const ChevronIcon = isRtl ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <ChevronIcon
      className={clsx(
        "size-3.5 shrink-0 transition-transform duration-200",
        open && "ltr:rotate-90 rtl:-rotate-90",
      )}
    />
  );
}
