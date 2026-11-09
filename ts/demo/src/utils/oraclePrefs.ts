// ----------------------------------------------------------------------
// Preferências pessoais migradas do painel ⚙ Configurações do Oracle/Confi
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

export const PREF_GRAFO = "oracle.pref.grafo";
export const PREF_VINHETA = "oracle.pref.vinheta";
export const PREF_TTS = "oracle.voz.tts";

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

/** Voz escolhida para a resposta falada (nome da voz do navegador; "" = automática). */
export const PREF_VOZ_NOME = "oracle.voz.nome";

export function getVozNome(): string {
  try {
    return localStorage.getItem(chaveConta(PREF_VOZ_NOME)) ?? "";
  } catch {
    return "";
  }
}

export function setVozNome(nome: string): void {
  try {
    localStorage.setItem(chaveConta(PREF_VOZ_NOME), nome);
  } catch {
    /* modo privado */
  }
}

/**
 * Motor da fala: "navegador" (speechSynthesis) ou "neural" (Piper local,
 * utils/vozNeural.ts — mais natural, sem custo). Padrão: navegador.
 */
export type MotorVoz = "navegador" | "neural";
export const PREF_VOZ_MOTOR = "oracle.voz.motor";
/** Voz neural escolhida (id do Piper, ex.: "pt_BR-faber-medium"). */
export const PREF_VOZ_NEURAL = "oracle.voz.neural";

export function getMotorVoz(): MotorVoz {
  try {
    return localStorage.getItem(chaveConta(PREF_VOZ_MOTOR)) === "neural" ? "neural" : "navegador";
  } catch {
    return "navegador";
  }
}

export function setMotorVoz(m: MotorVoz): void {
  try {
    localStorage.setItem(chaveConta(PREF_VOZ_MOTOR), m);
  } catch {
    /* modo privado */
  }
}

export function getVozNeural(): string {
  try {
    return localStorage.getItem(chaveConta(PREF_VOZ_NEURAL)) ?? "";
  } catch {
    return "";
  }
}

export function setVozNeural(id: string): void {
  try {
    localStorage.setItem(chaveConta(PREF_VOZ_NEURAL), id);
  } catch {
    /* modo privado */
  }
}

// ---- Ativação por voz (wake word) -------------------------------------
// Diferente das outras preferências daqui, nasce DESLIGADA: escutar o
// microfone o tempo todo é algo que a pessoa liga de propósito.

export const PREF_ESCUTA = "oracle.voz.escuta";
/** Evento disparado no window quando a preferência muda (outras telas ouvem). */
export const EVENTO_ESCUTA = "oracle:escuta";

export function getEscutaAtiva(): boolean {
  try {
    return lerComMigracao(PREF_ESCUTA) === "1";
  } catch {
    return false;
  }
}

export function setEscutaAtiva(on: boolean): void {
  gravarBool(PREF_ESCUTA, on);
  window.dispatchEvent(new CustomEvent(EVENTO_ESCUTA, { detail: on }));
}
