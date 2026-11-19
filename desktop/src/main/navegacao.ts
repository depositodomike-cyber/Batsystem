import { app, shell, type WebContents } from "electron";
import { ORIGEM_JANELA } from "./config";
import { janelaPrincipal } from "./janela";
import { origemDe } from "./origem";

/**
 * Política de navegação de TODO webContents do app.
 *
 * - A janela principal só navega dentro da origem do app (nem `blob:`).
 * - Nenhum webContents abre janela filha: `window.open` é sempre negado. As
 *   prévias (HTML gerado por IA, anexos) e a impressão abrem pela ponte, numa
 *   janela isolada de origem opaca (previa.ts) — nunca na origem do app.
 * - Só a janela principal leva links para fora, e só `https:`, para o navegador
 *   do sistema (inclui o consentimento OAuth dos conectores). Janelas de
 *   prévia e outros webContents são negados em silêncio (GD-10).
 * - `<webview>` nunca é permitido.
 */

export function urlExternaAceita(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function ehJanelaPrincipal(contents: WebContents): boolean {
  return contents === janelaPrincipal()?.webContents;
}

function abrirFora(contents: WebContents, url: string): void {
  if (ehJanelaPrincipal(contents) && urlExternaAceita(url)) void shell.openExternal(url);
}

function endurecer(contents: WebContents): void {
  contents.on("will-attach-webview", (e) => e.preventDefault());

  contents.on("will-navigate", (e, url) => {
    if (ehJanelaPrincipal(contents) && origemDe(url) === ORIGEM_JANELA) return;
    e.preventDefault();
    abrirFora(contents, url);
  });

  contents.setWindowOpenHandler(({ url }) => {
    abrirFora(contents, url);
    return { action: "deny" };
  });
}

export function aplicarPoliticaDeNavegacao(): void {
  app.on("web-contents-created", (_e, contents) => endurecer(contents));
}
