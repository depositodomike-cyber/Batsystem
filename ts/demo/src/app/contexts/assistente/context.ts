// Estado do assistente em bolinha (canto inferior direito). Fica num contexto
// porque a mesma conversa é dirigida por DUAS entradas — a barra de prompt do
// header e o input do próprio painel — e o painel vive fora do header.
import { createSafeContext } from "@/utils/createSafeContext";
import type { Fonte, ModoBusca } from "@/services/api/prompt";

// ----------------------------------------------------------------------

/** Um par pergunta/resposta da conversa. `pendente` = resposta a caminho. */
export interface Turno {
  pergunta: string;
  resposta: string;
  fontes: Fonte[];
  origem: "vault" | "web";
  pendente?: boolean;
}

/** "minimized" mantém a conversa em memória, só recolhe o painel na bolinha. */
export type AssistenteStatus = "closed" | "open" | "minimized";

export type AssistenteTab = "chat" | "historico";

/** Resultado de `perguntar` — a barra desenha a própria linha de status com ele. */
export type PerguntarResult =
  | { ok: true; origem: "vault" | "web" }
  | { ok: false; erro: string };

export interface AssistenteContextValue {
  status: AssistenteStatus;
  tab: AssistenteTab;
  conversa: Turno[];
  conversaId: string | null;
  modoConversa: ModoBusca;
  loading: boolean;
  /** Resposta chegou com o painel fechado/minimizado → badge na bolinha. */
  naoLido: boolean;

  /** Painel ampliado (janela central) em vez de ancorado no canto. */
  expandido: boolean;

  setTab: (t: AssistenteTab) => void;
  setExpandido: (v: boolean) => void;
  /** Restaura a conversa atual (ou abre no estado vazio, se não houver). */
  open: () => void;
  minimize: () => void;
  close: () => void;
  /** Limpa a conversa e mantém o painel aberto na aba Chat. */
  novaConversa: () => void;

  /** Pergunta nova: zera a conversa, abre o painel e responde. */
  perguntar: (p: {
    texto: string;
    modo: ModoBusca;
    arquivo?: File | null;
  }) => Promise<PerguntarResult>;
  /** Follow-up dentro da conversa aberta. */
  continuar: (texto: string) => Promise<void>;
  /** Carrega uma conversa persistida do histórico dentro do painel. */
  abrirConversa: (id: string) => Promise<void>;
}

export const [AssistenteProvider, useAssistente] =
  createSafeContext<AssistenteContextValue>(
    "useAssistente deve ser usado dentro de <AssistenteHostProvider>",
  );
