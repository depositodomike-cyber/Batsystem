import type { ConversaListItem } from "@/services/api/conversas";

export type PeriodoConversa = "hoje" | "ontem" | "semana" | "antigas";

function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function periodoDe(iso: string): PeriodoConversa {
  const t = inicioDoDia(new Date(iso));
  const hoje = inicioDoDia(new Date());
  const ontem = hoje - 86_400_000;
  const sete = hoje - 7 * 86_400_000;
  if (t >= hoje) return "hoje";
  if (t >= ontem) return "ontem";
  if (t >= sete) return "semana";
  return "antigas";
}

export const ROTULO_PERIODO: Record<PeriodoConversa, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Últimos 7 dias",
  antigas: "Mais antigas",
};

/** Agrupa na ordem Hoje → Ontem → Últimos 7 dias → Mais antigas. */
export function agruparPorPeriodo(
  items: ConversaListItem[],
): { periodo: PeriodoConversa; rotulo: string; items: ConversaListItem[] }[] {
  const buckets: Record<PeriodoConversa, ConversaListItem[]> = {
    hoje: [],
    ontem: [],
    semana: [],
    antigas: [],
  };
  for (const item of items) buckets[periodoDe(item.date)].push(item);
  const ordem: PeriodoConversa[] = ["hoje", "ontem", "semana", "antigas"];
  return ordem
    .filter((p) => buckets[p].length > 0)
    .map((periodo) => ({
      periodo,
      rotulo: ROTULO_PERIODO[periodo],
      items: buckets[periodo],
    }));
}
