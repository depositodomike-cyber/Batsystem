// ----------------------------------------------------------------------
// Handoff leve entre telas e os modais de IA (tela de IA).
// A tela de Notas (e potencialmente outras) guarda aqui o contexto da nota
// aberta antes de navegar para `/behuman/ia?fn=<id>`; o modal correspondente
// consome o prefill ao abrir e o limpa em seguida (uso único).
// ----------------------------------------------------------------------

export interface IaPrefill {
  /** Tema / título — usado por apresentação e artigo. */
  tema?: string;
  /** Contexto / conteúdo — usado por artigo (e como texto em melhorar). */
  contexto?: string;
  /** Texto a reescrever — usado por "melhorar texto". */
  texto?: string;
}

const KEY_PREFIX = "ceo-ia-prefill:";

/** Guarda o prefill para uma função de IA (ex.: "melhorar", "artigo"). */
export function setIaPrefill(fn: string, data: IaPrefill): void {
  try {
    window.sessionStorage.setItem(KEY_PREFIX + fn, JSON.stringify(data));
  } catch {
    /* sessionStorage indisponível — ação de IA abre sem prefill */
  }
}

/** Lê e remove (uso único) o prefill de uma função de IA. */
export function takeIaPrefill(fn: string): IaPrefill | null {
  try {
    const raw = window.sessionStorage.getItem(KEY_PREFIX + fn);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY_PREFIX + fn);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as IaPrefill) : null;
  } catch {
    return null;
  }
}
