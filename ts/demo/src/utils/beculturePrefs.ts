// ----------------------------------------------------------------------
// Preferências pessoais migradas do painel ⚙ Configurações do beculture/Confi
// (app antigo). São escolhas locais (localStorage), não vão para o servidor:
//   • Aparência: animação de fundo e vinheta — aplicadas como classes no <body>
//     (no-grafo / no-vinheta), exatamente como no app original.
//   • Voz: resposta falada (TTS) das respostas após um comando de voz.
// applyAppearancePrefs() é chamada no boot (main.tsx) para que a escolha persista
// entre recarregamentos, e de novo a cada alteração na tela de Configurações.
//
// Chaves são namespaced por conta (`chaveConta`) para não misturar preferências.
// ----------------------------------------------------------------------

import { chaveConta, lerComMigracao } from "@/utils/escopoConta";

export const PREF_GRAFO = "beculture.pref.grafo";
export const PREF_VINHETA = "beculture.pref.vinheta";
export const PREF_TTS = "beculture.voz.tts";

/** Lê uma preferência booleana; ausente = ligada (padrão do app original). */
function lerBool(base: string): boolean {
  try {
    const raw = lerComMigracao(base);
    return raw !== "0";
  } catch {
    return true;
  }
}

/** Grava uma preferência booleana ("1"/"0"). */
function gravarBool(base: string, on: boolean): void {
  try {
    localStorage.setItem(chaveConta(base), on ? "1" : "0");
  } catch {
    /* localStorage indisponível (modo privado): ignora */
  }
}

// ---- Aparência --------------------------------------------------------

export function getGrafoAtivo(): boolean {
  return lerBool(PREF_GRAFO);
}

export function getVinhetaAtiva(): boolean {
  return lerBool(PREF_VINHETA);
}

/** Aplica as preferências de aparência ao <body> (idempotente). */
export function applyAppearancePrefs(): void {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("no-grafo", !getGrafoAtivo());
  document.body.classList.toggle("no-vinheta", !getVinhetaAtiva());
}

export function setGrafoAtivo(on: boolean): void {
  gravarBool(PREF_GRAFO, on);
  applyAppearancePrefs();
}

export function setVinhetaAtiva(on: boolean): void {
  gravarBool(PREF_VINHETA, on);
  applyAppearancePrefs();
}

// ---- Voz --------------------------------------------------------------

export function getTtsAtivo(): boolean {
  return lerBool(PREF_TTS);
}

export function setTtsAtivo(on: boolean): void {
  gravarBool(PREF_TTS, on);
}
