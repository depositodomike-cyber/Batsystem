import type { ConversaMessage } from "@/services/api/conversas";

import type { Turno } from "./context";

// ----------------------------------------------------------------------

function origemDe(m: ConversaMessage): "vault" | "web" {
  return m.meta?.origem === "web" ? "web" : "vault";
}

function respostaDe(m: ConversaMessage) {
  const fontes = m.meta?.fontes;
  const arquivos = m.meta?.arquivos;
  return {
    resposta: m.text,
    fontes: Array.isArray(fontes) ? fontes : [],
    origem: origemDe(m),
    agente: m.meta?.agente ?? null,
    arquivos: Array.isArray(arquivos) ? arquivos : [],
    mensagemId: m.id,
  };
}

/**
 * Converte as mensagens persistidas nos turnos que o painel renderiza. Cada
 * pergunta pareia com a resposta seguinte; respostas a mais logo em seguida
 * (vários agentes @mencionados) viram turnos de continuação, sem repetir a
 * pergunta — a timeline reabre exatamente como foi vista.
 */
export function turnosDeMensagens(messages: ConversaMessage[]): Turno[] {
  const turnos: Turno[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user") {
      const next = messages[i + 1];
      const mencoes = m.meta?.mencoes;
      turnos.push({
        pergunta: m.text,
        ...(next?.role === "assistant"
          ? respostaDe(next)
          : { resposta: "", fontes: [], origem: "vault" as const }),
        mencoes: Array.isArray(mencoes) && mencoes.length ? mencoes : undefined,
      });
      if (next?.role === "assistant") i++;
      continue;
    }
    // Resposta sem pergunta logo antes: outro agente respondendo à mesma.
    if (turnos.length) {
      turnos.push({ pergunta: "", ...respostaDe(m), continuacao: true });
    }
  }
  return turnos;
}
