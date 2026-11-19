import { BrowserWindow, session } from "electron";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pastaRecursos } from "./config";

/**
 * Janela de prévia isolada (GD-01, GD-03).
 *
 * Conteúdo gerado por IA ou anexado (painéis, carrosséis, apresentações em
 * HTML, PDFs, imagens) NUNCA abre na origem do app (`oracle-app://app`), onde
 * enxergaria o localStorage, o IndexedDB, as pastas do Repositório e a ponte.
 * Abre aqui:
 * - sessão própria e em memória (`partition: "previa"`): nenhum dado do app;
 * - esquema `oracle-previa:` sem privilégios, com CSP `sandbox` (origem opaca)
 *   e `connect-src 'none'` (o documento não faz requisições);
 * - sem preload, sem permissões, sem popups, sem navegação.
 */

const PARTICAO = "previa";
const ESQUEMA = "oracle-previa";
const LIMITE_BYTES = 50 * 1024 * 1024;

export const MIMES_PERMITIDOS = /^(text\/html|text\/plain|application\/pdf|image\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+)$/i;

const CSP_PREVIA = [
  "sandbox allow-scripts allow-modals allow-downloads",
  "default-src 'none'",
  "script-src 'unsafe-inline' https:",
  "style-src 'unsafe-inline' https:",
  "img-src data: blob: https:",
  "media-src data: blob: https:",
  "font-src data: https:",
  "connect-src 'none'",
  "frame-src 'none'",
  "form-action 'none'",
].join("; ");

const conteudos = new Map<string, { dados: Buffer; mime: string }>();
/** Prévias embutidas (iframe do Dashboard): as 30 mais recentes. */
const embutidas: string[] = [];
let configurada = false;

export const ESQUEMA_PREVIA = ESQUEMA;

function servir(req: Request): Response {
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const c = conteudos.get(id);
  if (!c) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(c.dados), {
    headers: {
      "Content-Type": c.mime.startsWith("text/") ? `${c.mime}; charset=utf-8` : c.mime,
      "Content-Security-Policy": CSP_PREVIA,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

function sessaoPrevia(): Electron.Session {
  const s = session.fromPartition(PARTICAO);
  if (configurada) return s;
  configurada = true;
  s.setPermissionRequestHandler((_wc, _p, responder) => responder(false));
  s.setPermissionCheckHandler(() => false);
  s.protocol.handle(ESQUEMA, servir);
  return s;
}

/**
 * Também na sessão principal, só para iframes de prévia DENTRO da interface
 * (Dashboard): o documento vem com a CSP própria (`sandbox`, origem opaca) e
 * não herda a CSP do app — um `srcdoc` herdaria e os scripts do painel não
 * rodariam. Opaco, não vê storage, ponte nem permissões do app.
 */
export function servirPreviasNaSessaoPrincipal(): void {
  session.defaultSession.protocol.handle(ESQUEMA, servir);
}

/** Guarda o conteúdo para um iframe de prévia e devolve a URL dele. */
export function registrarPreviaEmbutida(buffer: Buffer, mime: string): string {
  const id = randomUUID();
  conteudos.set(id, { dados: buffer, mime });
  embutidas.push(id);
  while (embutidas.length > 30) conteudos.delete(embutidas.shift()!);
  return `${ESQUEMA}://p/${id}`;
}

export function validarPrevia(
  dados: unknown,
  mime: unknown,
): { ok: true; buffer: Buffer; mime: string } | { ok: false } {
  if (typeof mime !== "string" || !MIMES_PERMITIDOS.test(mime)) return { ok: false };
  let buffer: Buffer;
  if (typeof dados === "string") buffer = Buffer.from(dados, "utf8");
  else if (dados instanceof ArrayBuffer) buffer = Buffer.from(dados);
  else if (ArrayBuffer.isView(dados)) buffer = Buffer.from(dados.buffer, dados.byteOffset, dados.byteLength);
  else return { ok: false };
  if (buffer.length === 0 || buffer.length > LIMITE_BYTES) return { ok: false };
  return { ok: true, buffer, mime: mime.toLowerCase() };
}

export function abrirPrevia(
  buffer: Buffer,
  mime: string,
  opcoes: { titulo?: string; imprimir?: boolean } = {},
): void {
  const id = randomUUID();
  conteudos.set(id, { dados: buffer, mime });
  const url = `${ESQUEMA}://p/${id}`;

  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    title: (opcoes.titulo ?? "Prévia — Oracle").slice(0, 120),
    icon: path.join(pastaRecursos(), "icon.png"),
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    webPreferences: {
      session: sessaoPrevia(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e, destino) => {
    if (destino !== url) e.preventDefault();
  });
  win.webContents.on("will-redirect", (e) => e.preventDefault());
  if (opcoes.imprimir) {
    win.webContents.once("did-finish-load", () => win.webContents.print({}));
  }
  win.on("closed", () => conteudos.delete(id));
  void win.loadURL(url);
}
