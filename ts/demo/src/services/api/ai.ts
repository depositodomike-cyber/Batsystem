import { JWT_HOST_API } from "@/configs/auth";

export interface AiChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AiChatRequest {
  squadId: string;
  agentId?: string;
  /** Conversa existente a continuar; ausente cria uma nova no backend. */
  conversaId?: string;
  messages: AiChatTurn[];
}

/**
 * Faz streaming da resposta de um squad/agente (backend ts/api → Claude).
 * Lê o SSE via fetch e chama `onDelta` para cada pedaço de texto.
 *
 * O backend persiste a conversa e devolve o `conversaId` (evento `meta`/`done`),
 * retornado aqui para o chamador navegar/continuar a mesma conversa.
 */
export async function streamSquadChat(
  body: AiChatRequest,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<{ conversaId: string | null }> {
  const token = localStorage.getItem("authToken");
  const res = await fetch(`${JWT_HOST_API}/ai/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error("Não foi possível conectar à IA.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let conversaId: string | null = body.conversaId ?? null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE: eventos separados por linha em branco.
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const json = line.slice(5).trim();
      if (!json) continue;

      let evt: {
        type: string;
        text?: string;
        message?: string;
        conversaId?: string;
      };
      try {
        evt = JSON.parse(json);
      } catch {
        continue;
      }

      if (evt.type === "delta" && evt.text) {
        onDelta(evt.text);
      } else if (evt.type === "meta" && evt.conversaId) {
        conversaId = evt.conversaId;
      } else if (evt.type === "done") {
        if (evt.conversaId) conversaId = evt.conversaId;
      } else if (evt.type === "error") {
        throw new Error(evt.message ?? "Erro ao gerar resposta.");
      }
    }
  }

  return { conversaId };
}
