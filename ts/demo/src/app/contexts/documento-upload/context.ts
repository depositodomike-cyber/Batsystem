import { createSafeContext } from "@/utils/createSafeContext";

// ----------------------------------------------------------------------
// Store de uploads de documento em andamento / concluídos nesta sessão.
// O DocumentoModal só inicia o processo; a página /documento/:id acompanha
// o progresso e mostra o resultado. A requisição vive aqui para sobreviver
// à navegação (e ao fechamento do modal).
// ----------------------------------------------------------------------

export type DocumentoUploadEstado = "analisando" | "pronto" | "erro";

export interface DocumentoUpload {
  id: string;
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
  /** Cria a entrada, navega para a página e dispara a API. Devolve o id pendente. */
  iniciar: (input: IniciarDocumentoInput) => string;
  /** Busca por id pendente ou por memoriaId (após o replace da URL). */
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
