import { ComponentType } from "react";

import { ALL_AI_FUNCTIONS } from "@/app/pages/ceo/ia-functions";
import { CortesModal } from "@/app/pages/ceo/CortesModal";
import { VideoModal } from "@/app/pages/ceo/VideoModal";
import { UploadModal } from "@/app/pages/ceo/UploadModal";

import { IaModalMeta, IaModalOpenPayload } from "./context";

// ----------------------------------------------------------------------
// Registro único das janelas de IA que podem ser minimizadas para o rodapé.
// Cada entrada combina os metadados (rótulo/ícone do chip) com o componente do
// modal. O host global (Provider) percorre esta lista para montar/desmontar os
// modais conforme o estado no contexto.
// ----------------------------------------------------------------------

// Props que todo modal de IA passa a aceitar. `onMinimize` é opcional para
// preservar compatibilidade com usos fora do host.
export interface IaModalProps {
  isOpen: boolean;
  close: () => void;
  onMinimize?: () => void;
  /** Payload opcional da última chamada a `open(id, payload)`. */
  payload?: IaModalOpenPayload;
}

export interface IaModalEntry extends IaModalMeta {
  Component: ComponentType<IaModalProps>;
}

// Metadados dos cards da tela de IA (Ia.tsx / AI Studio) — reaproveitados aqui
// para que rótulo e ícone do chip fiquem sempre em sincronia.
const fn = (id: string): IaModalMeta => {
  const f = ALL_AI_FUNCTIONS.find((x) => x.id === id);
  if (!f) throw new Error(`Função de IA desconhecida: ${id}`);
  return { id: f.id, title: f.label, Icon: f.Icon, tint: f.tint };
};

export const IA_MODALS: IaModalEntry[] = [
  // Análise, Artigo, Ata, Carrossel, Dashboard, Imagem e Melhorar viraram
  // PÁGINAS do Lab (ver AI_STUDIO_FUNCTION_SCREENS em ia-functions.ts). Vídeo e
  // Cortes seguem janelas: a renderização/exportação continua ao navegar.
  { ...fn("cortes"), Component: CortesModal },
  { ...fn("video"), Component: VideoModal },
  // Modal único de Upload (Documento / Áudio / Transcrições) — topbar.
  { ...fn("upload"), Component: UploadModal },
];

export const IA_MODALS_BY_ID: Record<string, IaModalEntry> = Object.fromEntries(
  IA_MODALS.map((m) => [m.id, m]),
);
