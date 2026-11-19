import { net, protocol } from "electron";
import { stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ESQUEMA, HOST, pastaRenderer } from "./config";

/**
 * Serve o build de produção da interface em `oracle-app://app/...`.
 *
 * Esquema "standard + secure": o History API do `createBrowserRouter`,
 * localStorage, IndexedDB, File System Access e `fetch` funcionam como numa
 * origem https — e nenhuma porta HTTP é aberta na máquina.
 */

/** Precisa rodar antes de `app.whenReady()`. */
export function registrarEsquemaPrivilegiado(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ESQUEMA,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        codeCache: true,
      },
    },
    // Prévias (previa.ts): só "secure", para poderem ser iframe de uma página
    // segura. Sem standard/fetch/storage: a origem é opaca.
    { scheme: "oracle-previa", privileges: { secure: true } },
  ]);
}

/**
 * CSP da interface empacotada. Libera só o que o Oracle usa de fora:
 * Google Fonts, os CDNs do ffmpeg.wasm (unpkg) e da voz neural (jsdelivr), a
 * API local e as APIs https chamadas pelo navegador. `wasm-unsafe-eval` é o
 * mínimo para WebAssembly (Vosk, onnxruntime, ffmpeg, sql.js).
 */
export const CSP = [
  "default-src 'self'",
  // Só os pacotes e versões que o app usa (GD-04): ffmpeg.wasm (services/
  // ffmpegCortes.ts), onnxruntime e piper (utils/vozNeural.ts). Ao trocar a
  // versão lá, troque aqui.
  "script-src 'self' 'wasm-unsafe-eval' blob: " +
    "https://unpkg.com/@ffmpeg/core@0.12.10/ " +
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/ " +
    "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: http://localhost:* http://127.0.0.1:*",
  "media-src 'self' data: blob: https: http://localhost:* http://127.0.0.1:*",
  "connect-src 'self' data: blob: https: wss: http://localhost:* http://127.0.0.1:*",
  // Só embeds https (YouTube/Vimeo) e a prévia isolada do Dashboard
  // (oracle-previa:, previa.ts). Sem iframe da própria origem, blob: ou data:.
  "frame-src https: oracle-previa:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".md": "text/markdown; charset=utf-8",
  ".gz": "application/gzip",
};

async function existeArquivo(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

/** Resolve o caminho pedido dentro da raiz; null se tentar sair dela. */
export function resolverDentro(raiz: string, pathname: string): string | null {
  let rel: string;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const alvo = path.resolve(raiz, "." + path.posix.normalize("/" + rel));
  if (alvo !== raiz && !alvo.startsWith(raiz + path.sep)) return null;
  return alvo;
}

export function servirRenderer(): void {
  const raiz = path.resolve(pastaRenderer());
  const indice = path.join(raiz, "index.html");

  protocol.handle(ESQUEMA, async (req) => {
    const url = new URL(req.url);
    if (url.host !== HOST) return new Response("Not found", { status: 404 });

    let arquivo = resolverDentro(raiz, url.pathname);
    if (!arquivo) return new Response("Forbidden", { status: 403 });

    if (!(await existeArquivo(arquivo))) {
      // Rota da SPA (sem extensão) → index.html. Asset ausente → 404, para
      // não devolver HTML no lugar de um .js e mascarar o erro.
      if (path.extname(url.pathname)) {
        return new Response("Not found", { status: 404 });
      }
      arquivo = indice;
    }

    const resp = await net.fetch(pathToFileURL(arquivo).toString(), {
      headers: req.headers,
    });
    const headers = new Headers(resp.headers);
    const tipo = TIPOS[path.extname(arquivo).toLowerCase()];
    if (tipo) headers.set("Content-Type", tipo);
    headers.set("Content-Security-Policy", CSP);
    headers.set("X-Content-Type-Options", "nosniff");
    if (arquivo === indice) headers.set("Cache-Control", "no-cache");
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  });
}
