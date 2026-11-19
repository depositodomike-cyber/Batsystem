import { execFile, spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, openSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { Client } from "pg";
import { arquivoLog, pastaBinariosPostgres, pastaDadosPostgres } from "./caminhos";

/**
 * Postgres 16 embutido (mesma versão major do container de desenvolvimento).
 *
 * - Dados em `userData/pgdata`, criados no primeiro uso com `initdb`.
 * - Escuta SÓ em 127.0.0.1, autenticação scram-sha-256 com senha aleatória.
 * - Iniciado e parado pelo app (pg_ctl), sem serviço do Windows.
 */

/** Superusuário: só cria/apaga o banco e o papel da aplicação. */
export const PG_USUARIO = "oracle";
/**
 * Papel da aplicação (API, migrations, restauração da importação): SEM
 * superusuário, dono só do banco `oracle` (GD-05). Não pode usar
 * `COPY … PROGRAM`, ler arquivos do servidor nem criar extensões.
 */
export const PG_USUARIO_APP = "oracle_app";
export const PG_BANCO = "oracle";
const PORTA_PREFERIDA = 5434;

function exe(nome: string): string {
  return path.join(pastaBinariosPostgres(), `${nome}.exe`);
}

function rodar(nome: string, args: string[], timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(exe(nome), args, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      const saida = `${stdout ?? ""}${stderr ?? ""}`.trim();
      if (err) reject(new Error(`${nome} falhou: ${saida || err.message}`));
      else resolve(saida);
    });
  });
}

export function inicializado(): boolean {
  return existsSync(path.join(pastaDadosPostgres(), "PG_VERSION"));
}

export async function inicializar(senha: string): Promise<void> {
  if (inicializado()) return;
  const pwfile = path.join(path.dirname(pastaDadosPostgres()), "pg-senha.tmp");
  writeFileSync(pwfile, senha, { mode: 0o600 });
  try {
    await rodar("initdb", [
      "-D",
      pastaDadosPostgres(),
      "-U",
      PG_USUARIO,
      "-A",
      "scram-sha-256",
      `--pwfile=${pwfile}`,
      "-E",
      "UTF8",
      "--locale=C",
    ]);
  } finally {
    rmSync(pwfile, { force: true });
  }
}

function portaDisponivel(porta: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.listen(porta, "127.0.0.1", () => s.close(() => resolve(true)));
  });
}

async function portaLivre(): Promise<number> {
  for (let p = PORTA_PREFERIDA; p < PORTA_PREFERIDA + 20; p++) {
    if (await portaDisponivel(p)) return p;
  }
  throw new Error("Nenhuma porta livre para o banco local.");
}

async function rodando(): Promise<boolean> {
  try {
    await rodar("pg_ctl", ["status", "-D", pastaDadosPostgres()], 15_000);
    return true;
  } catch {
    return false;
  }
}

let portaAtual: number | null = null;

/** Sobe o Postgres e devolve a porta. Um servidor órfão (app fechado à força) é parado antes. */
/**
 * Sobe o Postgres e devolve a porta. Um servidor órfão (app fechado à força) é
 * parado antes. Se a partida falhar — tipicamente porque a instância anterior
 * do Oracle ainda está DESLIGANDO o banco (fechar e reabrir em seguida) —,
 * espera e tenta de novo, até 5 vezes.
 */
