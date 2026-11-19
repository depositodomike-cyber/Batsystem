// Controles de segurança do processo principal (GD-14). Roda sem Electron:
// `npm test` (o módulo electron é substituído por test/electron-falso.cjs).
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { argumentosDoApp, flagRecusada, ORIGEM_APP } from "../src/main/config";
import { consumirRetornoEsperado, aguardarRetornoOauth, deepLinkNoArgv, rotaDoDeepLink } from "../src/main/deepLink";
import { remetenteConfiavel, urlExternaPermitida } from "../src/main/ipc";
import { criarJanelaPrincipal, janelaPrincipal } from "../src/main/janela";
import { origemDe } from "../src/main/origem";
import { decidirCheck, decidirPedido, pastaSensivel } from "../src/main/permissoes";
import { atalhoAceitavel, validar } from "../src/main/preferencias";
import { validarPrevia } from "../src/main/previa";
import { resolverDentro } from "../src/main/protocolo";
import { containerDoCompose, lerDotenv, validarDump } from "../src/main/servicos/importacao";
import { filtrarVariaveis } from "../src/main/servicos/segredos";
import { OPCOES_SESSAO_SUPER } from "../src/main/servicos/postgres";
import { lerMigracoes, planejar } from "../src/main/servicos/migracoes";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { CHAVE_PUBLICA_ATUALIZACAO } from "../src/main/chaveAtualizacao";
import { atualizacaoAutentica, mensagemAssinada } from "../src/main/verificacaoAtualizacao";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WebContentsFalso } = require("electron") as { WebContentsFalso: new () => Electron.WebContents };

const janela = criarJanelaPrincipal();
const principal = janela.webContents;
void janela.loadURL(`${ORIGEM_APP}/oracle/notas`);

function evento(wc: unknown, frame: unknown) {
  return { sender: wc, senderFrame: frame } as Electron.IpcMainEvent;
}

describe("origemDe", () => {
  it("entende o esquema próprio (o URL.origin do Node dá 'null')", () => {
    assert.equal(origemDe("oracle-app://app/oracle/x?y=1"), ORIGEM_APP);
    assert.equal(origemDe("http://localhost:5173/a"), "http://localhost:5173");
  });
  it("blob e lixo não têm origem do app", () => {
    assert.equal(origemDe("blob:oracle-app://app/uuid"), null);
    assert.equal(origemDe("isso não é url"), null);
  });
});

describe("remetenteConfiavel (ponte IPC)", () => {
  it("aceita só o frame principal da janela principal, na origem do app", () => {
    assert.equal(janelaPrincipal()?.webContents, principal);
    assert.equal(remetenteConfiavel(evento(principal, principal.mainFrame)), true);
  });
  it("recusa outra janela (prévia, filha)", () => {
    const outra = new WebContentsFalso() as unknown as Electron.WebContents & { mainFrame: { url: string } };
    outra.mainFrame.url = `${ORIGEM_APP}/x`;
    assert.equal(remetenteConfiavel(evento(outra, outra.mainFrame)), false);
  });
  it("recusa iframe da janela principal", () => {
    assert.equal(remetenteConfiavel(evento(principal, { url: `${ORIGEM_APP}/x` })), false);
  });
  it("recusa splash data:, documento blob e outra origem no frame principal", () => {
    for (const url of ["data:text/html,oi", "blob:oracle-app://app/1", "https://exemplo.com/"]) {
      void janela.loadURL(url);
      assert.equal(remetenteConfiavel(evento(principal, principal.mainFrame)), false, url);
    }
    void janela.loadURL(`${ORIGEM_APP}/oracle/notas`);
  });
});

