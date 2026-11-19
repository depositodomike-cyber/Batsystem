import { app, dialog, net } from "electron";
import { autoUpdater, type UpdateDownloadedEvent } from "electron-updater";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { janelaPrincipal } from "./janela";
import { notificar } from "./recursosDesktop";
import { arquivoLog } from "./servicos/caminhos";
import { atualizacaoAutentica } from "./verificacaoAtualizacao";

/**
 * Atualização automática pelo GitHub Releases (electron-updater).
 *
 * - Só no app instalado. Verifica ao abrir e a cada 6 horas e baixa em
 *   segundo plano.
 * - NADA é instalado sem a assinatura própria (GD-21): o manifesto
 *   `oracle-atualizacao-<versão>.json` da release precisa ser válido para a
 *   chave pública embutida no app e o sha512 tem de bater com o arquivo
 *   baixado. Só então o app pergunta se pode reiniciar (e, se o usuário
 *   escolher "Depois", instala ao sair).
 * - O instalador novo substitui só os arquivos do programa: dados, banco,
 *   sessão e preferências ficam em %APPDATA%\Oracle e não são tocados.
 */

const INTERVALO_MS = 6 * 60 * 60 * 1000;

function registrar(nivel: string, msg: unknown): void {
  try {
    appendFileSync(arquivoLog("atualizacao.log"), `${new Date().toISOString()} ${nivel} ${String(msg)}\n`);
  } catch {
    // log é opcional
  }
}

/** owner/repo do app-update.yml gerado pelo electron-builder. */
function repositorio(): { owner: string; repo: string } | null {
  try {
    const yml = readFileSync(path.join(process.resourcesPath, "app-update.yml"), "utf8");
    const owner = /^owner:\s*(\S+)\s*$/m.exec(yml)?.[1];
    const repo = /^repo:\s*(\S+)\s*$/m.exec(yml)?.[1];
    return owner && repo ? { owner, repo } : null;
  } catch {
    return null;
  }
}

async function baixarManifesto(versao: string): Promise<unknown> {
  const r = repositorio();
  if (!r) throw new Error("app-update.yml sem owner/repo");
  const url = `https://github.com/${r.owner}/${r.repo}/releases/download/v${versao}/oracle-atualizacao-${versao}.json`;
  const resp = await net.fetch(url, { redirect: "follow" });
  if (!resp.ok) throw new Error(`manifesto indisponível (${resp.status})`);
  return resp.json();
}

let iniciado = false;
let perguntando = false;

async function aoBaixar(info: UpdateDownloadedEvent): Promise<void> {
  if (perguntando) return;
  let autentica = false;
  try {
    autentica = await atualizacaoAutentica(await baixarManifesto(info.version), info.version, info.downloadedFile);
  } catch (e) {
    registrar("erro", e);
  }
  if (!autentica) {
    registrar("erro", `atualização ${info.version} RECUSADA: assinatura ausente ou inválida`);
    notificar(
      "Atualização do Oracle recusada",
      `A versão ${info.version} não tem uma assinatura válida e não será instalada.`,
    );
    return;
  }
  registrar("info", `atualização ${info.version} verificada`);
  // Só uma atualização verificada pode ser instalada ao sair.
  autoUpdater.autoInstallOnAppQuit = true;
  perguntando = true;
  notificar("Atualização do Oracle pronta", `A versão ${info.version} será instalada ao reiniciar.`);
  const opcoes: Electron.MessageBoxOptions = {
    type: "info",
    buttons: ["Reiniciar agora", "Depois"],
    defaultId: 0,
    cancelId: 1,
    title: "Atualização do Oracle",
    message: `A versão ${info.version} do Oracle está pronta.`,
    detail:
      "Reinicie para instalar. Seus dados e configurações são mantidos. Se escolher depois, ela será instalada quando você sair do Oracle.",
  };
  const win = janelaPrincipal();
  const r = await (win ? dialog.showMessageBox(win, opcoes) : dialog.showMessageBox(opcoes));
  perguntando = false;
  if (r.response === 0) autoUpdater.quitAndInstall(false, true);
}

export function iniciarAtualizacoes(): void {
  if (!app.isPackaged || iniciado) return;
  iniciado = true;
  autoUpdater.autoDownload = true;
  // Nunca instala sozinho algo que ainda não foi verificado (GD-21).
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = {
    info: (m: unknown) => registrar("info", m),
    warn: (m: unknown) => registrar("aviso", m),
    error: (m: unknown) => registrar("erro", m),
    debug: () => undefined,
  };
  autoUpdater.on("update-downloaded", (info) => void aoBaixar(info));

  const verificar = () => void autoUpdater.checkForUpdates().catch((e) => registrar("erro", e));
  verificar();
  setInterval(verificar, INTERVALO_MS).unref();
}

/** "Verificar atualizações" (menu da bandeja). */
export async function verificarAgora(): Promise<string> {
  if (!app.isPackaged) return "Atualizações só no Oracle instalado.";
  try {
    const r = await autoUpdater.checkForUpdates();
    const nova = r?.updateInfo?.version;
    return nova && nova !== app.getVersion()
      ? `Baixando a versão ${nova}…`
      : `Você já está na versão mais recente (${app.getVersion()}).`;
  } catch (e) {
    registrar("erro", e);
    return "Não foi possível verificar agora. Tente mais tarde.";
  }
}
