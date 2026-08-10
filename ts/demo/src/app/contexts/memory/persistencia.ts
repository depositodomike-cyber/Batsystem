/**
 * Persistência local das Regras quando a API está fora ou a sessão é do
 * protótipo (JWT `*.prototype`). Espelha o padrão dos conectores.
 */

import type { MemoryItem } from "@/app/data/memoria";
import { chaveConta, escopoConta } from "@/utils/escopoConta";

const CHAVE_PREFIXO = "beculture:memorias:v1";

export function escopoMemoriasLocal(): string {
  return escopoConta();
}

function chave(escopo: string): string {
  return `${CHAVE_PREFIXO}:${escopo}`;
}

export function tokenEhPrototipo(): boolean {
  try {
    return (localStorage.getItem("authToken") ?? "").endsWith(".prototype");
  } catch {
    return true;
  }
}

export function carregarMemoriasLocal(escopo = escopoMemoriasLocal()): MemoryItem[] {
  try {
    const cru = localStorage.getItem(chave(escopo));
    if (!cru) return [];
    const parsed = JSON.parse(cru) as MemoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function salvarMemoriasLocal(
  items: MemoryItem[],
  escopo = escopoMemoriasLocal(),
): void {
  try {
    localStorage.setItem(chave(escopo), JSON.stringify(items));
  } catch {
    // modo privado / cota
  }
}

/** Chave completa da conta atual (útil para debug). */
export function chaveMemoriasContaAtual(): string {
  return chaveConta(CHAVE_PREFIXO);
}
