// ----------------------------------------------------------------------
// Armazenamento das Notas (localStorage, por conta). Extraído de Notas.tsx
// para que outras entradas — hoje, a caixa de entrada do Telegram — criem
// notas na MESMA lista, sem um sistema paralelo.
// ----------------------------------------------------------------------

import { chaveConta, lerComMigracao } from "@/utils/escopoConta";

/** Metadados de uma nota que veio do bot do Telegram. */
export interface NotaTelegramMeta {
  /** Id da mensagem na fila do servidor. */
  mensagemId: string;
  chatId: string;
  messageId: number;
  tipo: "texto" | "voz" | "audio";
  legenda?: string | null;
  recebidaEm: string;
  processadaEm?: string | null;
  /** nas_notas = ainda sem o .md no Repositório; no_repositorio = gravada. */
  status: "nas_notas" | "no_repositorio";
  repositorioPath?: string | null;
}

export interface Nota {
  id: string;
  /** Nome do assunto ("" = Sem assunto). */
  assunto: string;
  titulo: string;
  corpo: string;
  criadaEm: number;
  atualizadaEm: number;
  /** Ausente = criada na própria tela de Notas. */
  origem?: "telegram";
  telegram?: NotaTelegramMeta;
}

export const NOTAS_BASE = "ceo-notas-itens";
export const ASSUNTOS_BASE = "ceo-notas-assuntos";

/** Disparado quando as notas mudam fora da tela de Notas. */
export const EVENTO_NOTAS_ATUALIZADAS = "notas:atualizadas";

export function notasKey(): string {
  return chaveConta(NOTAS_BASE);
}
export function assuntosKey(): string {
  return chaveConta(ASSUNTOS_BASE);
}

export function readJSON<T>(key: string, fallback: T, base?: string): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = base ? lerComMigracao(base) : window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function lerNotas(): Nota[] {
  return readJSON<Nota[]>(notasKey(), [], NOTAS_BASE);
}

export function lerAssuntos(): string[] {
  return readJSON<string[]>(assuntosKey(), [], ASSUNTOS_BASE);
}

function gravar(key: string, valor: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

/**
 * Acrescenta notas vindas de fora (ids já existentes são ignorados) e garante
 * o assunto. Devolve as que entraram de fato.
 */
export function adicionarNotas(novas: Nota[], assunto?: string): Nota[] {
  const atuais = lerNotas();
  const ids = new Set(atuais.map((n) => n.id));
  const entram = novas.filter((n) => !ids.has(n.id));
  if (!entram.length) return [];
  if (!gravar(notasKey(), [...entram, ...atuais])) return [];
  if (assunto) {
    const assuntos = lerAssuntos();
    if (!assuntos.some((a) => a.toLowerCase() === assunto.toLowerCase())) {
      gravar(assuntosKey(), [...assuntos, assunto]);
    }
  }
  window.dispatchEvent(new CustomEvent(EVENTO_NOTAS_ATUALIZADAS));
  return entram;
}

/** Atualiza uma nota existente (merge raso). */
export function atualizarNota(id: string, patch: (n: Nota) => Nota): boolean {
  const atuais = lerNotas();
  let mudou = false;
  const prox = atuais.map((n) => {
    if (n.id !== id) return n;
    mudou = true;
    return patch(n);
  });
  if (!mudou || !gravar(notasKey(), prox)) return false;
  window.dispatchEvent(new CustomEvent(EVENTO_NOTAS_ATUALIZADAS));
  return true;
}

// Deriva um título a partir da primeira linha do corpo (quando o usuário não
// informa um título explícito).
export function tituloAuto(corpo: string): string {
  const primeira = corpo.trim().split("\n")[0]?.trim() ?? "";
  if (!primeira) return "Nota sem título";
  return primeira.length > 80 ? primeira.slice(0, 80) + "…" : primeira;
}
