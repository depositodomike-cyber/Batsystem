import { dialog, type BrowserWindow } from "electron";
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import * as api from "./api";
import { apagarChavesEmArquivo, estadoBackend, iniciarBackend, pararBackend } from "./backend";
import { pastaDadosApi } from "./caminhos";
import * as postgres from "./postgres";
import { filtrarVariaveis, lerConfig, novaChaveDesktop, salvarConfig } from "./segredos";

/**
 * Importa o ambiente de desenvolvimento para o Oracle Desktop (uma vez):
 *
 * 1. lê o `.env` da API (ts/api/.env) escolhido pelo usuário — credenciais
 *    OAuth, token do Telegram, chaves e, sobretudo, JWT_SECRET e
 *    ENCRYPTION_KEY (sem elas as credenciais cifradas no banco se perdem);
 * 2. copia o banco do container Docker com `pg_dump` (só leitura: o banco
 *    original não é alterado);
 * 3. substitui o banco embutido por essa cópia, após confirmação;
 * 4. copia a chave do gateway desktop (`.desktop/servidor.pem`), que o Oracle
 *    Local Agent fixou no pareamento;
 * 5. aplica migrations novas e reinicia a API.
 */

export interface ResultadoImportacao {
  ok: boolean;
  mensagem: string;
}


export function lerDotenv(texto: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const bruta of texto.replace(/^﻿/, "").split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha || linha.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (!m) continue;
    let v = m[2];
    const aspas = v[0];
    if ((aspas === '"' || aspas === "'") && v.lastIndexOf(aspas) > 0) {
      v = v.slice(1, v.lastIndexOf(aspas));
      if (aspas === '"') v = v.replace(/\\n/g, "\n");
    } else {
      v = v.replace(/\s+#.*$/, "").trim();
    }
    out[m[1]] = v;
  }
  return out;
}

function rodar(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()));
      else resolve(stdout.trim());
    });
  });
}

/** `container_name` do docker-compose.yml que fica ao lado do .env da API. */
export function containerDoCompose(texto: string): string | null {
  const m = /^\s*container_name:\s*["']?([A-Za-z0-9][A-Za-z0-9_.-]*)["']?\s*$/m.exec(texto);
  return m ? m[1] : null;
}

/**
 * Container do banco de origem: o declarado no docker-compose.yml do projeto
 * (ts/api), que precisa estar rodando E publicando a porta do .env — não basta
 * "um container qualquer na porta" (GD-05).
 */
async function containerDoBanco(pastaApi: string, porta: string): Promise<string> {
  const compose = path.join(pastaApi, "docker-compose.yml");
  const esperado = existsSync(compose) ? containerDoCompose(readFileSync(compose, "utf8")) : null;
  if (!esperado) {
    throw new Error("Não encontrei o docker-compose.yml do Oracle ao lado do .env escolhido (ts/api).");
  }
  let nomes: string;
  try {
    nomes = await rodar("docker", ["ps", "--filter", `publish=${porta}`, "--format", "{{.Names}}"]);
  } catch {
    throw new Error("Não consegui falar com o Docker. Abra o Docker Desktop e tente de novo.");
  }
  if (!nomes.split(/\r?\n/).includes(esperado)) {
    throw new Error(
      `O container ${esperado} não está rodando na porta ${porta}. Suba o banco (ts/api: npm run db:up) e tente de novo.`,
    );
  }
  return esperado;
}

/**
 * Divide o SQL em comandos, respeitando strings ('…', E'…') e comentários, e
 * devolve o começo de cada um (maiúsculas, espaços normalizados).
 */
export function iniciosDeComandos(sql: string): string[] {
  const inicios: string[] = [];
  let atual = "";
  let i = 0;
  const n = sql.length;
  const fechar = () => {
    const t = atual.trim().replace(/\s+/g, " ").toUpperCase();
    if (t) inicios.push(t.slice(0, 200));
    atual = "";
  };
  while (i < n) {
    const ch = sql[i];
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "'") {
      // E'…' aceita \' como escape; '…' só ''.
      const escapado = /(^|[^A-Za-z0-9_])[eE]$/.test(atual);
      i++;
      while (i < n) {
        if (escapado && sql[i] === "\\") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2;
            continue;
          }
          break;
        }
        i++;
      }
      i++;
      if (atual.length < 240) atual += "''";
      continue;
    }
    if (ch === '"') {
      // Identificador entre aspas: o conteúdo entra como está ("" = aspas),
      // mas um `;` ou `'` dentro dele não abre string nem fecha comando.
      let ident = '"';
      i++;
      while (i < n) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') {
            ident += '""';
            i += 2;
            continue;
          }
          break;
        }
        ident += sql[i];
        i++;
      }
      i++;
      if (atual.length < 240) atual += ident + '"';
      continue;
    }
    // Dollar-quoting só aparece em funções/DO, que um dump do Oracle não tem.
    if (ch === "$") return [...inicios, "DOLLAR-QUOTE"];
    if (ch === ";") {
      fechar();
      i++;
      continue;
    }
    if (atual.length < 240) atual += ch;
    i++;
  }
  fechar();
  return inicios;
}

