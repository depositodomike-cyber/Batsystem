import axios, { HEADER_ORGANIZACAO } from "@/utils/axios";

// Cliente do Repositório da organização (backend: /repositorio-org/documentos).
// A base de conhecimento compartilhada da organização — fonte própria, separada
// do vault da pasta local (services/api/vault.ts).
//
// Cada chamada recebe o DONO (organização) e o manda no header
// X-Organizacao-Id explicitamente. O interceptor de utils/axios.ts também o
// injeta, mas a partir de um valor de módulo que só é gravado depois do
// primeiro render — explícito, a tela nunca lista a organização errada.

export type StatusDocumentoOrg = "processando" | "disponivel" | "erro";

export interface DocumentoOrg {
  id: string;
  nome: string;
  /** Extensão sem ponto, em minúsculas. */
  tipo: string;
  tamanho: number;
  status: StatusDocumentoOrg;
  erro: string | null;
  adicionadoPorNome: string;
  /** ISO. */
  criadoEm: string;
}

function comDono(dono: string) {
  return { headers: { [HEADER_ORGANIZACAO]: dono } };
}

/** GET — documentos da organização, mais recentes primeiro. */
export async function listarDocumentosOrg(
  dono: string,
): Promise<DocumentoOrg[]> {
  const { data } = await axios.get<{ documentos: DocumentoOrg[] }>(
    "/repositorio-org/documentos",
    comDono(dono),
  );
  return data.documentos ?? [];
}

/**
 * POST (multipart) — envia um arquivo. O servidor extrai o texto na mesma
 * requisição e devolve a linha já `disponivel` (ou `erro`, com a causa).
 */
export async function enviarDocumentoOrg(
  dono: string,
  arquivo: File,
): Promise<DocumentoOrg> {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  const { data } = await axios.post<{ documento: DocumentoOrg }>(
    "/repositorio-org/documentos",
    fd,
    comDono(dono),
  );
  return data.documento;
}

/** DELETE — remove o documento da organização. */
export async function removerDocumentoOrg(
  dono: string,
  id: string,
): Promise<void> {
  await axios.delete(
    `/repositorio-org/documentos/${encodeURIComponent(id)}`,
    comDono(dono),
  );
}
