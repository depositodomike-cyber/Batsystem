// ----------------------------------------------------------------------
// Operações para o briefing: tarefas do quadro (Kanban) e projetos, que vivem
// no localStorage deste navegador. Só lê o que o usuário gravou — os quadros
// de exemplo (quando nada foi salvo ainda) não entram como se fossem reais.
// ----------------------------------------------------------------------

import { lerComMigracao } from "@/utils/escopoConta";
import { KANBAN_STORAGE_BASE, loadBoards, sendTaskToColumn } from "@/app/pages/apps/kanban/store";
import type { Board } from "@/app/pages/apps/kanban/data";
import type { Project } from "@/app/contexts/projects/context";
import type { OperacoesCliente } from "@/services/api/briefing";

const MAX_TAREFAS = 40;

export function coletarOperacoes(projetos: Project[]): OperacoesCliente {
  let boards: Board[] = [];
  try {
    const raw = lerComMigracao(KANBAN_STORAGE_BASE);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) boards = parsed as Board[];
  } catch {
    boards = [];
  }

  const tarefas: NonNullable<OperacoesCliente["tarefas"]> = [];
  for (const b of boards) {
    for (const col of b.columns ?? []) {
      if (col.slug === "concluido") continue;
      for (const id of col.tasks ?? []) {
        const t = b.tasks?.find((x) => x.id === id);
        if (!t?.title) continue;
        const prazo = t.dueDate ? new Date(t.dueDate) : null;
        tarefas.push({
          id: t.id,
          titulo: t.title,
          status: col.name,
          ...(t.priority ? { prioridade: t.priority } : {}),
          ...(prazo && !Number.isNaN(prazo.getTime()) ? { prazo: prazo.toISOString().slice(0, 10) } : {}),
          projeto: b.name,
        });
      }
    }
  }
  // Com prazo e prioridade alta primeiro: são as que importam para o dia.
  tarefas.sort((a, b) => {
    const pa = a.prazo ? 0 : 1;
    const pb = b.prazo ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (a.prazo && b.prazo && a.prazo !== b.prazo) return a.prazo < b.prazo ? -1 : 1;
    return (a.prioridade === "alta" ? 0 : 1) - (b.prioridade === "alta" ? 0 : 1);
  });

  return {
    tarefas: tarefas.slice(0, MAX_TAREFAS),
    projetos: projetos.slice(0, 20).map((p) => ({
      id: p.id,
      nome: p.title,
      ...(p.instructions ? { descricao: p.instructions.slice(0, 300) } : {}),
    })),
  };
}

/** "Criar tarefa" a partir de uma pendência: entra em "A fazer" do primeiro quadro. */
export function criarTarefa(titulo: string): { board: string; column: string } {
  const board = loadBoards()[0];
  if (!board) throw new Error("Nenhum quadro de tarefas encontrado.");
  const coluna = board.columns.find((c) => c.slug === "a-fazer") ?? board.columns[0];
  if (!coluna) throw new Error("O quadro não tem etapas.");
  return sendTaskToColumn(board.id, coluna.id, titulo);
}
