// ----------------------------------------------------------------------
// Intenção de briefing — "Oracle, bom dia" e variações. A palavra de ativação
// é reconhecida à parte (Vosk), então aqui chega só o que vem depois dela.
// Só frases curtas: uma pergunta normal que começa com "bom dia" não é
// sequestrada.
// ----------------------------------------------------------------------

import type { Periodo } from "@/services/api/briefing";

export type Intencao = { tipo: "briefing"; periodo: Periodo } | { tipo: "continuar" } | null;

const MAX_CARACTERES = 80;

function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(ei |ok |hey )?(oracle|oraculo)\s*/, "")
    .replace(/\s*(oracle|oraculo)$/, "")
    .trim();
}

const SAUDACAO = /^(ola |oi )?(bom dia|boa tarde|boa noite|good morning|good afternoon|good evening)( tudo bem| como vai| como voce esta)?$/;

const NOITE = [
  /\bcomo foi (o )?meu dia\b/,
  /\bresumo (noturno|da noite|do fim do dia)\b/,
  /\bhow was my day\b/,
];

const MANHA = [
  /\bme atualiz[ae]\b/,
  /\bo que (eu )?(preciso|devo) saber\b/,
  /\bcomo (esta|ta|vai) (o )?meu dia\b/,
  /\b(faca|faz|fazer|me de|me da|quero) (o )?meu (resumo|briefing)\b/,
  /\bresumo (diario|do dia|matinal|de hoje)\b/,
  /\bmeu (resumo|briefing)( de hoje| do dia)?$/,
  /^briefing( de hoje| do dia)?$/,
  /\bwhat do i need to know\b/,
  /\b(brief me|my briefing|daily briefing)\b/,
];

const CONTINUAR =
  /^(continue|continua|continuar|continuar o (briefing|resumo)|pode (continuar|seguir)|segue|siga|prossiga|vai em frente|go on|keep going)$/;

export function detectarIntencao(texto: string, opts: { briefingAtivo?: boolean } = {}): Intencao {
  if (!texto || texto.length > MAX_CARACTERES) return null;
  const t = normalizar(texto);
  if (!t) return null;
  if (opts.briefingAtivo && CONTINUAR.test(t)) return { tipo: "continuar" };

  const saud = t.match(SAUDACAO);
  if (saud) {
    const s = saud[2];
    if (/noite|evening/.test(s)) return { tipo: "briefing", periodo: "noite" };
    if (/tarde|afternoon/.test(s)) return { tipo: "briefing", periodo: new Date().getHours() >= 18 ? "noite" : "manha" };
    return { tipo: "briefing", periodo: "manha" };
  }
  // "boa noite, como foi meu dia?" cai aqui.
  if (NOITE.some((r) => r.test(t))) return { tipo: "briefing", periodo: "noite" };
  if (MANHA.some((r) => r.test(t))) return { tipo: "briefing", periodo: "manha" };
  return null;
}