export async function iniciar(): Promise<number> {
  let ultimoErro: unknown = null;
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    try {
      if (await rodando()) await parar();
      const porta = await portaLivre();
      await pgCtlStart([
        "start",
        "-D",
        pastaDadosPostgres(),
        "-w",
        "-t",
        "60",
        "-l",
        arquivoLog("postgres.log"),
        "-o",
        `-p ${porta} -c listen_addresses=127.0.0.1`,
      ]);
      portaAtual = porta;
      return porta;
    } catch (err) {
      ultimoErro = err;
      registrarPgCtl(`tentativa ${tentativa} falhou: ${err instanceof Error ? err.message : String(err)}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}

function registrarPgCtl(linha: string): void {
  try {
    appendFileSync(arquivoLog("pg_ctl.log"), `${new Date().toISOString()} ${linha}\n`);
  } catch {
    // log é opcional
  }
}

/**
 * `pg_ctl start` esperando o processo SAIR (e não os pipes fecharem): o
 * postgres herda os handles e os manteria abertos. A saída do PRÓPRIO pg_ctl
 * (o motivo de uma falha) vai para logs/pg_ctl.log; a do servidor, para
 * postgres.log (-l).
 */
function pgCtlStart(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let fd: number | null = null;
    try {
      fd = openSync(arquivoLog("pg_ctl.log"), "a");
    } catch {
      fd = null;
    }
    const saida = fd ?? "ignore";
    const p = spawn(exe("pg_ctl"), args, { stdio: ["ignore", saida, saida], windowsHide: true });
    const fechar = () => {
      if (fd !== null) {
        try {
          closeSync(fd);
        } catch {
          // já fechado
        }
        fd = null;
      }
    };
    const t = setTimeout(() => p.kill(), 90_000);
    p.once("error", (err) => {
      clearTimeout(t);
      fechar();
      reject(err);
    });
    p.once("exit", (code) => {
      clearTimeout(t);
      fechar();
      if (code === 0) resolve();
      else reject(new Error(`pg_ctl start falhou (código ${code}). Veja pg_ctl.log e postgres.log.`));
    });
  });
}

export async function parar(): Promise<void> {
  if (!inicializado()) return;
  try {
    await rodar("pg_ctl", ["stop", "-D", pastaDadosPostgres(), "-m", "fast", "-w", "-t", "30"], 45_000);
  } catch {
    // já parado
  }
  portaAtual = null;
}

function url(usuario: string, senha: string, banco: string, porta = portaAtual): string {
  if (!porta) throw new Error("Banco local não iniciado.");
  return `postgresql://${usuario}:${encodeURIComponent(senha)}@127.0.0.1:${porta}/${banco}`;
}

/** URL da APLICAÇÃO (papel sem superusuário). */
export function urlBanco(senhaApp: string): string {
  return url(PG_USUARIO_APP, senhaApp, PG_BANCO);
}

/**
 * Opções da sessão do superusuário: `search_path` fixo em `pg_catalog` (e
 * `pg_temp` por último). O schema `public` pertence a `oracle_app`; sem isso,
 * uma função plantada lá (ex.: `public.format`) poderia ser resolvida e
 * executada com privilégio de superusuário — padrão CVE-2018-1058 (GD-17).
 */
export const OPCOES_SESSAO_SUPER = "-c search_path=pg_catalog,pg_temp";

async function comSuper<T>(senhaSuper: string, banco: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({
    connectionString: url(PG_USUARIO, senhaSuper, banco),
    options: OPCOES_SESSAO_SUPER,
  });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Literal SQL seguro para a senha (gerada por nós, mas escapada mesmo assim). */
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * Garante o papel da aplicação e o banco do Oracle (dono = papel da app). Num
 * banco criado por versão anterior (dono = superusuário), transfere a posse do
 * esquema `public`, das tabelas e dos tipos. Idempotente.
 */
export async function garantirBanco(senhaSuper: string, senhaApp: string): Promise<void> {
  await comSuper(senhaSuper, "postgres", async (c) => {
    const papel = await c.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [PG_USUARIO_APP]);
    const ddl = papel.rowCount === 0 ? "CREATE ROLE" : "ALTER ROLE";
    await c.query(
      `${ddl} ${PG_USUARIO_APP} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${literal(senhaApp)}`,
    );
    const banco = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [PG_BANCO]);
    if (banco.rowCount === 0) await c.query(`CREATE DATABASE ${PG_BANCO} OWNER ${PG_USUARIO_APP}`);
    else await c.query(`ALTER DATABASE ${PG_BANCO} OWNER TO ${PG_USUARIO_APP}`);
  });
  await comSuper(senhaSuper, PG_BANCO, async (c) => {
    await c.query(`ALTER SCHEMA public OWNER TO ${PG_USUARIO_APP}`);
    await c.query(`DO $$ DECLARE r record; BEGIN
      FOR r IN SELECT pg_catalog.format('ALTER TABLE public.%I OWNER TO ${PG_USUARIO_APP}', tablename) AS q
               FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tableowner <> '${PG_USUARIO_APP}' LOOP
        EXECUTE r.q;
      END LOOP;
      FOR r IN SELECT pg_catalog.format('ALTER TYPE public.%I OWNER TO ${PG_USUARIO_APP}', t.typname) AS q
               FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
               WHERE n.nspname = 'public' AND t.typtype = 'e'
                 AND pg_catalog.pg_get_userbyid(t.typowner) <> '${PG_USUARIO_APP}' LOOP
        EXECUTE r.q;
      END LOOP;
    END $$`);
  });
}

/** Apaga e recria o banco do Oracle (usado só pela importação, após confirmação). */
export async function recriarBanco(senhaSuper: string): Promise<void> {
  await comSuper(senhaSuper, "postgres", async (c) => {
    await c.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [PG_BANCO],
    );
    await c.query(`DROP DATABASE IF EXISTS ${PG_BANCO}`);
    await c.query(`CREATE DATABASE ${PG_BANCO} OWNER ${PG_USUARIO_APP}`);
  });
  await comSuper(senhaSuper, PG_BANCO, (c) => c.query(`ALTER SCHEMA public OWNER TO ${PG_USUARIO_APP}`));
}
