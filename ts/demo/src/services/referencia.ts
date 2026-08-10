// Coleta a "referência" do cliente para cruzar com o Contexto no prompt
// ("Pergunte ao seu Contexto"). São os dados que o usuário mantém localmente no
// navegador — Notas e To-do's — e que o backend (/ai/prompt) aceita no campo
// `referencia`. Sem isto, a barra enviava só o Contexto (Regras) do backend
// e ignorava o que o usuário escreveu em Notas/To-do.
//
// Insights ficam de fora de propósito: hoje são dados estáticos de exemplo
// (@/app/data/insights), não conteúdo autoral do usuário — enviá-los injetaria
// contexto falso na resposta.

import { loadBoards } from "@/app/pages/apps/kanban/store";
import { lerComMigracao } from "@/utils/escopoConta";

// Limites defensivos: o campo vai junto do prompt, então mantemos enxuto.
const MAX_NOTAS = 40;
const MAX_TAREFAS = 60;
const MAX_CHARS = 12000;
const NOTAS_BASE = "ceo-notas-itens";

interface NotaLike {
  assunto?: string;
  titulo?: string;
  corpo?: string;
}

function lerNotas(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = lerComMigracao(NOTAS_BASE);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return (arr as NotaLike[])
      .slice(0, MAX_NOTAS)
      .map((n) => {
        const titulo = (n.titulo || "").trim();
        const corpo = (n.corpo || "").trim();
        const assunto = (n.assunto || "").trim();
        const cabecalho = [assunto, titulo].filter(Boolean).join(" · ");
        const texto = [cabecalho, corpo].filter(Boolean).join("\n");
        return texto.trim();
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function lerTarefas(): string[] {
  try {
    const boards = loadBoards();
    const linhas: string[] = [];
    for (const b of boards) {
      const porId = new Map(b.tasks.map((t) => [t.id, t]));
      for (const col of b.columns) {
        for (const id of col.tasks) {
          const t = porId.get(id);
          const titulo = (t?.title || "").trim();
          if (!titulo) continue;
          linhas.push(`[${b.name} · ${col.name}] ${titulo}`);
          if (linhas.length >= MAX_TAREFAS) return linhas;
        }
      }
    }
    return linhas;
  } catch {
    return [];
  }
}

/**
 * Monta o bloco de referência (Notas + To-do) para enviar ao /ai/prompt.
 * Retorna "" quando não há nada — o backend então usa só o Contexto.
 */
export function coletarReferencia(): string {
  const partes: string[] = [];

  const notas = lerNotas();
  if (notas.length) {
    partes.push(`### Notas\n${notas.join("\n\n")}`);
  }

  const tarefas = lerTarefas();
  if (tarefas.length) {
    partes.push(`### To-do\n${tarefas.join("\n")}`);
  }

  const texto = partes.join("\n\n").trim();
  return texto.length > MAX_CHARS ? texto.slice(0, MAX_CHARS) + "…" : texto;
}
