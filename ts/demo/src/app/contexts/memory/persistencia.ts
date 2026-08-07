/**
 * Persistência local das Regras quando a API está fora ou a sessão é do
 * protótipo (JWT `*.prototype`). Espelha o padrão dos conectores.
 */

import type { MemoryItem } from "@/app/data/memoria";

const CHAVE_PREFIXO = "beculture:memorias:v1:";

function chave(escopo: string): string {
  return `${CHAVE_PREFIXO}${escopo}`;
}

export function escopoMemoriasLocal(): string {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) return "anon";
    // Preferência: e-mail do payload JWT (real ou protótipo).
    const parte = token.split(".")[1];
    if (!parte) return "anon";
    const json = JSON.parse(
      atob(parte.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { email?: string; sub?: string };
    return (json.email || json.sub || "anon").toLowerCase();
  } catch {
    return "anon";
  }
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
