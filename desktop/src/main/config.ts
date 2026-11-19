import { app } from "electron";
import path from "node:path";

/**
 * Constantes e modos de execução do Oracle Desktop.
 *
 * - Produção (instalado ou `npm start`): a interface vem do build de
 *   `ts/demo/dist`, servido pelo esquema próprio `oracle-app://app`.
 * - Desenvolvimento (`npm run dev`, flag `--oracle-dev`): a janela carrega o
 *   Vite em `http://localhost:5173` (ou `--oracle-dev-url=<url>`), com HMR.
 */

/** Esquema próprio da interface. A API aceita esta origem no CORS. */
export const ESQUEMA = "oracle-app";
export const HOST = "app";
export const ORIGEM_APP = `${ESQUEMA}://${HOST}`;

/**
 * Argumentos do app, até o `--`: o que vem depois é dado (ex.: a URL de um
 * deep link registrado com `… -- "%1"`) e nunca vira opção (GD-07).
 */
export function argumentosDoApp(argv: readonly string[]): string[] {
  const fim = argv.indexOf("--");
  return fim >= 0 ? argv.slice(0, fim) : [...argv];
}

const ARGS = argumentosDoApp(process.argv);

function valorArg(nome: string): string | null {
  const prefixo = `--${nome}=`;
  const a = ARGS.find((x) => x.startsWith(prefixo));
  return a ? a.slice(prefixo.length) : null;
}

/**
 * URL do Vite no modo desenvolvimento, ou null em produção. No app instalado
 * as flags de desenvolvimento são ignoradas (GD-07): nenhuma origem externa
 * recebe a ponte, a sessão ou as permissões.
 */
export const URL_DEV: string | null =
  !app.isPackaged && ARGS.includes("--oracle-dev")
    ? (valorArg("oracle-dev-url") ?? "http://localhost:5173")
    : null;

/** Origem que a janela principal carrega (usada pela política de navegação). */
export const ORIGEM_JANELA = URL_DEV ? new URL(URL_DEV).origin : ORIGEM_APP;

export const URL_INICIAL = URL_DEV ?? `${ORIGEM_APP}/`;

/** Pasta com o build de produção da interface. */
export function pastaRenderer(): string {
  const env = process.env.ORACLE_RENDERER_DIR;
  if (env && !app.isPackaged) return path.resolve(env);
  // No app instalado a interface fica DENTRO do app.asar (coberto pela
  // validação de integridade do asar — fuse, GD-16).
  return app.isPackaged
    ? path.join(app.getAppPath(), "renderer")
    : path.resolve(__dirname, "../../../ts/demo/dist");
}

/** Ícones do app (desktop/recursos, gerados por scripts/gerar-icones.cjs). */
export function pastaRecursos(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "recursos")
    : path.resolve(__dirname, "../../recursos");
}

/** Aberto pelo Windows no login (iniciar com o Windows). */
export const ABERTO_NO_LOGIN = ARGS.includes("--oracle-bandeja");

export function caminhoPreload(): string {
  return path.join(__dirname, "../preload/index.js");
}

/**
 * Fora do app instalado, os dados do Electron vão para `Oracle (dev)`, para que
 * rodar o projeto nunca toque no perfil do Oracle instalado.
 */
export function separarPerfilDeDesenvolvimento(): void {
  if (app.isPackaged) return;
  app.setPath("userData", path.join(app.getPath("appData"), "Oracle (dev)"));
}

// App instalado: flags do Chromium recusadas (ver app.ts, GD-26).
export const FLAGS_RECUSADAS = [
  "remote-debugging-port",
  "remote-debugging-pipe",
  "remote-debugging-address",
  "no-sandbox",
  "disable-web-security",
  "ignore-certificate-errors",
  "ignore-certificate-errors-spki-list",
  "allow-insecure-localhost",
  "proxy-server",
  "proxy-pac-url",
  "host-resolver-rules",
  "host-rules",
  "js-flags",
  "disable-features",
  "enable-features",
  "load-extension",
  "user-data-dir",
  "allow-file-access-from-files",
];

/** Algum argumento recebido é uma flag recusada (`--x` ou `--x=valor`, qualquer caixa)? */
export function flagRecusada(args: readonly string[]): boolean {
  return args.some((a) => {
    const m = /^--?([^=]+)/.exec(a);
    return !!m && FLAGS_RECUSADAS.includes(m[1].toLowerCase());
  });
}
