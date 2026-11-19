import { contextBridge, ipcRenderer } from "electron";

/**
 * Ponte controlada entre a interface e o processo principal.
 *
 * Roda com `sandbox: true`: só pode importar `electron` (nada de módulos
 * locais) e expõe apenas funções específicas — nunca `ipcRenderer`, `fs` ou
 * Node. Cada canal é validado no main (desktop/src/main/ipc.ts); os nomes
 * abaixo precisam bater com `CANAIS` de lá.
 */

function valorArg(nome: string): string {
  const prefixo = `--${nome}=`;
  const a = process.argv.find((x) => x.startsWith(prefixo));
  return a ? a.slice(prefixo.length) : "";
}

const oracleDesktop = Object.freeze({
  ehDesktop: true as const,
  plataforma: process.platform,
  versao: valorArg("oracle-versao"),

  /** Abre uma URL https no navegador padrão do sistema (ex.: consentimento OAuth). */
  abrirExterno(url: string): Promise<boolean> {
    return ipcRenderer
      .invoke("oracle:abrir-externo", String(url))
      .then((ok: unknown) => ok === true);
  },

  /** Servidor do Oracle (API + banco) gerenciado pelo app. */
  backend: Object.freeze({
    estado(): Promise<unknown> {
      return ipcRenderer.invoke("oracle:backend:estado");
    },
    importarAmbienteDev(): Promise<unknown> {
      return ipcRenderer.invoke("oracle:backend:importar-dev");
    },
  }),

  /** Preferências do app desktop (bandeja, iniciar com o Windows, atalho...). */
  preferencias: Object.freeze({
    obter(): Promise<unknown> {
      return ipcRenderer.invoke("oracle:preferencias:obter");
    },
    salvar(parcial: unknown): Promise<unknown> {
      return ipcRenderer.invoke("oracle:preferencias:salvar", parcial);
    },
  }),

  /** Oracle Local Agent: só estado e "iniciar" (o resto é na bandeja dele). */
  agente: Object.freeze({
    estado(): Promise<unknown> {
      return ipcRenderer.invoke("oracle:agente:estado");
    },
    iniciar(): Promise<unknown> {
      return ipcRenderer.invoke("oracle:agente:iniciar");
    },
  }),

  /**
   * Abre conteúdo (HTML gerado, PDF, imagem, vídeo) numa janela de prévia
   * isolada, de origem opaca — nunca na origem do app.
   */
  abrirPrevia(
    dados: ArrayBuffer | string,
    mime: string,
    opcoes?: { titulo?: string; imprimir?: boolean },
  ): Promise<boolean> {
    return ipcRenderer
      .invoke("oracle:previa:abrir", dados, String(mime), {
        titulo: typeof opcoes?.titulo === "string" ? opcoes.titulo : undefined,
        imprimir: opcoes?.imprimir === true,
      })
      .then((ok: unknown) => ok === true);
  },

  /** Guarda conteúdo para um iframe de prévia isolada; devolve a URL (ou null). */
  registrarPrevia(dados: ArrayBuffer | string, mime: string): Promise<string | null> {
    return ipcRenderer
      .invoke("oracle:previa:registrar", dados, String(mime))
      .then((u: unknown) => (typeof u === "string" && u.startsWith("oracle-previa://") ? u : null));
  },

  /** Pastas do Repositório autorizadas neste computador (listar/revogar). */
  pastas: Object.freeze({
    listar(): Promise<unknown> {
      return ipcRenderer.invoke("oracle:pastas:listar");
    },
    revogar(caminho: string): Promise<boolean> {
      return ipcRenderer.invoke("oracle:pastas:revogar", String(caminho)).then((ok: unknown) => ok === true);
    },
  }),

  /** Notificação nativa do Windows. */
  notificar(titulo: string, corpo: string): Promise<boolean> {
    return ipcRenderer
      .invoke("oracle:notificar", String(titulo), String(corpo))
      .then((ok: unknown) => ok === true);
  },

  /** Token da sessão, cifrado pelo sistema operacional no processo principal. */
  sessao: Object.freeze({
    obter(): string | null {
      const t: unknown = ipcRenderer.sendSync("oracle:sessao:obter");
      return typeof t === "string" ? t : null;
    },
    salvar(token: string | null): void {
      ipcRenderer.sendSync(
        "oracle:sessao:salvar",
        typeof token === "string" ? token : null,
      );
    },
  }),
});

contextBridge.exposeInMainWorld("oracleDesktop", oracleDesktop);
