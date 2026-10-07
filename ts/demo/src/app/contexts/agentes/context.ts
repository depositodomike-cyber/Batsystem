import { createSafeContext } from "@/utils/createSafeContext";

// ----------------------------------------------------------------------

/** Um agente que pode ser chamado por @menção no Assistente. */
export interface AgenteMencionavel {
  id: string;
  titulo: string;
  /** Sem o "@". */
  mencao: string;
  /** "sistema" = pré-programado (antigo squad); "pessoal" = criado pelo usuário. */
  tipo: "sistema" | "pessoal";
  /** Chave do ícone (sistema: `navigationIcons`; pessoal: "agente:…"). */
  icone: string | null;
  descricao: string;
}

export interface AgentesContextValue {
  /** Agentes do sistema, na ordem do catálogo. */
  sistema: AgenteMencionavel[];
  /** Agentes do usuário, por nome. */
  meus: AgenteMencionavel[];
  /** `sistema` + `meus` — a lista do autocomplete. */
  todos: AgenteMencionavel[];
  carregando: boolean;
  /** Recarrega depois de criar/editar/excluir (o autocomplete reflete na hora). */
  recarregar: () => Promise<void>;
  porId: (id: string) => AgenteMencionavel | undefined;
  /**
   * Agentes @mencionados no texto, na ordem em que aparecem, sem repetir.
   * A comparação ignora acento e caixa (@gestaodepessoas = @GestãoDePessoas);
   * "@algo" que não é agente é só texto.
   */
  encontrarMencoes: (texto: string) => AgenteMencionavel[];
}

export const [AgentesContext, useAgentes] =
  createSafeContext<AgentesContextValue>(
    "useAgentes deve ser usado dentro de <AgentesProvider>",
  );