describe("permissões (GD-01, GD-06, GD-09)", () => {
  const app = `${ORIGEM_APP}/oracle/notas`;
  it("janela principal na origem do app: microfone sim, câmera não", () => {
    assert.equal(decidirPedido(principal, "media", { requestingUrl: app, isMainFrame: true, mediaTypes: ["audio"] }), true);
    assert.equal(decidirPedido(principal, "media", { requestingUrl: app, isMainFrame: true, mediaTypes: ["video"] }), false);
  });
  it("blob filho recebe NÃO em fileSystem, clipboard e media", () => {
    const filha = new WebContentsFalso() as unknown as Electron.WebContents;
    const blob = "blob:oracle-app://app/abc";
    for (const p of ["fileSystem", "clipboard-read", "clipboard-sanitized-write", "media"]) {
      assert.equal(decidirCheck(filha, p, ORIGEM_APP, { requestingUrl: blob, filePath: os.tmpdir(), mediaType: "audio" }), false, p);
      assert.equal(decidirPedido(filha, p, { requestingUrl: blob, filePath: os.tmpdir(), mediaTypes: ["audio"] }), false, p);
    }
  });
  it("documento blob na própria janela principal também recebe NÃO", () => {
    assert.equal(decidirCheck(principal, "media", ORIGEM_APP, { requestingUrl: "blob:oracle-app://app/x", mediaType: "audio" }), false);
  });
  it("iframe (isMainFrame false) recebe NÃO", () => {
    assert.equal(decidirPedido(principal, "media", { requestingUrl: app, isMainFrame: false, mediaTypes: ["audio"] }), false);
  });
  it("clipboard-read nunca é concedido", () => {
    assert.equal(decidirPedido(principal, "clipboard-read", { requestingUrl: app, isMainFrame: true }), false);
  });
  it("pasta escolhida vira autorizada com leitura e gravação (é a do Repositório)", () => {
    const pasta = path.join(os.homedir(), "Documents", "oracle-repo-teste");
    assert.equal(decidirCheck(principal, "fileSystem", ORIGEM_APP, { requestingUrl: app, filePath: pasta }), false);
    assert.equal(decidirPedido(principal, "fileSystem", { requestingUrl: app, filePath: pasta, isDirectory: true, fileAccessType: "readable" }), true);
    assert.equal(decidirCheck(principal, "fileSystem", ORIGEM_APP, { requestingUrl: app, filePath: path.join(pasta, "nota.md") }), true);
    assert.equal(
      decidirCheck(principal, "fileSystem", ORIGEM_APP, { requestingUrl: app, filePath: path.join(pasta, "Telegram", "x.md"), fileAccessType: "writable" }),
      true,
    );
    const fora = path.join(os.homedir(), "Documents", "outra-pasta");
    assert.equal(decidirCheck(principal, "fileSystem", ORIGEM_APP, { requestingUrl: app, filePath: fora }), false);
  });
  it("checagem de arquivo sem webContents (como o Electron faz) vale só na origem do app (GD-29)", () => {
    const pasta = path.join(os.homedir(), "Documents", "oracle-repo-teste");
    const nota = path.join(pasta, "sub", "nota.md");
    assert.equal(decidirCheck(null, "fileSystem", ORIGEM_APP, { filePath: nota }), true, "leitura da pasta escolhida");
    assert.equal(decidirCheck(null, "fileSystem", ORIGEM_APP, { filePath: nota, fileAccessType: "writable" }), true);
    assert.equal(decidirCheck(null, "fileSystem", "oracle-previa://p", { filePath: nota }), false, "prévia");
    assert.equal(decidirCheck(null, "fileSystem", "https://exemplo.com", { filePath: nota }), false, "outra origem");
    assert.equal(decidirCheck(null, "fileSystem", ORIGEM_APP, { filePath: nota, requestingUrl: "blob:oracle-app://app/x" }), false, "documento blob");
    const filha = new WebContentsFalso() as unknown as Electron.WebContents;
    assert.equal(decidirCheck(filha, "fileSystem", ORIGEM_APP, { filePath: nota }), false, "outra janela");
    assert.equal(decidirCheck(null, "media", ORIGEM_APP, { mediaType: "audio" }), false, "só fileSystem aceita null");
  });
  it("pastas sensíveis nunca são autorizadas", () => {
    const casa = os.homedir();
    for (const p of ["C:\\", casa, path.join(casa, "AppData", "Roaming"), path.join(casa, ".ssh"), "C:\\Windows\\System32", "C:\\Program Files\\X"]) {
      assert.equal(pastaSensivel(p), true, p);
      assert.equal(decidirPedido(principal, "fileSystem", { requestingUrl: app, filePath: p, isDirectory: true }), false, p);
    }
    assert.equal(pastaSensivel(path.join(casa, "Documents", "Repositorio")), false);
  });
});