/** Começos de comando aceitos num dump de estrutura + dados do Oracle. */
const COMANDOS_ACEITOS = [
  // SET: só os que o pg_dump emite, com os valores que ele emite (GD-17).
  // `standard_conforming_strings` só `on`: com `off`, o Postgres trataria \'
  // como escape e o validador deixaria de enxergar onde a string acaba.
  /^SET (STATEMENT_TIMEOUT|LOCK_TIMEOUT|IDLE_IN_TRANSACTION_SESSION_TIMEOUT|TRANSACTION_TIMEOUT) = 0$/,
  /^SET CLIENT_ENCODING = ''$/,
  /^SET STANDARD_CONFORMING_STRINGS = ON$/,
  /^SET CHECK_FUNCTION_BODIES = FALSE$/,
  /^SET XMLOPTION = CONTENT$/,
  /^SET CLIENT_MIN_MESSAGES = WARNING$/,
  /^SET ROW_SECURITY = OFF$/,
  /^SET DEFAULT_TABLESPACE = ''$/,
  /^SET DEFAULT_TABLE_ACCESS_METHOD = HEAP$/,
  // Literais viram '' na normalização (iniciosDeComandos).
  /^SELECT PG_CATALOG\.SET_CONFIG\('', '', FALSE\)$/,
  /^CREATE TABLE PUBLIC\./,
  /^CREATE TYPE PUBLIC\./,
  /^CREATE (UNIQUE )?INDEX [A-Z0-9_"]+ ON PUBLIC\./,
  /^CREATE SEQUENCE PUBLIC\./,
  /^ALTER TABLE (ONLY )?PUBLIC\./,
  /^ALTER SEQUENCE PUBLIC\./,
  /^INSERT INTO PUBLIC\./,
  /^SELECT PG_CATALOG\.SETVAL\('', \d+, (TRUE|FALSE)\)$/,
  /^COMMENT ON /,
];

/**
 * Recusa o dump se houver comando fora do esperado: COPY de/para arquivo ou
 * PROGRAM, CREATE EXTENSION/FUNCTION, ALTER SYSTEM, DO… (GD-05). Devolve o
 * comando recusado, ou null. A restauração ainda roda sem superusuário.
 */
export function validarDump(sql: string): string | null {
  // O literal é normalizado para '' na análise; aqui confere o valor cru: só
  // UTF8 (outro encoding mudaria como o servidor lê a barra invertida dentro de E'…') — GD-27.
  for (const m of sql.matchAll(/SET\s+client_encoding\s*(?:=|TO)\s*'([^']*)'/gi)) {
    if (m[1].toUpperCase() !== "UTF8") return `SET client_encoding = '${m[1]}'`;
  }
  for (const c of iniciosDeComandos(sql)) {
    if (!COMANDOS_ACEITOS.some((r) => r.test(c))) return c.slice(0, 60);
  }
  return null;
}

/** `pg_dump` dentro do container, em SQL puro (sem dono nem privilégios). */
function dumpDoContainer(container: string, usuario: string, banco: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "docker",
      [
        "exec",
        container,
        "pg_dump",
        "-U",
        usuario,
        "-d",
        banco,
        "--no-owner",
        "--no-privileges",
        "--inserts",
        "--rows-per-insert=200",
      ],
      { windowsHide: true },
    );
    const partes: Buffer[] = [];
    let erro = "";
    p.stdout.on("data", (b: Buffer) => partes.push(b));
    p.stderr.on("data", (b: Buffer) => (erro += b.toString()));
    p.once("error", reject);
    p.once("exit", (code) => {
      if (code === 0) resolve(Buffer.concat(partes).toString("utf8"));
      else reject(new Error(`pg_dump falhou: ${erro.trim() || `código ${code}`}`));
    });
  });
}

/** Remove os meta-comandos do psql (`\restrict`, `\connect`...), que não são SQL. */
export function sqlExecutavel(dump: string): string {
  return dump
    .split(/\r?\n/)
    .filter((l) => !l.startsWith("\\"))
    .join("\n");
}

/** Fluxo da interface: escolhe o .env e confirma em diálogos nativos. */
export async function importarAmbienteDev(win: BrowserWindow | null): Promise<ResultadoImportacao> {
  const opcoesArquivo: Electron.OpenDialogOptions = {
    title: "Escolha o arquivo .env da API do Oracle (ts/api/.env)",
    properties: ["openFile", "showHiddenFiles"],
  };
  const escolha = win
    ? await dialog.showOpenDialog(win, opcoesArquivo)
    : await dialog.showOpenDialog(opcoesArquivo);
  if (escolha.canceled || !escolha.filePaths[0]) return { ok: false, mensagem: "Importação cancelada." };

  return executarImportacao(escolha.filePaths[0], async (detalhe) => {
    const opcoes: Electron.MessageBoxOptions = {
      type: "warning",
      buttons: ["Substituir o banco do app", "Cancelar"],
      defaultId: 1,
      cancelId: 1,
      title: "Importar ambiente de desenvolvimento",
      message: "Substituir o banco do Oracle Desktop?",
      detail: detalhe,
    };
    const r = win ? await dialog.showMessageBox(win, opcoes) : await dialog.showMessageBox(opcoes);
    return r.response === 0;
  });
}

