import axios from "@/utils/axios";

// Upload Documento (IA) — chama o backend ts/api (POST /ai/documento,
// multipart). Organiza um documento e o SALVA no Repositório (Documentos).
// Portado do beculture/Confi.

export interface DocumentoResult {
  titulo: string;
  conteudo: string;
  resumo: string;
  salvo: boolean;
  memoriaId?: string;
}

export async function gerarDocumentoApi(p: {
  arquivo?: File | null;
  texto?: string;
}): Promise<DocumentoResult> {
  const fd = new FormData();
  if (p.arquivo) fd.append("arquivo", p.arquivo);
  if (p.texto) fd.append("texto", p.texto);
  const { data } = await axios.post<DocumentoResult>("/ai/documento", fd);
  return data;
}
