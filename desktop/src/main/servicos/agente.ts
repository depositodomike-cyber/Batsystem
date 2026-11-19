import { app } from "electron";
import { execFile, spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { arquivoLog } from "./caminhos";

/**
 * Supervisão do Oracle Local Agent (desktop-agent/, .NET).
 *
 * O agente continua 100% independente: fala só com a API, por long-poll
 * assinado, e não abre porta nem IPC (SR-24). O app desktop NÃO conversa com
 * ele — apenas:
 * - lê se este computador está pareado (`agent.json`: só a URL da API e o
 *   estado "parado localmente"; nenhum segredo, a chave fica na CNG);
 * - vê se o processo está rodando;
 * - inicia `oracle-agent run --background` quando o usuário quer.
 * Parar, pausar e confirmar permissões continuam na bandeja do próprio agente.
 */

export interface EstadoAgente {
  instalado: boolean;
  caminho: string | null;
  pareado: boolean;
  api: string | null;
  paradoLocal: boolean;
  rodando: boolean;
}

function pastaConfig(): string {
  const h = process.env.ORACLE_AGENT_HOME;
  return h && h.length > 0 ? h : path.join(process.env.LOCALAPPDATA ?? "", "Oracle");
}

function registrar(evento: string, detalhe = ""): void {
  try {
    appendFileSync(arquivoLog("agente.log"), `${new Date().toISOString()} ${evento} ${detalhe}\n`);
  } catch {
    // log é opcional
  }
}

/** Ferramentas do Windows por caminho absoluto, nunca pelo PATH (GD-12). */
const SYSTEM32 = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32");
const REG = path.join(SYSTEM32, "reg.exe");
const TASKLIST = path.join(SYSTEM32, "tasklist.exe");

function rodar(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 10_000 }, (_err, stdout) => resolve(stdout ?? ""));
  });
}

/** Caminho do agente cadastrado para iniciar com o Windows (o próprio agente grava). */
async function caminhoDoRegistro(): Promise<string | null> {
  const saida = await rodar(REG, [
    "query",
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
    "/v",
    "OracleLocalAgent",
  ]);
  const m = /REG_SZ\s+"([^"]+oracle-agent\.exe)"/i.exec(saida);
  return m && existsSync(m[1]) ? m[1] : null;
}

/**
 * Onde está o executável. No app instalado, SÓ o que veio no pacote (GD-12):
 * um caminho lido do registro não é iniciado. Fora dele (desenvolvimento), o
 * build local e, por último, o cadastrado pelo próprio agente na chave Run.
 */
async function localizar(): Promise<string | null> {
  if (app.isPackaged) {
    const empacotado = path.join(process.resourcesPath, "agente", "oracle-agent.exe");
    return existsSync(empacotado) ? empacotado : null;
  }
  const candidatos = [
    path.resolve(__dirname, "../../../build/agente/oracle-agent.exe"),
    path.resolve(
      __dirname,
      "../../../../desktop-agent/src/OracleAgent/bin/Release/net8.0-windows10.0.19041.0/oracle-agent.exe",
    ),
  ];
  return candidatos.find((c) => existsSync(c)) ?? (await caminhoDoRegistro());
}

async function rodando(): Promise<boolean> {
  const saida = await rodar(TASKLIST, ["/FI", "IMAGENAME eq oracle-agent.exe", "/FO", "CSV", "/NH"]);
  return /"oracle-agent\.exe"/i.test(saida);
}

export async function estadoAgente(): Promise<EstadoAgente> {
  let pareado = false;
  let api: string | null = null;
  let paradoLocal = false;
  try {
    const cfg = JSON.parse(readFileSync(path.join(pastaConfig(), "agent.json"), "utf8")) as {
      api?: unknown;
      dispositivoId?: unknown;
      paradoLocal?: unknown;
    };
    pareado = typeof cfg.dispositivoId === "string" && cfg.dispositivoId.length > 0;
    api = typeof cfg.api === "string" ? cfg.api : null;
    paradoLocal = cfg.paradoLocal === true;
  } catch {
    // não pareado
  }
  const caminho = await localizar();
  return { instalado: caminho !== null, caminho, pareado, api, paradoLocal, rodando: await rodando() };
}

/** Inicia o agente na bandeja. O mutex do próprio agente impede duas instâncias. */
export async function iniciarAgente(): Promise<{ ok: boolean; mensagem: string }> {
  const e = await estadoAgente();
  if (!e.caminho) return { ok: false, mensagem: "O Oracle Local Agent não está instalado neste computador." };
  if (!e.pareado) {
    return { ok: false, mensagem: "Este computador ainda não foi pareado. Veja Configurações → Ambiente local." };
  }
  if (e.rodando) return { ok: true, mensagem: "O agente já está rodando." };
  const p = spawn(e.caminho, ["run", "--background"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    cwd: path.dirname(e.caminho),
  });
  p.unref();
  registrar("iniciado", e.caminho);
  await new Promise((r) => setTimeout(r, 1500));
  const depois = await rodando();
  if (!depois) registrar("falhou-ao-iniciar", e.caminho);
  return depois
    ? { ok: true, mensagem: "Agente local iniciado." }
    : { ok: false, mensagem: "O agente não ficou rodando. Abra-o manualmente para ver o erro." };
}

/** Na abertura do app: inicia o agente se pareado, instalado e parado. Uma vez só. */
export async function iniciarAgenteNaAbertura(): Promise<void> {
  const e = await estadoAgente();
  if (e.pareado && e.instalado && !e.rodando) await iniciarAgente();
}
