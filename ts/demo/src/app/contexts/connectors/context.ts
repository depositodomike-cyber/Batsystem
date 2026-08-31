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
}

export const [ConnectorsContext, useConnectorsContext] =
  createSafeContext<ConnectorsContextValue>(
    "useConnectorsContext must be used within ConnectorsProvider",
  );
