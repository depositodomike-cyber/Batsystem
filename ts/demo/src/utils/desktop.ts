/**
 * Ponte com o Oracle Desktop (Electron).
 *
 * No app desktop o preload expõe `window.oracleDesktop` (desktop/src/preload).
 * No navegador ela não existe e todo o código segue o caminho web de sempre —
 * por isso cada uso passa por `ehDesktop()` / `ponteDesktop()`.
 */

export type SessaoDesktop = {
  /** Token guardado (cifrado pelo sistema operacional), ou null. */
  obter(): string | null;
  /** Grava o token; null apaga. */
  salvar(token: string | null): void;
};

export type EstadoBackendDesktop = {
  /** embutido: API e banco do próprio app; externo: API já aberta (desenvolvimento). */
  modo: "externo" | "embutido" | null;
  fase: "iniciando" | "pronto" | "erro" | "parado";
  etapa: string;
  erro: string | null;
  pastaLogs: string;
  importadoEm: string | null;
};

export type PreferenciasDesktop = {
  fecharParaBandeja: boolean;
  iniciarComWindows: boolean;
  iniciarNaBandeja: boolean;
  atalhoGlobal: string;
  iniciarAgente: boolean;
  notificacoes: boolean;
  /** App instalado (iniciar com o Windows só vale nele). */
  instalado: boolean;
  /** Resposta do salvar: o atalho foi aceito pelo Windows. */
  atalhoOk?: boolean;
};

export type EstadoAgenteDesktop = {
  instalado: boolean;
  caminho: string | null;
  pareado: boolean;
  api: string | null;
  paradoLocal: boolean;
  rodando: boolean;
};

export type OracleDesktop = {
  readonly ehDesktop: true;
  readonly plataforma: string;
  readonly versao: string;
  readonly sessao: SessaoDesktop;
  /** Abre uma URL https no navegador padrão do sistema. */
  abrirExterno(url: string): Promise<boolean>;
  readonly preferencias: {
    obter(): Promise<PreferenciasDesktop | null>;
    salvar(parcial: Partial<PreferenciasDesktop>): Promise<PreferenciasDesktop | null>;
  };
  readonly agente: {
    estado(): Promise<EstadoAgenteDesktop | null>;
    iniciar(): Promise<{ ok: boolean; mensagem: string } | null>;
  };
  /** Abre conteúdo numa janela de prévia isolada (origem opaca). */
  abrirPrevia(
    dados: ArrayBuffer | string,
    mime: string,
    opcoes?: { titulo?: string; imprimir?: boolean },
  ): Promise<boolean>;
  /** Guarda conteúdo para um iframe de prévia isolada; devolve a URL. */
  registrarPrevia(dados: ArrayBuffer | string, mime: string): Promise<string | null>;
  readonly pastas: {
    listar(): Promise<{ caminho: string; modo: "readable" | "writable" }[] | null>;
    revogar(caminho: string): Promise<boolean>;
  };
  /** Notificação nativa do Windows (respeita a preferência). */
  notificar(titulo: string, corpo: string): Promise<boolean>;
  readonly backend: {
    estado(): Promise<EstadoBackendDesktop | null>;
    importarAmbienteDev(): Promise<{ ok: boolean; mensagem: string } | null>;
  };
};

declare global {
  interface Window {
    oracleDesktop?: OracleDesktop;
  }
}

export function ponteDesktop(): OracleDesktop | null {
  if (typeof window === "undefined") return null;
  const p = window.oracleDesktop;
  return p && p.ehDesktop === true ? p : null;
}

export function ehDesktop(): boolean {
  return ponteDesktop() !== null;
}