/** Núcleo da importação (sem interface): o chamador decide a confirmação. */
export async function executarImportacao(
  arquivoEnv: string,
  confirmar: (detalhe: string) => Promise<boolean>,
): Promise<ResultadoImportacao> {
  const estado = estadoBackend();
  if (estado.modo !== "embutido" || estado.fase !== "pronto") {
    return {
      ok: false,
      mensagem:
        estado.modo === "externo"
          ? "O Oracle está usando uma API externa (ambiente de desenvolvimento aberto); não há banco embutido para substituir."
          : "O servidor do Oracle ainda não está pronto.",
    };
  }
  const cfg = lerConfig();
  if (!cfg) return { ok: false, mensagem: "Configuração do servidor ausente." };

  const envDev = lerDotenv(readFileSync(arquivoEnv, "utf8"));
  for (const k of ["DATABASE_URL", "JWT_SECRET", "ENCRYPTION_KEY"]) {
    if (!envDev[k]) return { ok: false, mensagem: `O arquivo escolhido não tem ${k}. É o .env da API?` };
  }

  let origem: URL;
  try {
    origem = new URL(envDev.DATABASE_URL);
  } catch {
    return { ok: false, mensagem: "DATABASE_URL do .env é inválida." };
  }
  const usuario = decodeURIComponent(origem.username);
  const banco = origem.pathname.replace(/^\//, "");
  const porta = origem.port || "5432";

  let dump: string;
  try {
    const container = await containerDoBanco(path.dirname(arquivoEnv), porta);
    dump = sqlExecutavel(await dumpDoContainer(container, usuario, banco));
    const proibido = validarDump(dump);
    if (proibido) {
      throw new Error(`A cópia do banco tem um comando não permitido e não foi importada: ${proibido}`);
    }
  } catch (err) {
    return { ok: false, mensagem: err instanceof Error ? err.message : String(err) };
  }

  const tamanhoMb = (Buffer.byteLength(dump) / 1024 / 1024).toFixed(1);
  const confirmou = await confirmar(
    `O banco deste app será trocado pela cópia do ambiente de desenvolvimento (${banco}, ${tamanhoMb} MB). ` +
      "O que foi criado só no app até agora é descartado. O banco original no Docker não é alterado.",
  );
  if (!confirmou) return { ok: false, mensagem: "Importação cancelada." };

  // A API para enquanto o banco é trocado; o Postgres continua no ar.
  await api.parar();
  try {
    await postgres.recriarBanco(cfg.pgSenha);
    // Restaura com o papel da aplicação, sem superusuário (GD-05).
    const c = new Client({
      connectionString: postgres.urlBanco(cfg.pgSenhaApp),
      // Mesma leitura de strings que o validador assume (GD-17).
      options: "-c standard_conforming_strings=on",
    });
    await c.connect();
    try {
      await c.query(dump);
    } finally {
      await c.end();
    }
  } catch (err) {
    await pararBackend();
    await iniciarBackend();
    return {
      ok: false,
      mensagem: `Falha ao restaurar a cópia: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Configuração: só as variáveis que a API conhece (allowlist, GD-08).
  const env = filtrarVariaveis(envDev);
  // Chave do gateway desktop fixada pelo agente no pareamento: vai para o
  // backend.bin (DPAPI), nunca para arquivo (GD-12, SR-25).
  const pem = path.join(path.dirname(arquivoEnv), ".desktop", "servidor.pem");
  if (!env.DESKTOP_CHAVE_PRIVADA) {
    env.DESKTOP_CHAVE_PRIVADA = existsSync(pem)
      ? Buffer.from(readFileSync(pem, "utf8"), "utf8").toString("base64")
      : (cfg.env.DESKTOP_CHAVE_PRIVADA ?? novaChaveDesktop());
  }
  salvarConfig({ ...cfg, env, seedFeito: true, importadoEm: new Date().toISOString() });
  apagarChavesEmArquivo(path.join(pastaDadosApi(), ".desktop"));

  // Migrations mais novas que a cópia + API com a configuração importada.
  await pararBackend();
  await iniciarBackend();
  const final = estadoBackend();
  if (final.fase !== "pronto") {
    return { ok: false, mensagem: final.erro ?? "O servidor não voltou depois da importação." };
  }
  return {
    ok: true,
    mensagem: "Ambiente importado. Entre com a mesma conta que você usa no navegador.",
  };
}
