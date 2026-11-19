import { app } from "electron";
import { existsSync, mkdirSync, statSync, truncateSync } from "node:fs";
import path from "node:path";

/** Pastas do backend embutido (todas dentro do perfil do usuário). */

function garantir(p: string): string {
  mkdirSync(p, { recursive: true });
  return p;
}

/** Binários do Postgres (pacote @embedded-postgres/windows-x64, fora do asar). */
export function pastaBinariosPostgres(): string {
  const rel = ["node_modules", "@embedded-postgres", "windows-x64", "native", "bin"];
  return app.isPackaged
    ? path.join(process.resourcesPath, "app.asar.unpacked", ...rel)
    : path.resolve(__dirname, "../../..", ...rel);
}

/** API compilada por scripts/preparar-api.mjs. */
export function pastaApi(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "api")
    : path.resolve(__dirname, "../../../build/api");
}

export const pastaDadosPostgres = () => path.join(app.getPath("userData"), "pgdata");

/**
 * Diretório de trabalho da API: guarda o que ela grava em `process.cwd()`,
 * como `.desktop/servidor.pem` (chave do gateway desktop, fixada pelo agente).
 */
export const pastaDadosApi = () => garantir(path.join(app.getPath("userData"), "api"));

export const pastaLogs = () => garantir(path.join(app.getPath("logs")));

/** Arquivo de log; zera ao passar de 5 MB para não crescer sem limite. */
export function arquivoLog(nome: string): string {
  const p = path.join(pastaLogs(), nome);
  try {
    if (existsSync(p) && statSync(p).size > 5 * 1024 * 1024) truncateSync(p, 0);
  } catch {
    // log é opcional
  }
  return p;
}

/** Executor de scripts em utilityProcess (runtime/executor.cjs; dentro do asar no app instalado). */
export function caminhoExecutor(): string {
  return path.join(app.isPackaged ? app.getAppPath() : path.resolve(__dirname, "../../.."), "runtime", "executor.cjs");
}
