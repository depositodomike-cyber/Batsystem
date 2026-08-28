import { idbGet, idbSet } from "@/utils/idbKv";
import { chaveConta } from "@/utils/escopoConta";

// ----------------------------------------------------------------------
// Cópia durável do arquivo que originou um documento.
//
// O `File` do upload vive no store da sessão (DocumentoUpload.arquivoOriginal),
// que morre no reload — e /documento/:id é uma rota permanente, com deep link.
// Sem esta cópia, recarregar a página e só então clicar "Salvar na memória"
// gravaria a nota SEM o original, deixando o botão de exportar desabilitado sem
// motivo aparente. Guardamos o Blob direto (o IndexedDB clona Blob; a função é
// gated no Chrome de todo modo), evitando os ~33% de inflação do base64.
// ----------------------------------------------------------------------

/** Mesmo teto dos anexos de grupo (EnviarParaGrupo.tsx) — acima disso, não persiste. */
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

interface OriginalGuardado {
  nome: string;
  dados: Blob;
}

function chave(memoriaId: string): string {
  return chaveConta(`beculture.documento-original.v1:${memoriaId}`);
}

/**
 * Guarda os bytes do upload sob o id da memória. Falha em silêncio: é uma
 * conveniência, e um erro aqui não deve derrubar o upload que já deu certo.
 */
export async function guardarOriginal(
  memoriaId: string,
  nome: string,
  dados: Blob,
): Promise<void> {
  if (dados.size > MAX_ORIGINAL_BYTES) return;
  try {
    await idbSet(chave(memoriaId), { nome, dados } satisfies OriginalGuardado);
  } catch {
    /* sem cópia durável — o original da sessão ainda serve */
  }
}

/** Recupera o upload guardado, ou `undefined` se não houver. */
export async function lerOriginalGuardado(
  memoriaId: string,
): Promise<OriginalGuardado | undefined> {
  try {
    const v = await idbGet<OriginalGuardado>(chave(memoriaId));
    return v?.dados instanceof Blob && v.nome ? v : undefined;
  } catch {
    return undefined;
  }
}
