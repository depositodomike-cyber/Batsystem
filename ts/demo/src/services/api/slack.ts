import axios from "@/utils/axios";

import type { SlackConversaResumo, SlackMensagem } from "@/app/data/slack";

// Workspace real do conector Slack (ts/api, SlackApiService).
// A listagem de conversas e a leitura das mensagens são separadas de propósito:
// cada conversa custa uma chamada de histórico (mais uma por thread), então só
// a conversa aberta na tela é lida.

export interface SlackWorkspaceLido {
  /** Canais, conversas em grupo e DMs da conta que autorizou. */
  conversas: SlackConversaResumo[];
  /** Nome da conta no Slack cujas conversas estão sendo lidas. */
  conta: string | null;
}

/** Conversas da conta autorizada, com o nome dela. */
export async function fetchConversasSlackApi(): Promise<SlackWorkspaceLido> {
  const { data } = await axios.get<{
    conversas: SlackConversaResumo[];
    conta: string | null;
  }>("/conectores/slack/conversas");
  return { conversas: data.conversas ?? [], conta: data.conta ?? null };
}

/** Mensagens de uma conversa, com as respostas de cada thread. */
export async function fetchMensagensSlackApi(
  canalId: string,
  limite = 50,
): Promise<SlackMensagem[]> {
  const { data } = await axios.get<{ mensagens: SlackMensagem[] }>(
    `/conectores/slack/conversas/${encodeURIComponent(canalId)}/mensagens`,
    { params: { limite } },
  );
  return data.mensagens ?? [];
}
