import { ElementType } from "react";

import { createSafeContext } from "@/utils/createSafeContext";

// Estado de cada janela de IA: "open" (visível) ou "minimized" (recolhida no
// rodapé, mas ainda montada — o estado interno do modal é preservado).
export type IaModalStatus = "open" | "minimized";

export interface IaModalsContextValue {
  // Mapa id → status das janelas montadas. Ids ausentes estão fechados
  // (desmontados; ao reabrir começam do zero).
  states: Record<string, IaModalStatus>;
  open: (id: string) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  restore: (id: string) => void;
}

export const [IaModalsProvider, useIaModals] = createSafeContext<IaModalsContextValue>(
  "useIaModals deve ser usado dentro de <IaModalsHostProvider>",
);

// Metadados de cada modal — usados pelo dock (rótulo/ícone do chip minimizado).
export interface IaModalMeta {
  id: string;
  title: string;
  Icon: ElementType;
  tint: string;
}
