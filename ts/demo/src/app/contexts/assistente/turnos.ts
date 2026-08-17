import type { ConversaMessage } from "@/services/api/conversas";

import type { Turno } from "./context";

// ----------------------------------------------------------------------

function origemDe(m: ConversaMessage): "vault" | "web" {
  return m.meta?.origem === "web" ? "web" : "vault";
}

/**
 * Converte as mensagens persistidas (user/assistant alternados) nos turnos que
 * o painel renderiza. Mesmo pareamento usado na página de conversa completa.
 */
export function turnosDeMensagens(messages: ConversaMessage[]): Turno[] {
  const turnos: Turno[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const next = messages[i + 1];
    const resposta = next?.role === "assistant" ? next : null;
    const fontes = resposta?.meta?.fontes;
    turnos.push({
      pergunta: m.text,
      resposta: resposta?.text ?? "",
      fontes: Array.isArray(fontes) ? fontes : [],
      origem: resposta ? origemDe(resposta) : "vault",
    });
  }
  return turnos;
}
