import { createSafeContext } from "@/utils/createSafeContext";

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
}

export const [ConnectorsContext, useConnectorsContext] =
  createSafeContext<ConnectorsContextValue>(
    "useConnectorsContext must be used within ConnectorsProvider",
  );
