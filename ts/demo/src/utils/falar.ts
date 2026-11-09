// ----------------------------------------------------------------------
// Resposta falada — voz do próprio navegador (Web Speech API, speechSynthesis).
//
// Sem custo e sem chave. A qualidade depende do navegador: no Edge há vozes
// "naturais" em português (ex.: Francisca); no Chrome, as vozes do Google.
// Algumas vozes rodam no computador; as "Online"/"Natural" usam o serviço do
// navegador.
//
// A resposta do Oracle vem em Markdown, com links, tabelas e citações: aqui
// ela vira texto corrido curto, que soa bem lido em voz alta.
// ----------------------------------------------------------------------

import { toast } from "sonner";

import { getMotorVoz, getVozNeural, getVozNome } from "@/utils/oraclePrefs";
import { semConexoesVault } from "@/utils/semConexoesVault";
import {
  estaFalandoNeural,
  falarNeural,
  pararNeural,
  vozesBaixadas,
  vozNeuralDoIdioma,
  vozNeuralSuportada,
} from "@/utils/vozNeural";

/** Teto do que é lido em voz alta (respostas longas ficam na tela). */
const MAX_CARACTERES = 700;

function navegadorFala(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Há algum motor de fala disponível (navegador ou voz neural local). */
export function falaSuportada(): boolean {
  return navegadorFala() || (getMotorVoz() === "neural" && vozNeuralSuportada());
}

/** Vozes disponíveis (carregam de forma assíncrona em alguns navegadores). */
export function vozesDisponiveis(): Promise<SpeechSynthesisVoice[]> {
  if (!navegadorFala()) return Promise.resolve([]);
  const ja = window.speechSynthesis.getVoices();
  if (ja.length) return Promise.resolve(ja);
  return new Promise((resolve) => {
    const pronto = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener("voiceschanged", pronto, { once: true });
    // Alguns navegadores nunca disparam o evento.
    setTimeout(pronto, 1500);
  });
}

/** Vozes do idioma pedido, as mais naturais primeiro. */
export function vozesDoIdioma(vozes: SpeechSynthesisVoice[], idioma = "pt-BR"): SpeechSynthesisVoice[] {
  const base = idioma.slice(0, 2).toLowerCase();
  const nota = (v: SpeechSynthesisVoice) =>
    (/natural|neural/i.test(v.name) ? 4 : 0) +
    (/online|google/i.test(v.name) ? 2 : 0) +
    (v.lang.toLowerCase() === idioma.toLowerCase() ? 1 : 0);
  return vozes
    .filter((v) => v.lang.toLowerCase().startsWith(base))
    .sort((a, b) => nota(b) - nota(a));
}

/** Markdown da resposta → texto corrido curto para leitura. */
export function textoParaFala(markdown: string, opts: { semLimite?: boolean } = {}): string {
  let t = semConexoesVault(markdown)
    .replace(/```[\s\S]*?```/g, " ") // blocos de código
    .replace(/^\s*\|.*\|\s*$/gm, " ") // tabelas
    .replace(/^>\s*⚠️.*$/gm, " ") // avisos do sistema
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // imagens
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → texto
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1") // [[wikilinks]]
    .replace(/https?:\/\/\S+/g, " ") // URLs soltas
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "") // títulos
    .replace(/^\s*[-*+]\s+/gm, "") // marcadores de lista
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1") // ênfases
    .replace(/^>\s?/gm, "");
  // Linha a linha: descarta vazias e rótulos soltos ("Fontes:"), e termina
  // cada linha com pontuação para a voz fazer a pausa certa.
  t = t
    .split("\n")
    .map((l) => l.replace(/\s{2,}/g, " ").trim())
    .filter((l) => l && !/^(fontes?|sources?|referências?)\s*:?$/i.test(l) && /[\p{L}\p{N}]/u.test(l))
    .map((l) => (/[.!?:;]$/.test(l) ? l : `${l}.`))
    .join(" ")
    .replace(/:\s*$/, ".")
    .trim();
  if (!opts.semLimite && t.length > MAX_CARACTERES) {
    // Corta no fim de uma frase e avisa que o resto está na tela.
    const corte = t.slice(0, MAX_CARACTERES);
    const fim = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("! "), corte.lastIndexOf("? "));
    t = `${corte.slice(0, fim > 200 ? fim + 1 : MAX_CARACTERES)} O restante está na tela.`;
  }
  return t;
}

