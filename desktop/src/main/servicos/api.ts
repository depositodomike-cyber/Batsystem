import { utilityProcess, type UtilityProcess } from "electron";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import { arquivoLog, caminhoExecutor, pastaApi, pastaDadosApi } from "./caminhos";
import { aplicarMigracoes } from "./migracoes";

/**
 * A API do Oracle (NestJS, ts/api) rodando embutida, num utilityProcess do
 * Electron — o Node do próprio app, sem Node instalado na máquina.
 *
 * Porta fixa 3001: os callbacks OAuth cadastrados no Google/Microsoft/Slack
 * apontam para `http://localhost:3001`. Escuta só em 127.0.0.1 (HOST).
 */

export const PORTA_API = 3001;
export const URL_API = `http://127.0.0.1:${PORTA_API}`;

function logDe(nome: string) {
  return createWriteStream(arquivoLog(nome), { flags: "a" });
}

/**
 * Roda o seed do catálogo num utilityProcess, pelo executor (runtime/
 * executor.cjs), que encerra o processo quando o seed termina: o app não se
 * roda como "node" (fuse RunAsNode desligado, GD-16).
 */
function rodarSeed(env: Record<string, string>, timeoutMs: number): Promise<void> {
  const seed = path.join(pastaApi(), "prisma", "seed.js");
  return new Promise((resolve, reject) => {
    if (!existsSync(seed)) return reject(new Error(`Arquivo ausente: ${seed}`));
    const log = logDe("migracoes.log");
    log.write(`
=== ${new Date().toISOString()} seed
`);
    const p = utilityProcess.fork(caminhoExecutor(), ["--seed", seed], {
      cwd: pastaApi(),
      env,
      stdio: "pipe",
      serviceName: "Oracle seed",
    });
    let saida = "";
    const coletar = (b: Buffer) => {
      saida = (saida + b.toString()).slice(-4000);
      log.write(b);
    };
    p.stdout?.on("data", coletar);
    p.stderr?.on("data", coletar);
    const t = setTimeout(() => p.kill(), timeoutMs);
    p.once("exit", (code) => {
      clearTimeout(t);
      log.end();
      if (code === 0) resolve();
      else reject(new Error(`O seed terminou com código ${code}.
${saida.trim()}`));
    });
  });
}

/** Aplica as migrations pendentes (mesmo protocolo do `prisma migrate deploy`). */
export async function migrar(urlBanco: string): Promise<void> {
  const log = logDe("migracoes.log");
  log.write(`
=== ${new Date().toISOString()} migrations
`);
  try {
    await aplicarMigracoes(urlBanco, path.join(pastaApi(), "prisma", "migrations"), (l) =>
      log.write(`${l}
`),
    );
  } catch (err) {
    log.write(`ERRO: ${err instanceof Error ? err.message : String(err)}
`);
    throw err;
  } finally {
    log.end();
  }
}

/** Catálogo de squads/agentes (prisma/seed.ts compilado; idempotente). */
export function semear(env: Record<string, string>): Promise<void> {
  return rodarSeed(env, 180_000);
}

let processo: UtilityProcess | null = null;
let parando = false;
let tentativas: number[] = [];

export function iniciar(env: Record<string, string>, aoCair: (msg: string) => void): void {
  parando = false;
  const log = logDe("api.log");
  log.write(`\n=== ${new Date().toISOString()} iniciando a API\n`);
  const p = utilityProcess.fork(path.join(pastaApi(), "dist", "main.js"), [], {
    cwd: pastaDadosApi(),
    env,
    stdio: "pipe",
    serviceName: "Oracle API",
  });
  p.stdout?.pipe(log);
  p.stderr?.pipe(log);
  processo = p;
  p.once("exit", (code) => {
    if (processo === p) processo = null;
    if (parando) return;
    // Caiu sozinha: reinicia com espera crescente, no máximo 5 vezes em 5 min.
    const agora = Date.now();
    tentativas = tentativas.filter((t) => agora - t < 5 * 60_000);
    if (tentativas.length >= 5) {
      aoCair(`A API parou (código ${code}) e não voltou após 5 tentativas.`);
      return;
    }
    tentativas.push(agora);
    setTimeout(() => iniciar(env, aoCair), 1000 * 2 ** tentativas.length);
  });
}

export function parar(): Promise<void> {
  parando = true;
  const p = processo;
  processo = null;
  if (!p) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, 5000);
    p.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
    p.kill();
  });
}

/**
 * Há uma API do Oracle respondendo na 3001? `GET /user/profile` sem token
 * devolve 401 em JSON do Nest — não basta a porta estar ocupada.
 */
export async function apiRespondendo(timeoutMs = 1500): Promise<boolean> {
  try {
    const r = await fetch(`${URL_API}/user/profile`, { signal: AbortSignal.timeout(timeoutMs) });
    if (r.status !== 401) return false;
    const corpo = (await r.json().catch(() => null)) as { statusCode?: number } | null;
    return corpo?.statusCode === 401;
  } catch {
    return false;
  }
}

export async function portaApiOcupada(): Promise<boolean> {
  try {
    await fetch(`${URL_API}/`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

export async function esperarPronta(timeoutMs: number): Promise<void> {
  const fim = Date.now() + timeoutMs;
  while (Date.now() < fim) {
    if (await apiRespondendo()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("A API não respondeu a tempo. Veja api.log.");
}
