import { app } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Preferências do app desktop (não do Oracle): ficam em
 * `userData/preferencias.json`, em claro — nada aqui é sensível.
 */

export interface PreferenciasDesktop {
  /** Fechar a janela esconde o app na bandeja em vez de sair. */
  fecharParaBandeja: boolean;
  /** Abrir o Oracle ao entrar no Windows (desligado por padrão). */
  iniciarComWindows: boolean;
  /** Ao iniciar com o Windows, abrir direto na bandeja. */
  iniciarNaBandeja: boolean;
  /** Atalho global para mostrar/esconder (formato Electron Accelerator; "" = nenhum). */
  atalhoGlobal: string;
  /** Iniciar o Oracle Local Agent (se pareado) quando o app abre. Desligado por
   * padrão: o agente controla o computador, então ligá-lo é escolha explícita. */
  iniciarAgente: boolean;
  /** Notificações nativas do Windows (ex.: nota nova do Telegram). */
  notificacoes: boolean;
}

export const PADRAO: PreferenciasDesktop = {
  fecharParaBandeja: true,
  iniciarComWindows: false,
  iniciarNaBandeja: true,
  atalhoGlobal: "CommandOrControl+Alt+O",
  iniciarAgente: false,
  notificacoes: true,
};

let atual: PreferenciasDesktop | null = null;

function arquivo(): string {
  return path.join(app.getPath("userData"), "preferencias.json");
}

export function preferencias(): PreferenciasDesktop {
  if (atual) return atual;
  try {
    const lido = JSON.parse(readFileSync(arquivo(), "utf8")) as Partial<PreferenciasDesktop>;
    atual = { ...PADRAO, ...validar(lido) };
  } catch {
    atual = { ...PADRAO };
  }
  return atual;
}

/** Aceita só os campos conhecidos, com o tipo certo. */
export function validar(p: unknown): Partial<PreferenciasDesktop> {
  if (typeof p !== "object" || p === null) return {};
  const o = p as Record<string, unknown>;
  const out: Partial<PreferenciasDesktop> = {};
  for (const k of ["fecharParaBandeja", "iniciarComWindows", "iniciarNaBandeja", "iniciarAgente", "notificacoes"] as const) {
    if (typeof o[k] === "boolean") out[k] = o[k] as boolean;
  }
  if (typeof o.atalhoGlobal === "string" && atalhoAceitavel(o.atalhoGlobal)) {
    out.atalhoGlobal = o.atalhoGlobal;
  }
  return out;
}

const MODIFICADORES = /^(CommandOrControl|CmdOrCtrl|Control|Ctrl|Alt|Option|AltGr|Shift|Super|Meta)$/i;

/**
 * Vazio (desliga) ou com pelo menos um modificador: um atalho global de tecla
 * solta (ex.: "A") roubaria a tecla de todos os programas (GD-16).
 */
export function atalhoAceitavel(a: string): boolean {
  if (a === "") return true;
  if (a.length > 64) return false;
  const partes = a.split("+");
  return partes.length >= 2 && partes.slice(0, -1).some((p) => MODIFICADORES.test(p)) && partes.at(-1) !== "";
}

export function salvarPreferencias(parcial: Partial<PreferenciasDesktop>): PreferenciasDesktop {
  atual = { ...preferencias(), ...validar(parcial) };
  writeFileSync(arquivo(), JSON.stringify(atual, null, 2));
  return atual;
}
