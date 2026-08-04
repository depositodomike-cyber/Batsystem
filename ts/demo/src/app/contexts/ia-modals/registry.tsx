import { ComponentType } from "react";

import { ALL_AI_FUNCTIONS } from "@/app/pages/ceo/ia-functions";
import { AnaliseModal } from "@/app/pages/ceo/AnaliseModal";
import { ApresentacaoModal } from "@/app/pages/ceo/ApresentacaoModal";
import { ArtigoModal } from "@/app/pages/ceo/ArtigoModal";
import { AtaModal } from "@/app/pages/ceo/AtaModal";
import { CarrosselModal } from "@/app/pages/ceo/CarrosselModal";
import { CortesModal } from "@/app/pages/ceo/CortesModal";
import { ImagemModal } from "@/app/pages/ceo/ImagemModal";
import { VideoModal } from "@/app/pages/ceo/VideoModal";
import { MelhorarModal } from "@/app/pages/ceo/MelhorarModal";
import { DashboardModal } from "@/app/pages/ceo/DashboardModal";
import { TranscricaoModal } from "@/app/pages/ceo/TranscricaoModal";
import { DocumentoModal } from "@/app/pages/ceo/DocumentoModal";
import { AudioModal } from "@/app/pages/ceo/AudioModal";

import { IaModalMeta } from "./context";

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
  { ...fn("analise"), Component: AnaliseModal },
  { ...fn("apresentacao"), Component: ApresentacaoModal },
  { ...fn("artigo"), Component: ArtigoModal },
  { ...fn("ata"), Component: AtaModal },
  { ...fn("carrossel"), Component: CarrosselModal },
  { ...fn("cortes"), Component: CortesModal },
  { ...fn("imagem"), Component: ImagemModal },
  { ...fn("video"), Component: VideoModal },
  { ...fn("melhorar"), Component: MelhorarModal },
  { ...fn("dashboard"), Component: DashboardModal },
  // Modais de upload — acessíveis pelos subitens da Memória na sidebar.
  { ...fn("transcricao"), Component: TranscricaoModal },
  { ...fn("documento"), Component: DocumentoModal },
  { ...fn("audio"), Component: AudioModal },
];

export const IA_MODALS_BY_ID: Record<string, IaModalEntry> = Object.fromEntries(
  IA_MODALS.map((m) => [m.id, m]),
);