describe("protocolo oracle-app (resolverDentro)", () => {
  const raiz = path.resolve(os.tmpdir(), "renderer-teste");
  it("resolve caminhos dentro da raiz", () => {
    assert.equal(resolverDentro(raiz, "/assets/a.js"), path.join(raiz, "assets", "a.js"));
  });
  it("barra fuga da raiz", () => {
    for (const p of ["/../segredo", "/%2e%2e/segredo", "/..%5csegredo", "/%2e%2e%5c%2e%2e%5cwindows", "/%E0%A4%A"]) {
      const r = resolverDentro(raiz, p);
      assert.ok(r === null || r.startsWith(raiz + path.sep) || r === raiz, `${p} → ${r}`);
    }
  });
});

describe("deep link oracle-desktop:// (GD-11)", () => {
  it("só conectores com os 4 parâmetros", () => {
    assert.equal(
      rotaDoDeepLink("oracle-desktop://conectores?conector=gmail&status=ok&extra=1&conta=a%40b.c"),
      "/oracle/conectores?conector=gmail&status=ok&conta=a%40b.c",
    );
    assert.equal(rotaDoDeepLink("oracle-desktop://outra?conector=a&status=ok"), null);
    assert.equal(rotaDoDeepLink("oracle-desktop://conectores?status=ok"), null);
    assert.equal(rotaDoDeepLink("https://conectores?conector=a&status=ok"), null);
  });
  it("o link só é lido depois do --", () => {
    assert.equal(deepLinkNoArgv(["exe", "oracle-desktop://conectores?x"]), null);
    assert.equal(deepLinkNoArgv(["exe", "--", "oracle-desktop://conectores?x"]), "oracle-desktop://conectores?x");
  });
  it("retorno só vale logo após abrir um consentimento, e uma vez", () => {
    assert.equal(consumirRetornoEsperado(), false);
    aguardarRetornoOauth(1000);
    assert.equal(consumirRetornoEsperado(2000), true);
    assert.equal(consumirRetornoEsperado(2000), false);
    aguardarRetornoOauth(0);
    assert.equal(consumirRetornoEsperado(16 * 60_000), false);
  });
});

describe("flags recusadas no app instalado (GD-26)", () => {
  it("recusa depuração, proxy, certificados e sandbox, com ou sem valor", () => {
    for (const a of ["--remote-debugging-port=9222", "--proxy-server=x:1", "--IGNORE-CERTIFICATE-ERRORS", "--no-sandbox", "--js-flags=--expose-gc"]) {
      assert.equal(flagRecusada(["Oracle.exe", a]), true, a);
    }
  });
  it("aceita os argumentos do próprio app e ignora o que vem depois do --", () => {
    assert.equal(flagRecusada(["Oracle.exe", "--oracle-bandeja", "--sair"]), false);
    assert.equal(flagRecusada(argumentosDoApp(["Oracle.exe", "--", "--no-sandbox"])), false);
  });
});

describe("argumentos (GD-07)", () => {
  it("nada depois do -- vira opção", () => {
    assert.deepEqual(argumentosDoApp(["exe", "--oracle-bandeja", "--", "--oracle-dev"]), ["exe", "--oracle-bandeja"]);
  });
});

describe("URL externa, prévia e preferências", () => {
  it("abrirExterno: só https", () => {
    assert.equal(urlExternaPermitida("https://accounts.google.com/o"), true);
    for (const u of ["http://x.com", "file:///C:/x", "javascript:alert(1)", "oracle-app://app/", 42, "https://" + "a".repeat(9000)]) {
      assert.equal(urlExternaPermitida(u), false, String(u).slice(0, 30));
    }
  });
  it("prévia: MIME na allowlist e tamanho limitado", () => {
    assert.equal(validarPrevia("<p>oi</p>", "text/html").ok, true);
    assert.equal(validarPrevia(new ArrayBuffer(4), "application/pdf").ok, true);
    assert.equal(validarPrevia("x", "application/x-msdownload").ok, false);
    assert.equal(validarPrevia("", "text/html").ok, false);
    assert.equal(validarPrevia({}, "text/html").ok, false);
  });
  it("preferências: só campos conhecidos com o tipo certo", () => {
    assert.deepEqual(validar({ fecharParaBandeja: "sim", notificacoes: false, outro: 1 }), { notificacoes: false });
  });
  it("atalho global exige modificador (GD-16)", () => {
    assert.equal(atalhoAceitavel("CommandOrControl+Alt+O"), true);
    assert.equal(atalhoAceitavel(""), true);
    for (const a of ["A", "F5", "Alt+", "+O"]) assert.equal(atalhoAceitavel(a), false, a);
  });
});

