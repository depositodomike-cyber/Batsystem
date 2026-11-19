import { createSafeContext } from "@/utils/createSafeContext";
import type { CredenciaisResumo } from "@/services/api/conectores";

// ----------------------------------------------------------------------

export interface ConnectorsContextValue {
  /** Ids dos conectores atualmente conectados. */
  connectedIds: Set<string>;
  isConnected: (id: string) => boolean;
  connect: (id: string) => void;
  disconnect: (id: string) => void;
  /** Alterna a conexão e persiste. */
  toggleConnection: (id: string) => void;
  /** Workspace/conta autorizada via OAuth (ex.: time do Slack), se houver. */
  getWorkspace: (id: string) => string | null;
  /**
   * Quais campos de credencial estão preenchidos no servidor (Teams, WhatsApp,
   * Drive, OneDrive, YouTube, Zapier). Nunca contém valores.
   */
  getCredenciais: (id: string) => CredenciaisResumo | null;
  /**
   * Registra o resultado de um salvamento de credenciais: marca conectado e
   * guarda o resumo, sem esperar um novo GET /conectores.
   */
  aplicarCredenciais: (id: string, resumo: CredenciaisResumo | null) => void;
  /**
   * Reflete uma conexão que o servidor já fez por outro caminho (ex.: o
   * vínculo do Telegram, confirmado pelo bot), sem chamar a API.
   */
  refletirConexao: (id: string, conectado: boolean, workspace?: string | null) => void;
  /**
   * Busca de novo no servidor o estado de todos os conectores (botão
   * "Sincronizar"; também roda sozinho ao voltar o foco para a janela).
   * Rejeita se a API não responder.
   */
  sincronizar: () => Promise<void>;
}

export const [ConnectorsContext, useConnectorsContext] =
  createSafeContext<ConnectorsContextValue>(
    "useConnectorsContext must be used within ConnectorsProvider",
  );
