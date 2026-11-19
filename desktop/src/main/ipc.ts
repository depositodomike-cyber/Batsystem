import { app, ipcMain, shell, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";
import { ORIGEM_JANELA } from "./config";
import { janelaPrincipal } from "./janela";
import { urlExternaAceita } from "./navegacao";
import { origemDe } from "./origem";
import { atualizarBandeja } from "./bandeja";
import { aguardarRetornoOauth } from "./deepLink";
import { listarPastasAutorizadas, revogarPasta } from "./permissoes";
import { abrirPrevia, registrarPreviaEmbutida, validarPrevia } from "./previa";
import { preferencias, salvarPreferencias, validar } from "./preferencias";
import { aplicarAtalho, aplicarInicioComWindows, notificar } from "./recursosDesktop";
import { estadoAgente, iniciarAgente } from "./servicos/agente";
import { estadoBackend } from "./servicos/backend";
import { importarAmbienteDev } from "./servicos/importacao";
import { obterToken, salvarToken } from "./sessao";

/**
 * Canais IPC da ponte `oracleDesktop`. Cada canal:
 * - só responde ao frame principal da janela principal, na origem do app
 *   (janelas de prévia, iframes, documentos blob e outras origens são recusados;
 *   o app não abre janelas filhas na origem dele — ver navegacao.ts e previa.ts);
 * - valida o formato dos argumentos.
 */

export const CANAIS = {
  sessaoObter: "oracle:sessao:obter",
  sessaoSalvar: "oracle:sessao:salvar",
  abrirExterno: "oracle:abrir-externo",
  backendEstado: "oracle:backend:estado",
  backendImportarDev: "oracle:backend:importar-dev",
  preferenciasObter: "oracle:preferencias:obter",
  preferenciasSalvar: "oracle:preferencias:salvar",
  agenteEstado: "oracle:agente:estado",
  agenteIniciar: "oracle:agente:iniciar",
  notificar: "oracle:notificar",
  previaAbrir: "oracle:previa:abrir",
  previaRegistrar: "oracle:previa:registrar",
  pastasListar: "oracle:pastas:listar",
  pastasRevogar: "oracle:pastas:revogar",
} as const;

export function remetenteConfiavel(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const win = janelaPrincipal();
  if (!win || e.sender !== win.webContents) return false;
  const frame = e.senderFrame;
  if (!frame || frame !== e.sender.mainFrame) return false;
  return origemDe(frame.url) === ORIGEM_JANELA;
}

/** Canal síncrono (o interceptor do axios lê o token de forma síncrona). */
function onSync(canal: string, fn: (e: IpcMainEvent, ...args: unknown[]) => unknown): void {
  ipcMain.on(canal, (e, ...args) => {
    if (!remetenteConfiavel(e)) {
      e.returnValue = null;
      return;
    }
    try {
      e.returnValue = fn(e, ...args) ?? null;
    } catch (err) {
      console.error(`[ipc] ${canal}:`, err);
      e.returnValue = null;
    }
  });
}

/** Canal assíncrono (invoke). */
function onInvoke(
  canal: string,
  fn: (e: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
): void {
  ipcMain.handle(canal, async (e, ...args) => {
    if (!remetenteConfiavel(e)) return null;
    return (await fn(e, ...args)) ?? null;
  });
}

/** Só https: consentimento OAuth e links externos. */
export function urlExternaPermitida(url: unknown): url is string {
  return typeof url === "string" && url.length <= 8_192 && urlExternaAceita(url);
}

export function registrarIpc(): void {
  onInvoke(CANAIS.abrirExterno, async (_e, url) => {
    if (!urlExternaPermitida(url)) return false;
    // A volta do consentimento OAuth (oracle-desktop://) só vale agora (GD-11).
    aguardarRetornoOauth();
    await shell.openExternal(url);
    return true;
  });

  onInvoke(CANAIS.backendEstado, () => estadoBackend());

  let importando = false;
  onInvoke(CANAIS.backendImportarDev, async () => {
    if (importando) return { ok: false, mensagem: "Já há uma importação em andamento." };
    importando = true;
    try {
      return await importarAmbienteDev(janelaPrincipal());
    } finally {
      importando = false;
    }
  });

  onInvoke(CANAIS.preferenciasObter, () => ({ ...preferencias(), instalado: app.isPackaged }));

  onInvoke(CANAIS.preferenciasSalvar, (_e, parcial) => {
    const anterior = preferencias().atalhoGlobal;
    const p = salvarPreferencias(validar(parcial));
    aplicarInicioComWindows(p);
    let atalhoOk = true;
    if (p.atalhoGlobal !== anterior) {
      atalhoOk = aplicarAtalho(p);
      // Atalho inválido ou já usado por outro programa: volta ao anterior.
      if (!atalhoOk) aplicarAtalho(salvarPreferencias({ atalhoGlobal: anterior }));
    }
    void atualizarBandeja();
    return { ...preferencias(), instalado: app.isPackaged, atalhoOk };
  });

  onInvoke(CANAIS.agenteEstado, () => estadoAgente());
  onInvoke(CANAIS.agenteIniciar, async () => {
    const r = await iniciarAgente();
    void atualizarBandeja();
    return r;
  });

  onInvoke(CANAIS.notificar, (_e, titulo, corpo) => {
    if (typeof titulo !== "string" || typeof corpo !== "string") return false;
    return notificar(titulo, corpo);
  });

  onInvoke(CANAIS.previaAbrir, (_e, dados, mime, opcoes) => {
    const v = validarPrevia(dados, mime);
    if (!v.ok) return false;
    const o = (typeof opcoes === "object" && opcoes !== null ? opcoes : {}) as Record<string, unknown>;
    abrirPrevia(v.buffer, v.mime, {
      titulo: typeof o.titulo === "string" ? o.titulo : undefined,
      imprimir: o.imprimir === true,
    });
    return true;
  });

  onInvoke(CANAIS.previaRegistrar, (_e, dados, mime) => {
    const v = validarPrevia(dados, mime);
    return v.ok ? registrarPreviaEmbutida(v.buffer, v.mime) : null;
  });

  onInvoke(CANAIS.pastasListar, () => listarPastasAutorizadas());
  onInvoke(CANAIS.pastasRevogar, (_e, caminho) =>
    typeof caminho === "string" ? revogarPasta(caminho) : false,
  );

  onSync(CANAIS.sessaoObter, () => obterToken());

  onSync(CANAIS.sessaoSalvar, (_e, token) => {
    if (token !== null && (typeof token !== "string" || token.length > 16_384)) {
      return false;
    }
    salvarToken(token);
    return true;
  });
}