describe("assinatura das atualizações (GD-21)", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publica = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const arquivo = path.join(os.tmpdir(), `oracle-setup-teste-${process.pid}.exe`);
  writeFileSync(arquivo, "instalador de teste");
  const sha = createHash("sha512").update("instalador de teste").digest("base64");
  const manifesto = (extra: Record<string, string> = {}) => {
    const base = { versao: "1.2.3", arquivo: "Oracle-Setup-1.2.3.exe", sha512: sha, ...extra };
    return { ...base, assinatura: sign(null, mensagemAssinada(base), privateKey).toString("base64") };
  };
  it("aceita manifesto assinado com o arquivo certo", async () => {
    assert.equal(await atualizacaoAutentica(manifesto(), "1.2.3", arquivo, publica), true);
  });
  it("recusa versão diferente, arquivo trocado, assinatura de outra chave ou adulterada", async () => {
    assert.equal(await atualizacaoAutentica(manifesto(), "1.2.4", arquivo, publica), false);
    assert.equal(await atualizacaoAutentica(manifesto({ sha512: "outro" }), "1.2.3", arquivo, publica), false);
    const outra = generateKeyPairSync("ed25519").publicKey.export({ format: "der", type: "spki" }).toString("base64");
    assert.equal(await atualizacaoAutentica(manifesto(), "1.2.3", arquivo, outra), false);
    const m = manifesto();
    assert.equal(await atualizacaoAutentica({ ...m, arquivo: "x.exe" }, "1.2.3", arquivo, publica), false);
    assert.equal(await atualizacaoAutentica(null, "1.2.3", arquivo, publica), false);
    assert.equal(await atualizacaoAutentica(manifesto(), "1.2.3", arquivo, ""), false);
  });
  it("a chave pública do app está configurada", () => {
    assert.match(CHAVE_PUBLICA_ATUALIZACAO, /^[A-Za-z0-9+/=]{40,}$/);
  });
});

describe("migrations sem o CLI do Prisma (GD-16)", () => {
  const m = (nome: string, checksum = "c-" + nome) => ({ nome, sql: "", checksum });
  const linha = (nome: string, extra: Partial<{ checksum: string; finished_at: Date | null; rolled_back_at: Date | null }> = {}) => ({
    migration_name: nome,
    checksum: "c-" + nome,
    finished_at: new Date(),
    rolled_back_at: null,
    ...extra,
  });
  it("aplica só as pendentes, em ordem", () => {
    const r = planejar([m("001_a"), m("002_b"), m("003_c")], [linha("001_a")]);
    assert.deepEqual(r.pendentes.map((x) => x.nome), ["002_b", "003_c"]);
    assert.deepEqual(r.avisos, []);
  });
  it("revertida volta a ser pendente; checksum diferente só avisa", () => {
    const r = planejar([m("001_a"), m("002_b")], [linha("001_a", { checksum: "outro" }), linha("002_b", { rolled_back_at: new Date() })]);
    assert.deepEqual(r.pendentes.map((x) => x.nome), ["002_b"]);
    assert.equal(r.avisos.length, 1);
  });
  it("migration falhada e não resolvida bloqueia (como o P3009)", () => {
    assert.throws(() => planejar([m("001_a")], [linha("001_a", { finished_at: null })]), /falhou/);
  });
  it("lê as migrations reais do build, em ordem e com checksum SHA-256", () => {
    const pasta = path.resolve(__dirname, "../../build/api/prisma/migrations");
    if (!existsSync(pasta)) return; // build/api ausente: só no CI sem preparar-api
    const lidas = lerMigracoes(pasta);
    assert.ok(lidas.length > 0);
    assert.deepEqual(lidas.map((x) => x.nome), [...lidas.map((x) => x.nome)].sort());
    assert.ok(lidas.every((x) => /^[0-9a-f]{64}$/.test(x.checksum)));
  });
});

