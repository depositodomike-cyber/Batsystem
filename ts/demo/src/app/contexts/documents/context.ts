import { createSafeContext } from "@/utils/createSafeContext";

// ----------------------------------------------------------------------

/**
 * Arquivo que acompanha o documento (imagem gerada, MP4 do corte, painel HTML,
 * cards do carrossel…). Guardado como data-URI para sobreviver ao reload — daí
 * a persistência dos documentos ficar no IndexedDB, não no localStorage.
 */
export interface DocumentAttachment {
  name: string;
  /** MIME do arquivo (ex.: "image/png", "video/mp4", "text/html"). */
  mime: string;
  /** Conteúdo em data-URI. */
  dataUrl: string;
}

/** De onde o documento veio: uma resposta de agente ou uma ação do AI Studio. */
export type DocumentSource = "chat" | "ai-studio";

export interface SquadDocument {
  id: string;
  /** Produto ao qual o documento pertence (ex.: "business-partner"). */
  product: string;
  /** Squad de origem (ex.: "bp.conselho"). */
  squadId: string;
  squadName: string;
  /** Agente que produziu o conteúdo, quando aplicável. */
  agentReference?: string;
  /** Chat de origem, quando aplicável. */
  chatId?: string;
  /** Grupo (agrupamento) ao qual o documento pertence, quando salvo num grupo. */
  projectId?: string;
  title: string;
  /** Conteúdo em texto puro (Markdown leve aceito). */
  content: string;
  /** Origem do documento. Ausente = "chat" (documentos anteriores ao AI Studio). */
  source?: DocumentSource;
  /** Ação do AI Studio que gerou o documento (ex.: "artigo", "imagem"). */
  functionId?: string;
  /** Arquivos gerados junto com o conteúdo. */
  attachments?: DocumentAttachment[];
  /** Timestamp ISO de criação. */
  createdAt: string;
}

export type NewDocument = Omit<SquadDocument, "id" | "createdAt">;

export interface DocumentsContextValue {
  documents: SquadDocument[];
  documentsBySquad: (squadId: string) => SquadDocument[];
  /** Documentos salvos em um grupo (agrupamento) específico. */
  documentsByProject: (projectId: string) => SquadDocument[];
  documentsByProduct: (product: string) => SquadDocument[];
  addDocument: (data: NewDocument) => SquadDocument;
  removeDocument: (id: string) => void;
  getDocument: (id: string) => SquadDocument | undefined;
}

export const [DocumentsContext, useDocumentsContext] =
  createSafeContext<DocumentsContextValue>(
    "useDocumentsContext must be used within DocumentsProvider",
  );
