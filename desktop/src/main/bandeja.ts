import { app, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import { pastaRecursos } from "./config";
import { alternarJanelaPrincipal, focarJanelaPrincipal } from "./janela";
import { preferencias, salvarPreferencias } from "./preferencias";
import { verificarAgora } from "./atualizacao";
import { aplicarInicioComWindows, notificar } from "./recursosDesktop";
import { estadoAgente, iniciarAgente, type EstadoAgente } from "./servicos/agente";
import { aoMudarBackend, estadoBackend } from "./servicos/backend";

/** Ícone e menu do Oracle na bandeja do Windows. */

let tray: Tray | null = null;
let agente: EstadoAgente | null = null;

export function temBandeja(): boolean {
  return tray !== null && !tray.isDestroyed();
}

function textoServidor(): string {
  const e = estadoBackend();
  if (e.fase === "erro") return "Servidor: com erro (veja Configurações)";
  if (e.fase !== "pronto") return `Servidor: ${e.etapa || "iniciando…"}`;
  return e.modo === "embutido" ? "Servidor: em funcionamento" : "Servidor: API de desenvolvimento";
}

function textoAgente(): string {
  if (!agente) return "Agente local: verificando…";
  if (!agente.instalado) return "Agente local: não instalado";
  if (!agente.pareado) return "Agente local: não pareado";
  if (!agente.rodando) return "Agente local: parado";
  return agente.paradoLocal ? "Agente local: pausado" : "Agente local: rodando";
}

function montarMenu(): void {
  if (!temBandeja()) return;
  const p = preferencias();
  tray!.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir o Oracle", click: () => focarJanelaPrincipal() },
      { type: "separator" },
      { label: textoServidor(), enabled: false },
      { label: textoAgente(), enabled: false },
      {
        label: "Iniciar o agente local",
        visible: Boolean(agente?.pareado && agente.instalado && !agente.rodando),
        click: () => void iniciarAgente().then(atualizarBandeja),
      },
      { type: "separator" },
      {
        label: "Iniciar com o Windows",
        type: "checkbox",
        checked: p.iniciarComWindows,
        enabled: app.isPackaged,
        click: (item) => {
          aplicarInicioComWindows(salvarPreferencias({ iniciarComWindows: item.checked }));
        },
      },
      {
        label: "Fechar para a bandeja",
        type: "checkbox",
        checked: p.fecharParaBandeja,
        click: (item) => void salvarPreferencias({ fecharParaBandeja: item.checked }),
      },
      {
        label: `Verificar atualizações (versão ${app.getVersion()})`,
        enabled: app.isPackaged,
        click: () => void verificarAgora().then((m) => notificar("Oracle", m)),
      },
      { type: "separator" },
      { label: "Sair do Oracle", click: () => app.quit() },
    ]),
  );
  tray!.setToolTip(`Oracle — ${textoServidor().replace("Servidor: ", "")}`);
}

export async function atualizarBandeja(): Promise<void> {
  try {
    agente = await estadoAgente();
  } catch {
    agente = null;
  }
  montarMenu();
}

export function criarBandeja(): void {
  if (temBandeja()) return;
  const icone = nativeImage.createFromPath(path.join(pastaRecursos(), "bandeja.png"));
  icone.addRepresentation({
    scaleFactor: 2,
    buffer: nativeImage.createFromPath(path.join(pastaRecursos(), "bandeja@2x.png")).toPNG(),
  });
  tray = new Tray(icone);
  tray.on("click", () => alternarJanelaPrincipal());
  aoMudarBackend(() => montarMenu());
  void atualizarBandeja();
  // O agente pode ser aberto/fechado pela bandeja dele: revisa a cada 30 s.
  setInterval(() => void atualizarBandeja(), 30_000).unref();
}

export function destruirBandeja(): void {
  tray?.destroy();
  tray = null;
}
