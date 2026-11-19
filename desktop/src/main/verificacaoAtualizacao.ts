import { createHash, createPublicKey, verify } from "node:crypto";
import { createReadStream } from "node:fs";
import { CHAVE_PUBLICA_ATUALIZACAO } from "./chaveAtualizacao";

/**
 * Assinatura própria das atualizações (GD-21).
 *
 * Sem certificado de assinatura de código, quem conseguisse publicar uma
 * release no GitHub instalaria código em todos os Oracles. Por isso cada
 * instalador publicado leva um manifesto `oracle-atualizacao-<versão>.json`
 * assinado com Ed25519 por uma chave privada que NÃO fica no GitHub
 * (scripts/assinar-atualizacao.mjs). A chave pública vai no código, dentro do
 * app.asar (coberto pela validação de integridade). O app só oferece instalar
 * se o manifesto for válido e o sha512 do arquivo baixado bater.
 */

export interface ManifestoAtualizacao {
  versao: string;
  arquivo: string;
  /** sha512 em base64 (o mesmo formato do latest.yml do electron-builder). */
  sha512: string;
  /** Ed25519 em base64 sobre `mensagemAssinada(...)`. */
  assinatura: string;
}

export function mensagemAssinada(m: Pick<ManifestoAtualizacao, "versao" | "arquivo" | "sha512">): Buffer {
  return Buffer.from(`oracle-desktop-atualizacao\n${m.versao}\n${m.arquivo}\n${m.sha512}`, "utf8");
}

export function sha512Arquivo(caminho: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha512");
    createReadStream(caminho)
      .on("data", (b) => h.update(b))
      .on("error", reject)
      .on("end", () => resolve(h.digest("base64")));
  });
}

/** Confere o manifesto contra a chave pública embutida e a versão esperada. */
export function manifestoValido(
  manifesto: unknown,
  versaoEsperada: string,
  chavePublica = CHAVE_PUBLICA_ATUALIZACAO,
): manifesto is ManifestoAtualizacao {
  const m = manifesto as Partial<ManifestoAtualizacao>;
  if (
    !chavePublica ||
    typeof m?.versao !== "string" ||
    typeof m.arquivo !== "string" ||
    typeof m.sha512 !== "string" ||
    typeof m.assinatura !== "string" ||
    m.versao !== versaoEsperada
  ) {
    return false;
  }
  try {
    const chave = createPublicKey({ key: Buffer.from(chavePublica, "base64"), format: "der", type: "spki" });
    return verify(null, mensagemAssinada(m as ManifestoAtualizacao), chave, Buffer.from(m.assinatura, "base64"));
  } catch {
    return false;
  }
}

/** Manifesto válido E arquivo baixado com o mesmo sha512. */
export async function atualizacaoAutentica(
  manifesto: unknown,
  versaoEsperada: string,
  arquivoBaixado: string,
  chavePublica = CHAVE_PUBLICA_ATUALIZACAO,
): Promise<boolean> {
  if (!manifestoValido(manifesto, versaoEsperada, chavePublica)) return false;
  return (await sha512Arquivo(arquivoBaixado)) === manifesto.sha512;
}
