import { createSafeContext } from "@/utils/createSafeContext";

// ----------------------------------------------------------------------
// Store de uploads de documento em andamento / concluídos nesta sessão.
// O modal inicia e acompanha o processamento; a página /documento/:id mostra
// o resultado pronto. A requisição vive aqui para sobreviver à minimização do
// modal e à navegação por outras áreas da plataforma.
// ----------------------------------------------------------------------

export type DocumentoUploadEstado = "analisando" | "pronto" | "erro";

export interface DocumentoUpload {
  id: string;
  /** Produto em que o upload começou, para preservar a rota ao concluir. */
  produtoCode?: string;
  /** Nome do arquivo enviado, quando houver (só para exibição). */
  nomeArquivo?: string;
  estado: DocumentoUploadEstado;
  titulo?: string;
  conteudo?: string;
  salvo?: boolean;
  memoriaId?: string;
  erro?: string;
  /** Abre o SugerirPosUpload uma única vez ao concluir com salvo. */
  sugerirPendente?: boolean;
}

export interface IniciarDocumentoInput {
  arquivo?: File | null;
  texto?: string;
}

/**
 * Navegação injetada por quem está DENTRO do router. O provider fica acima do
 * RouterProvider (para o processamento sobreviver à navegação), então não tem
 * useNavigate: o DocumentoUploadNavigator registra o navigate real aqui.
 */
export type NavegadorDocumento = (
  path: string,
  opts?: { replace?: boolean },
) => void;

export interface DocumentoUploadContextValue {
  /** Cria a entrada, processa na API e devolve o documento pronto. */
  iniciar: (input: IniciarDocumentoInput) => Promise<DocumentoUpload>;
  /** Abre a tela existente de visualização do documento. */
  abrirDocumento: (upload: DocumentoUpload) => void;
  /** Busca por id pendente ou por memoriaId. */
  obter: (id: string) => DocumentoUpload | undefined;
  descartar: (id: string) => void;
  /** Marca sugerirPendente como consumido (página já abriu o modal). */
  consumirSugerir: (id: string) => void;
  /** Chamado pelo DocumentoUploadNavigator, de dentro do router. */
  registrarNavegador: (navegar: NavegadorDocumento | null) => void;
}

export const [DocumentoUploadContext, useDocumentoUpload] =
  createSafeContext<DocumentoUploadContextValue>(
    "useDocumentoUpload deve ser usado dentro de <DocumentoUploadProvider>",
  );