describe("importação do ambiente de desenvolvimento", () => {
  it("lerDotenv: aspas, comentários, BOM e export", () => {
    const env = lerDotenv('\uFEFF# c\nA=1\nexport B="dois # não é comentário"\nC=tres # comentário\nD=\'q\'\n');
    assert.deepEqual(env, { A: "1", B: "dois # não é comentário", C: "tres", D: "q" });
  });
  it("allowlist de variáveis (GD-08)", () => {
    assert.deepEqual(
      filtrarVariaveis({ JWT_SECRET: "j", GOOGLE_CLIENT_ID: "g", NODE_OPTIONS: "--require x", ELECTRON_RUN_AS_NODE: "1", DATABASE_URL: "d", PORT: "1" }),
      { JWT_SECRET: "j", GOOGLE_CLIENT_ID: "g" },
    );
  });
  it("dump: SET fora da lista exata e dessincronia de strings são recusados (GD-17)", () => {
    const base = "SET statement_timeout = 0;\nSET standard_conforming_strings = on;\n";
    assert.equal(validarDump(base + "SET client_encoding = 'UTF8';"), null);
    for (const ruim of [
      "SET standard_conforming_strings = off;",
      "SET search_path = public;",
      "SET role = postgres;",
      "SET standard_conforming_strings = off;\nINSERT INTO public.a VALUES ('\\'' ; CREATE FUNCTION public.format(text, name) RETURNS text LANGUAGE sql AS 'x' ; '');",
    ]) {
      assert.notEqual(validarDump(base + ruim), null, ruim);
    }
  });
  it("dump: ; e ' dentro de identificador entre aspas não confundem o validador", () => {
    assert.equal(validarDump('CREATE TABLE public."tab;el\'a" (id text);\nINSERT INTO public."tab;el\'a" VALUES (\'1\');'), null);
    assert.notEqual(validarDump('CREATE TABLE public."x" (id text); "y"; DO 1;'), null);
  });
  it("dump: client_encoding só UTF8, conferido no valor cru (GD-27)", () => {
    assert.equal(validarDump("SET client_encoding = 'UTF8';"), null);
    assert.notEqual(validarDump("SET client_encoding = 'SJIS';"), null);
    assert.notEqual(validarDump("SET client_encoding TO 'BIG5';"), null);
  });
  it("sessão do superusuário com search_path fixo (GD-17)", () => {
    assert.equal(OPCOES_SESSAO_SUPER, "-c search_path=pg_catalog,pg_temp");
  });
  it("container vem do docker-compose do projeto", () => {
    assert.equal(containerDoCompose("services:\n  db:\n    container_name: batsystem-db\n"), "batsystem-db");
    assert.equal(containerDoCompose("services: {}"), null);
  });
  it("dump: aceita o que o pg_dump gera, recusa o perigoso (GD-05)", () => {
    const ok = [
      "SET statement_timeout = 0;",
      "SELECT pg_catalog.set_config('search_path', '', false);",
      'CREATE TYPE public."Papel" AS ENUM (\'a\');',
      'CREATE TABLE public.notas (id text, corpo text);',
      "INSERT INTO public.notas VALUES ('1', 'COPY x FROM PROGRAM ''calc''; DROP TABLE y;'), ('2', E'linha\\nCREATE EXTENSION x;');",
      'ALTER TABLE ONLY public.notas ADD CONSTRAINT notas_pkey PRIMARY KEY (id);',
      'CREATE UNIQUE INDEX notas_id_key ON public.notas USING btree (id);',
      // Nome longo entre aspas (o validador já truncou isso e recusou o dump real).
      'CREATE UNIQUE INDEX "ai_media_connections_empresaId_kind_credencial_muito_longo_key" ON public.notas USING btree (id);',
      "SELECT pg_catalog.setval('public.seq', 42, true);",
    ].join("\n");
    assert.equal(validarDump(ok), null);
    for (const ruim of [
      "COPY public.notas FROM PROGRAM 'calc';",
      "CREATE EXTENSION plpython3u;",
      "ALTER SYSTEM SET archive_command = 'x';",
      "DO $$ BEGIN END $$;",
      "CREATE FUNCTION public.f() RETURNS int LANGUAGE sql AS 'select 1';",
      "INSERT INTO public.a VALUES ('x'); SELECT pg_read_file('C:/x');",
    ]) {
      assert.notEqual(validarDump(ok + "\n" + ruim), null, ruim);
    }
  });
});
