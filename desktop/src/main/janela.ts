import { app, BrowserWindow } from "electron";
import path from "node:path";
import { caminhoPreload, ORIGEM_JANELA, pastaRecursos, URL_INICIAL } from "./config";
import type { EstadoBackend } from "./servicos/backend";
import { urlSplash } from "./splash";

let principal: BrowserWindow | null = null;
/** A interface do Oracle já foi carregada (e não a tela de abertura). */
let interfaceCarregada = false;
/** Rota pedida (deep link) antes de a interface carregar. */
let rotaPendente: string | null = null;
/** O app está saindo de verdade (Sair, desligamento): fechar não esconde. */
let saindo = false;
/** Decide se fechar a janela a esconde na bandeja (definido em app.ts). */
let esconderAoFechar: () => boolean = () => false;
/** Avisado na primeira vez que a janela vai para a bandeja. */
let aoIrParaBandeja: () => void = () => undefined;

export function marcarSaida(): void {
  saindo = true;
}

export function configurarFechamento(opcoes: {
  esconderAoFechar: () => boolean;
  aoIrParaBandeja: () => void;
}): void {
  esconderAoFechar = opcoes.esconderAoFechar;
  aoIrParaBandeja = opcoes.aoIrParaBandeja;
}

export function janelaPrincipal(): BrowserWindow | null {
  return principal && !principal.isDestroyed() ? principal : null;
}

export function criarJanelaPrincipal(opcoes: { oculta?: boolean } = {}): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: "Oracle",
    icon: path.join(pastaRecursos(), "icon.png"),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: caminhoPreload(),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
      // Com a janela oculta na bandeja, os timers continuam no ritmo normal:
      // a caixa do Telegram segue drenando para Notas/Repositório.
      backgroundThrottling: false,
      additionalArguments: [`--oracle-versao=${app.getVersion()}`],
    },
  });

  if (!opcoes.oculta) win.once("ready-to-show", () => win.show());

  // Fechar esconde na bandeja (preferência); "Sair" no menu da bandeja encerra.
  let avisou = false;
  win.on("close", (e) => {
    if (saindo || !esconderAoFechar()) return;
    e.preventDefault();
    win.hide();
    if (!avisou) {
      avisou = true;
      aoIrParaBandeja();
    }
  });
  win.on("closed", () => {
    if (principal === win) {
      principal = null;
      interfaceCarregada = false;
    }
  });

  principal = win;
  void win.loadURL(urlSplash({ etapa: "Iniciando…", erro: null, pastaLogs: "" }));
  return win;
}

/** Atualiza a tela de abertura com a etapa atual (ou o erro). */
export function mostrarEstadoNaAbertura(e: EstadoBackend): void {
  const win = janelaPrincipal();
  if (!win || interfaceCarregada) return;
  if (e.erro) {
    void win.loadURL(urlSplash(e));
    return;
  }
  void win.webContents
    .executeJavaScript(
      `(() => { const el = document.getElementById("etapa"); if (el) el.textContent = ${JSON.stringify(e.etapa || "Iniciando…")}; })()`,
    )
    .catch(() => undefined);
}

/** Troca a tela de abertura pela interface do Oracle. */
export function carregarInterface(): void {
  const win = janelaPrincipal();
  if (!win) return;
  interfaceCarregada = true;
  const rota = rotaPendente;
  rotaPendente = null;
  void win.loadURL(rota ? `${ORIGEM_JANELA}${rota}` : URL_INICIAL);
}

/** Navega para uma rota da interface (ou guarda para quando ela carregar). */
export function abrirRota(rota: string): void {
  const win = janelaPrincipal();
  if (!win || !interfaceCarregada) {
    rotaPendente = rota;
    return;
  }
  void win.loadURL(`${ORIGEM_JANELA}${rota}`);
}

/** Mostra a janela se estiver oculta ou ao fundo; esconde se já está à frente. */
export function alternarJanelaPrincipal(): void {
  const win = janelaPrincipal();
  if (!win) return;
  if (win.isVisible() && win.isFocused() && !win.isMinimized()) win.hide();
  else focarJanelaPrincipal();
}

export function focarJanelaPrincipal(): void {
  const win = janelaPrincipal();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
