import { app, globalShortcut, Notification, nativeImage } from "electron";
import path from "node:path";
import { pastaRecursos } from "./config";
import { alternarJanelaPrincipal, focarJanelaPrincipal } from "./janela";
import { preferencias, type PreferenciasDesktop } from "./preferencias";

/**
 * Recursos do sistema operacional ligados às preferências: iniciar com o
 * Windows, atalho global e notificações nativas.
 */

export function iconeApp(): Electron.NativeImage {
  return nativeImage.createFromPath(path.join(pastaRecursos(), "icon.png"));
}

/** Iniciar com o Windows (HKCU\...\Run, gerenciado pelo Electron). Só no app instalado. */
export function aplicarInicioComWindows(p: PreferenciasDesktop): void {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({
    openAtLogin: p.iniciarComWindows,
    args: p.iniciarNaBandeja ? ["--oracle-bandeja"] : [],
  });
}

let atalhoAtual: string | null = null;

/** Registra o atalho global; devolve false se for inválido ou já usado por outro programa. */
export function aplicarAtalho(p: PreferenciasDesktop): boolean {
  if (atalhoAtual) {
    globalShortcut.unregister(atalhoAtual);
    atalhoAtual = null;
  }
  if (!p.atalhoGlobal) return true;
  try {
    const ok = globalShortcut.register(p.atalhoGlobal, () => alternarJanelaPrincipal());
    if (ok) atalhoAtual = p.atalhoGlobal;
    return ok;
  } catch {
    return false;
  }
}

export function liberarAtalhos(): void {
  globalShortcut.unregisterAll();
  atalhoAtual = null;
}

/** Notificação nativa; clicar traz o Oracle para a frente. */
export function notificar(titulo: string, corpo: string): boolean {
  if (!preferencias().notificacoes || !Notification.isSupported()) return false;
  const n = new Notification({
    title: titulo.slice(0, 120),
    body: corpo.slice(0, 400),
    icon: iconeApp(),
    silent: false,
  });
  n.on("click", () => focarJanelaPrincipal());
  n.show();
  return true;
}
