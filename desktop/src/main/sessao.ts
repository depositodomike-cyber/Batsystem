import { app, safeStorage } from "electron";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Token de sessão do Oracle (o mesmo JWT do login web), guardado cifrado com
 * o Electron safeStorage — DPAPI no Windows, atrelado ao usuário do sistema.
 *
 * O token não fica em claro no disco: em memória enquanto o app roda e em
 * `userData/sessao.bin` (cifrado) entre execuções. Se a cifra do sistema não
 * estiver disponível, a sessão vive só na memória (pede login ao reabrir) em
 * vez de cair para texto puro.
 */

let cache: string | null | undefined;

function arquivo(): string {
  return path.join(app.getPath("userData"), "sessao.bin");
}

export function obterToken(): string | null {
  if (cache !== undefined) return cache;
  cache = null;
  try {
    if (existsSync(arquivo()) && safeStorage.isEncryptionAvailable()) {
      const t = safeStorage.decryptString(readFileSync(arquivo()));
      cache = t.trim() !== "" ? t : null;
    }
  } catch (err) {
    // Arquivo corrompido ou de outro usuário do Windows: descarta e pede login.
    console.warn("[sessao] não foi possível ler a sessão salva:", err);
    apagarArquivo();
  }
  return cache;
}

export function salvarToken(token: string | null): void {
  cache = token && token.trim() !== "" ? token : null;
  if (cache === null) {
    apagarArquivo();
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn("[sessao] cifra do sistema indisponível; sessão só em memória.");
    apagarArquivo();
    return;
  }
  writeFileSync(arquivo(), safeStorage.encryptString(cache), { mode: 0o600 });
}

function apagarArquivo(): void {
  try {
    rmSync(arquivo(), { force: true });
  } catch {
    // nada a apagar
  }
}
