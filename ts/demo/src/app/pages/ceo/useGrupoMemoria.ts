// ----------------------------------------------------------------------
// Hooks que mantêm a pasta da Memória do grupo em dia (ver memoria-grupos.ts).
//
// Existem dois momentos em que uma conversa passa a pertencer a um grupo:
// nasce dentro dele (ChatDetail grava a cada resposta) ou é movida para ele
// depois. Este hook cobre o segundo caso — o .md sai com todo o histórico já
// trocado, não só com o que vier daí em diante.
// ----------------------------------------------------------------------

import { useCallback } from "react";

import { useChatsContext } from "@/app/contexts/chats/context";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { fetchConversaApi } from "@/services/api/conversas";
import { memoriaVaultSupported } from "@/utils/memoriaVault";
import {
  avisarFalhaMemoria,
  salvarConversaNoGrupo,
  type MensagemConversa,
} from "./memoria-grupos";

/**
 * Move o chat para um grupo (ou o tira do grupo, com `null`). Ao entrar num
 * grupo, a conversa também é gravada como .md na pasta desse grupo.
 */
export function useMoverChatParaGrupo() {
  const { getChat, moveChatToProject } = useChatsContext();
  const { getProject } = useProjectsContext();

  return useCallback(
    async (chatId: string, projectId: string | null) => {
      moveChatToProject(chatId, projectId);
      if (!projectId || !memoriaVaultSupported()) return;

      const chat = getChat(chatId);
      const grupo = getProject(projectId);
      if (!chat || !grupo) return;

      // Sem conversa no backend (ou se a leitura falhar), grava ao menos a
      // pergunta que originou o chat.
      let mensagens: MensagemConversa[] = chat.firstMessage
        ? [{ role: "user", text: chat.firstMessage }]
        : [];
      if (chat.conversaId) {
        try {
          const conversa = await fetchConversaApi(chat.conversaId);
          if (conversa.messages.length > 0) {
            mensagens = conversa.messages.map((m) => ({
              role: m.role,
              text: m.text,
            }));
          }
        } catch {
          /* mantém o fallback */
        }
      }
      if (mensagens.length === 0) return;

      const r = await salvarConversaNoGrupo({
        grupo: grupo.title,
        titulo: chat.title,
        mensagens,
        autor: chat.agentReference ?? chat.squadName,
      });
      if (!r.ok) avisarFalhaMemoria(r.reason);
    },
    [getChat, getProject, moveChatToProject],
  );
}
