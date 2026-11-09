// ----------------------------------------------------------------------
// Voz neural local — Piper TTS (open source, MIT) rodando no navegador.
//
// Sem custo e sem token: o modelo da voz (~60 MB) é baixado uma vez do
// Hugging Face e fica guardado no navegador (OPFS); a síntese roda aqui, em
// WebAssembly (onnxruntime-web). Nada passa pela API nem por provedor de IA.
//
// A biblioteca é carregada sob demanda (import dinâmico) para não pesar o
// carregamento do app de quem usa a voz do navegador.
// ----------------------------------------------------------------------

import type { Progress } from "@mintplex-labs/piper-tts-web";

export interface VozNeural {
  id: string;
  rotulo: string;
  idioma: "pt-BR" | "en-US";
  /** Tamanho aproximado do download, em MB. */
  mb: number;
}

/** Vozes oferecidas (as que a biblioteca sabe baixar). */
export const VOZES_NEURAIS: VozNeural[] = [
  { id: "pt_BR-faber-medium", rotulo: "Faber — masculina, qualidade média", idioma: "pt-BR", mb: 63 },
  { id: "pt_BR-edresson-low", rotulo: "Edresson — masculina, mais leve", idioma: "pt-BR", mb: 63 },
  { id: "en_US-lessac-medium", rotulo: "Lessac — inglês (EUA)", idioma: "en-US", mb: 63 },
  { id: "en_US-amy-medium", rotulo: "Amy — inglês (EUA), feminina", idioma: "en-US", mb: 63 },
];

export const VOZ_NEURAL_PADRAO = "pt_BR-faber-medium";

/**
 * Runtime ONNX: a biblioteca aponta para os WASM da 1.18 por padrão, mas o JS
 * instalado é outro — os dois precisam ser da MESMA versão (package.json fixa
 * onnxruntime-web nesta versão).
 */
