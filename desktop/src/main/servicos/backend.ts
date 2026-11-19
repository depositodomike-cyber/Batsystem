import { app } from "electron";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { URL_DEV } from "../config";
import * as api from "./api";
import { pastaApi, pastaDadosApi, pastaLogs } from "./caminhos";
import * as postgres from "./postgres";
import {
  configInicial,
  filtrarVariaveis,
  lerConfig,
  novaChaveDesktop,
  salvarConfig,
  type ConfigBackend,
} from "./segredos";

/**
 * Orquestra o backend do Oracle Desktop.
 *
 * - **externo**: já há uma API do Oracle na 3001 (o `dev.cmd`, por exemplo) ou
 *   o app está em modo desenvolvimento → só se conecta a ela.
 * - **embutido**: sobe o Postgres local, aplica as migrations, semeia o
 *   catálogo na primeira vez e inicia a API. Para tudo ao sair.
 */

export type ModoBackend = "externo" | "embutido";
export type FaseBackend = "iniciando" | "pronto" | "erro" | "parado";

export interface EstadoBackend {
  modo: ModoBackend | null;
  fase: FaseBackend;
  etapa: string;
  erro: string | null;
  pastaLogs: string;
  importadoEm: string | null;
}

let estado: EstadoBackend = {
  modo: null,
  fase: "parado",
  etapa: "",
  erro: null,
  pastaLogs: "",
  importadoEm: null,
};
const ouvintes = new Set<(e: EstadoBackend) => void>();

export function estadoBackend(): EstadoBackend {
  return { ...estado };
}

export function aoMudarBackend(fn: (e: EstadoBackend) => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function mudar(p: Partial<EstadoBackend>): void {
  estado = { ...estado, ...p };
  for (const fn of ouvintes) fn(estadoBackend());
}

/**
 * Só o mínimo do ambiente do Windows para um processo Node funcionar (GD-08):
 * nada de NODE_OPTIONS, ELECTRON_* ou variáveis de desenvolvimento herdadas.
 */
const DO_SISTEMA = [
  "SystemRoot", "windir", "SystemDrive", "ComSpec", "PATH", "PATHEXT", "TEMP", "TMP",
  "USERPROFILE", "USERNAME", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA",
  "ProgramData", "ProgramFiles", "ProgramFiles(x86)", "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE", "OS", "TZ", "LANG",
];

export function ambienteDoSistema(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of DO_SISTEMA) {
    const v = process.env[k];
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** Variáveis da API: as da configuração + as de execução (que sempre vencem). */
export function envDaApi(cfg: ConfigBackend): Record<string, string> {
  const banco = postgres.urlBanco(cfg.pgSenhaApp);
  return {
    ...ambienteDoSistema(),
    ...filtrarVariaveis(cfg.env),
    NODE_ENV: "production",
    PORT: String(api.PORTA_API),
    HOST: "127.0.0.1",
    DATABASE_URL: banco,
    DATABASE_URL_UNPOOLED: banco,
    // A interface usa oracle-app://app (liberada no CORS); localhost não precisa.
    CORS_ALLOW_LOCALHOST: "false",
    DESKTOP_ACHADOS_PATH: path.join(pastaApi(), "achados.md"),
    PRISMA_HIDE_UPDATE_MESSAGE: "1",
  };
}

/**
 * Configuração criada por versão anterior: papel da aplicação sem senha ainda
 * e chave do gateway desktop em arquivo. Passa tudo para o backend.bin
 * (DPAPI) e apaga a chave em claro e as cópias `.bak` (GD-05, GD-12).
 */
function atualizarConfig(cfg: ConfigBackend): ConfigBackend {
  let mudou = false;
  let c = cfg;
  if (!c.pgSenhaApp) {
    c = { ...c, pgSenhaApp: randomBytes(24).toString("base64url") };
    mudou = true;
  }
  const pastaChave = path.join(pastaDadosApi(), ".desktop");
  if (!c.env.DESKTOP_CHAVE_PRIVADA) {
    const pem = path.join(pastaChave, "servidor.pem");
    const chave = existsSync(pem)
      ? Buffer.from(readFileSync(pem, "utf8"), "utf8").toString("base64")
      : novaChaveDesktop();
    c = { ...c, env: { ...c.env, DESKTOP_CHAVE_PRIVADA: chave } };
    mudou = true;
  }
  if (mudou) salvarConfig(c);
  apagarChavesEmArquivo(pastaChave);
  return c;
}

export function apagarChavesEmArquivo(pastaChave: string): void {
  if (!existsSync(pastaChave)) return;
  for (const f of readdirSync(pastaChave)) {
    if (/^servidor.pem/.test(f)) rmSync(path.join(pastaChave, f), { force: true });
  }
}

async function subirEmbutido(): Promise<void> {
  let cfg = lerConfig();
  if (!cfg) {
    cfg = configInicial();
    salvarConfig(cfg);
  }
  cfg = atualizarConfig(cfg);
  mudar({ etapa: "Preparando o banco local…", importadoEm: cfg.importadoEm ?? null });
  await postgres.inicializar(cfg.pgSenha);
  await postgres.iniciar();
  await postgres.garantirBanco(cfg.pgSenha, cfg.pgSenhaApp);

  const env = envDaApi(cfg);
  mudar({ etapa: "Atualizando a estrutura do banco…" });
  await api.migrar(env.DATABASE_URL);
  if (!cfg.seedFeito) {
    mudar({ etapa: "Carregando o catálogo de agentes…" });
    await api.semear(env);
    cfg = { ...cfg, seedFeito: true };
    salvarConfig(cfg);
  }

  mudar({ etapa: "Iniciando a API…" });
  api.iniciar(env, (msg) => mudar({ fase: "erro", erro: msg }));
  await api.esperarPronta(90_000);
}

export async function iniciarBackend(): Promise<void> {
  mudar({ fase: "iniciando", etapa: "Procurando o servidor do Oracle…", erro: null, pastaLogs: pastaLogs() });
  try {
    // Modo externo (API do dev.cmd) só fora do app instalado: no instalado,
    // um processo qualquer na 3001 que imitasse a API receberia senha e
    // sessão (GD-02). Lá, porta ocupada = falha fechada.
    if (!app.isPackaged && (URL_DEV || (await api.apiRespondendo()))) {
      mudar({ modo: "externo", fase: "pronto", etapa: "" });
      return;
    }
    if (await api.portaApiOcupada()) {
      throw new Error(
        `A porta ${api.PORTA_API} está ocupada por outro programa. Feche-o e abra o Oracle de novo.`,
      );
    }
    mudar({ modo: "embutido" });
    await subirEmbutido();
    mudar({ fase: "pronto", etapa: "" });
  } catch (err) {
    console.error("[backend]", err);
    mudar({ fase: "erro", erro: err instanceof Error ? err.message : String(err) });
  }
}

export async function pararBackend(): Promise<void> {
  if (estado.modo !== "embutido") return;
  mudar({ fase: "parado", etapa: "" });
  await api.parar();
  await postgres.parar();
}

/** Para a API (mantendo o banco no ar) — usado pela importação. */
export async function pararSoApi(): Promise<void> {
  await api.parar();
}

/** Reinicia o embutido do zero, relendo a configuração. */
export async function reiniciarBackend(): Promise<void> {
  await pararBackend();
  await iniciarBackend();
}