/** Frases curtas: o Chrome interrompe falas longas depois de ~15 s. */
export function emPartes(texto: string): string[] {
  const frases = texto.match(/[^.!?]+[.!?]*\s*/g) ?? [texto];
  const partes: string[] = [];
  let atual = "";
  for (const f of frases) {
    if ((atual + f).length > 180 && atual) {
      partes.push(atual.trim());
      atual = "";
    }
    atual += f;
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}

/** Avisos de queda para a voz do navegador: uma vez por motivo e por sessão. */
const avisados = new Set<string>();
function avisarUmaVez(chave: string, msg: string) {
  if (avisados.has(chave)) return;
  avisados.add(chave);
  toast.warning(msg, { duration: 8000 });
}

let falando = false;
/** Cada fala nova (ou parada) invalida as que ainda estão se preparando. */
let pedidoFala = 0;

export function estaFalando(): boolean {
  return falando || estaFalandoNeural();
}

/** Interrompe qualquer fala em andamento (dos dois motores). */
export function pararFala(): void {
  pedidoFala++;
  pararNeural();
  if (!navegadorFala()) return;
  falando = false;
  window.speechSynthesis.cancel();
}

/**
 * Lê o texto (já limpo ou Markdown) com a voz escolhida em Configurações ›
 * Voz, ou a melhor voz do idioma. Uma fala nova interrompe a anterior.
 */
export async function falar(
  textoOuMarkdown: string,
  opts: {
    idioma?: string;
    vozNome?: string;
    /** "interrompido": cortada por pararFala() ou por outra fala. */
    onFim?: (motivo: "fim" | "interrompido") => void;
    /** Não corta textos longos (o briefing já vem no tamanho certo). */
    semLimite?: boolean;
    /** 0–1. */
    volume?: number;
  } = {},
): Promise<void> {
  if (!falaSuportada()) return;
  const texto = textoParaFala(textoOuMarkdown, { semLimite: opts.semLimite });
  if (!texto) return;
  pararFala();
  const meu = pedidoFala;

  const idioma = opts.idioma ?? "pt-BR";

  // Voz neural local (Piper), se escolhida e já baixada para o idioma.
  // Qualquer falha cai na voz do navegador.
  if (getMotorVoz() === "neural" && !opts.vozNome) {
    const baixadas = vozNeuralSuportada() ? await vozesBaixadas() : [];
    if (meu !== pedidoFala) return;
    const neural = vozNeuralSuportada() ? vozNeuralDoIdioma(getVozNeural(), idioma, baixadas) : undefined;
    if (!neural) {
      avisarUmaVez("sem-suporte", "Este navegador não roda a voz neural local; usando a voz do navegador.");
    } else if (!baixadas.includes(neural.id)) {
      const lingua = idioma.startsWith("en") ? "inglês" : "português";
      avisarUmaVez(
        `nao-baixada:${idioma}`,
        `Nenhuma voz neural em ${lingua} foi baixada neste navegador (Configurações › Voz); usando a voz do navegador.`,
      );
    } else {
      if (meu !== pedidoFala) return;
      try {
        await falarNeural(emPartes(texto), neural.id, { volume: opts.volume, onFim: opts.onFim });
        return;
      } catch (err) {
        console.warn("Voz neural indisponível; usando a voz do navegador.", err);
        avisarUmaVez(
          "falhou",
          `A voz neural falhou (${err instanceof Error ? err.message : String(err)}); usando a voz do navegador.`,
        );
        if (meu !== pedidoFala) return;
      }
    }
  }
  if (!navegadorFala()) {
    opts.onFim?.("fim");
    return;
  }

  const vozes = await vozesDisponiveis();
  if (meu !== pedidoFala) return;
  const nome = opts.vozNome ?? getVozNome();
  const voz = (nome && vozes.find((v) => v.name === nome)) || vozesDoIdioma(vozes, idioma)[0] || null;

  const partes = emPartes(texto);
  falando = true;
  partes.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = voz?.lang ?? idioma;
    if (voz) u.voice = voz;
    u.rate = 1.05;
    if (opts.volume !== undefined) u.volume = Math.min(1, Math.max(0, opts.volume));
    if (i === partes.length - 1) {
      u.onend = () => {
        falando = false;
        opts.onFim?.("fim");
      };
      u.onerror = (e) => {
        falando = false;
        opts.onFim?.(e.error === "interrupted" || e.error === "canceled" ? "interrompido" : "fim");
      };
    }
    window.speechSynthesis.speak(u);
  });
}