const ORT_VERSAO = "1.31.1";
const WASM_PATHS = {
  onnxWasm: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSAO}/dist/`,
  piperData: "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.data",
  piperWasm: "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize.wasm",
};

type Lib = typeof import("@mintplex-labs/piper-tts-web");
let libPromise: Promise<Lib> | null = null;
function lib(): Promise<Lib> {
  libPromise ??= import("@mintplex-labs/piper-tts-web");
  return libPromise;
}

export function vozNeuralSuportada(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    !!navigator.storage?.getDirectory &&
    typeof Audio !== "undefined"
  );
}

export function mesmoIdioma(v: VozNeural, idioma: string): boolean {
  return v.idioma.slice(0, 2) === idioma.slice(0, 2).toLowerCase();
}

/**
 * Voz neural para falar neste idioma: a escolhida, se for do idioma; senão
 * qualquer outra do idioma já baixada; senão a primeira do idioma (a baixar).
 * Uma voz em inglês nunca lê português (e vice-versa) — soaria errado.
 */
export function vozNeuralDoIdioma(id: string, idioma: string, baixadas: string[] = []): VozNeural | undefined {
  const doIdioma = VOZES_NEURAIS.filter((v) => mesmoIdioma(v, idioma));
  const escolhida = doIdioma.find((v) => v.id === id);
  if (escolhida && (!baixadas.length || baixadas.includes(escolhida.id))) return escolhida;
  return doIdioma.find((v) => baixadas.includes(v.id)) ?? escolhida ?? doIdioma[0];
}

/** Ids das vozes já baixadas neste navegador. */
export async function vozesBaixadas(): Promise<string[]> {
  if (!vozNeuralSuportada()) return [];
  try {
    return await (await lib()).stored();
  } catch {
    return [];
  }
}

export async function vozBaixada(id: string): Promise<boolean> {
  return (await vozesBaixadas()).includes(id);
}

/** Baixa e guarda o modelo; onProgresso recebe 0–1. */
export async function baixarVoz(id: string, onProgresso?: (p: number) => void): Promise<void> {
  const l = await lib();
  await l.download(id, (p: Progress) => {
    if (p.total > 0) onProgresso?.(Math.min(1, p.loaded / p.total));
  });
  // download() grava sem esperar; confirma que o modelo ficou guardado.
  for (let i = 0; i < 20 && !(await l.stored()).includes(id); i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
  onProgresso?.(1);
}

export async function removerVoz(id: string): Promise<void> {
  const l = await lib();
  await l.remove(id);
  if (sessaoVoz === id) {
    l.TtsSession._instance = null;
    sessaoVoz = null;
  }
}

// ---- síntese ----------------------------------------------------------

/** Voz carregada na sessão (a biblioteca reaproveita uma única sessão). */
let sessaoVoz: string | null = null;

async function sessao(id: string) {
  const l = await lib();
  // Trocar de voz exige sessão nova: a reaproveitada continuaria com o modelo antigo.
  if (sessaoVoz !== id) {
    l.TtsSession._instance = null;
    sessaoVoz = id;
  }
  return l.TtsSession.create({ voiceId: id, wasmPaths: WASM_PATHS });
}

/** Sintetiza um trecho em WAV. */
export async function sintetizar(texto: string, id: string): Promise<Blob> {
  return (await sessao(id)).predict(texto);
}

// ---- reprodução -------------------------------------------------------

let token = 0;
let audioAtual: HTMLAudioElement | null = null;
let urlAtual: string | null = null;
let fimAtual: ((motivo: "fim" | "interrompido") => void) | null = null;
let falandoNeural = false;

export function estaFalandoNeural(): boolean {
  return falandoNeural;
}

function liberarAudio() {
  if (audioAtual) {
    audioAtual.onended = null;
    audioAtual.onerror = null;
    audioAtual.pause();
  }
  if (urlAtual) URL.revokeObjectURL(urlAtual);
  audioAtual = null;
  urlAtual = null;
}

/** Interrompe a fala neural em andamento (e descarta sínteses pendentes). */
export function pararNeural(): void {
  token++;
  liberarAudio();
  const fim = fimAtual;
  fimAtual = null;
  if (falandoNeural) {
    falandoNeural = false;
    fim?.("interrompido");
  }
}

/**
 * Fala as partes em sequência: enquanto uma toca, a próxima já está sendo
 * sintetizada — a fala começa logo, mesmo em textos longos.
 * Lança erro só se a PRIMEIRA síntese falhar (quem chama cai na voz do navegador).
 */
export async function falarNeural(
  partes: string[],
  id: string,
  opts: { volume?: number; onFim?: (motivo: "fim" | "interrompido") => void } = {},
): Promise<void> {
  pararNeural();
  if (!partes.length) return;
  const meu = ++token;
  const sinteses: Promise<Blob>[] = [];
  const pedir = (i: number) => {
    if (i < partes.length && !sinteses[i]) sinteses[i] = sintetizar(partes[i], id);
    return sinteses[i];
  };

  const primeira = await pedir(0); // erro aqui sobe para o fallback
  if (meu !== token) return;
  falandoNeural = true;
  fimAtual = opts.onFim ?? null;

  const terminar = (motivo: "fim" | "interrompido") => {
    if (meu !== token) return;
    liberarAudio();
    falandoNeural = false;
    const fim = fimAtual;
    fimAtual = null;
    fim?.(motivo);
  };

  const tocar = (i: number, blob: Blob) => {
    if (meu !== token) return;
    void pedir(i + 1)?.catch(() => undefined); // adianta a próxima
    liberarAudio();
    urlAtual = URL.createObjectURL(blob);
    const a = new Audio(urlAtual);
    audioAtual = a;
    if (opts.volume !== undefined) a.volume = Math.min(1, Math.max(0, opts.volume));
    a.onended = () => {
      if (meu !== token) return;
      if (i + 1 >= partes.length) return terminar("fim");
      pedir(i + 1)
        .then((b) => tocar(i + 1, b))
        .catch(() => terminar("fim"));
    };
    a.onerror = () => terminar("fim");
    a.play().catch(() => terminar("interrompido"));
  };

  tocar(0, primeira);
}
