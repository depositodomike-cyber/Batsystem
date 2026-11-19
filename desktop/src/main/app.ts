import { app, Menu } from "electron";
import { iniciarAtualizacoes } from "./atualizacao";
import { criarBandeja, destruirBandeja, temBandeja } from "./bandeja";
import {
  ABERTO_NO_LOGIN,
  argumentosDoApp,
  flagRecusada,
  separarPerfilDeDesenvolvimento,
  URL_DEV,
} from "./config";
import { deepLinkNoArgv, registrarProtocolo, tratarDeepLink } from "./deepLink";
import { registrarIpc } from "./ipc";
import {
  carregarInterface,
  configurarFechamento,
  criarJanelaPrincipal,
  focarJanelaPrincipal,
  marcarSaida,
  mostrarEstadoNaAbertura,
} from "./janela";
import { aplicarPoliticaDeNavegacao } from "./navegacao";
import { configurarPermissoes } from "./permissoes";
import { preferencias } from "./preferencias";
import { servirPreviasNaSessaoPrincipal } from "./previa";
import { registrarEsquemaPrivilegiado, servirRenderer } from "./protocolo";
import { aplicarAtalho, aplicarInicioComWindows, liberarAtalhos, notificar } from "./recursosDesktop";
import { iniciarAgenteNaAbertura } from "./servicos/agente";
import {
  aoMudarBackend,
  estadoBackend,
  iniciarBackend,
  pararBackend,
} from "./servicos/backend";

/** Ponto de entrada do processo principal do Oracle Desktop. */

// App instalado: recusa flags do Chromium que desligam proteções ou desviam
// o tráfego. Depuração remota daria a outro processo o controle da janela, da
// sessão e da ponte; proxy + ignorar certificados permitiriam trocar o que o
// app baixa (GD-26). Complementa os fuses, que já desligam --inspect do Node.
// Confere os argumentos RECEBIDOS (até o `--`), não o `app.commandLine`: o
// próprio Electron acrescenta switches internos (ex.: enable-features).
if (app.isPackaged && flagRecusada(argumentosDoApp(process.argv))) {
  app.exit(1);
}

app.setAppUserModelId("com.oracle.desktop");
separarPerfilDeDesenvolvimento();
registrarEsquemaPrivilegiado();

if (!app.requestSingleInstanceLock()) {
  // Já há um Oracle aberto: ele recebe `second-instance` e vem para a frente.
  app.quit();
} else if (argumentosDoApp(process.argv).includes("--sair")) {
  // `--sair` sem Oracle aberto: nada a encerrar (o instalador chama assim).
  app.exit(0);
} else {
  app.on("second-instance", (_e, argv) => {
    // `Oracle.exe --sair`: encerra pelo caminho normal (para a API e o banco).
    // Usado pelo instalador antes de trocar os arquivos.
    if (argumentosDoApp(argv).includes("--sair")) {
      app.quit();
      return;
    }
    const link = deepLinkNoArgv(argv);
    if (link) tratarDeepLink(link);
    else focarJanelaPrincipal();
  });

  aplicarPoliticaDeNavegacao();

  void app.whenReady().then(async () => {
    if (app.isPackaged) Menu.setApplicationMenu(null);
    if (!URL_DEV) servirRenderer();
    servirPreviasNaSessaoPrincipal();
    configurarPermissoes();
    registrarIpc();
    registrarProtocolo();

    const prefs = preferencias();
    aplicarInicioComWindows(prefs);
    criarBandeja();
    configurarFechamento({
      esconderAoFechar: () => temBandeja() && preferencias().fecharParaBandeja,
      aoIrParaBandeja: () =>
        notificar("O Oracle continua aberto", "Ele está na bandeja do Windows. Para sair, use “Sair do Oracle” no ícone."),
    });
    aplicarAtalho(prefs);

    // Aberto pelo Windows no login com "iniciar na bandeja": a janela nasce oculta.
    const win = criarJanelaPrincipal({ oculta: ABERTO_NO_LOGIN && prefs.iniciarNaBandeja });
    // Logoff/desligamento do Windows: não esconder na bandeja e parar o banco limpo.
    win.on("session-end", () => {
      marcarSaida();
      void pararBackend();
    });
    // Aberto pelo próprio deep link (o app estava fechado): vale ao carregar.
    tratarDeepLink(deepLinkNoArgv(process.argv));

    aoMudarBackend(mostrarEstadoNaAbertura);
    await iniciarBackend();
    iniciarAtualizacoes();
    if (estadoBackend().fase === "pronto") {
      carregarInterface();
      if (prefs.iniciarAgente) void iniciarAgenteNaAbertura();
    }
  });

  // Ao sair, a API e o banco embutidos param antes de o processo terminar.
  let encerrando = false;
  app.on("before-quit", (e) => {
    marcarSaida();
    if (encerrando) return;
    e.preventDefault();
    encerrando = true;
    liberarAtalhos();
    destruirBandeja();
    void pararBackend()
      .catch((err) => console.error("[backend] ao parar:", err))
      .finally(() => app.quit());
  });

  app.on("window-all-closed", () => app.quit());
}
