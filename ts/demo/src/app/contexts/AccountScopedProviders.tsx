import { ReactNode, useEffect } from "react";

import { useAuthContext } from "@/app/contexts/auth/context";
import { ChatsProvider } from "@/app/contexts/chats/Provider";
import { ConversasProvider } from "@/app/contexts/conversas/Provider";
import { ProjectsProvider } from "@/app/contexts/projects/Provider";
import { SquadsProvider } from "@/app/contexts/squads/Provider";
import { DocumentsProvider } from "@/app/contexts/documents/Provider";
import { LikesProvider } from "@/app/contexts/likes/Provider";
import { CommentsProvider } from "@/app/contexts/comments/Provider";
import { ConnectorsProvider } from "@/app/contexts/connectors/Provider";
import { MemoryProvider } from "@/app/contexts/memory/Provider";
import { DocumentoUploadProvider } from "@/app/contexts/documento-upload/Provider";
import { IaModalsHostProvider } from "@/app/contexts/ia-modals/Provider";
import { AssistenteHostProvider } from "@/app/contexts/assistente/Provider";
import { applyAppearancePrefs } from "@/utils/beculturePrefs";

/**
 * Providers com dados de conta. Remontam quando o usuário muda (login/logout
 * ou troca de conta), zerando estado em memória e recarregando storage
 * namespaced por `escopoConta()`.
 */
export function AccountScopedProviders({ children }: { children: ReactNode }) {
  const { user, isInitialized } = useAuthContext();
  const accountKey = user?.id ?? "anon";

  useEffect(() => {
    applyAppearancePrefs();
  }, [accountKey]);

  // Nada monta antes de a sessão estar resolvida.
  //
  // Estes providers buscam dados no efeito de mount, e antes do `isInitialized`
  // eles montavam com `accountKey === "anon"`: uma rodada inteira de
  // requisições saía, o `user` chegava, a key mudava, tudo remontava e as
  // mesmas requisições saíam de novo — o dobro de chamadas, e o resultado da
  // primeira rodada ainda podia vencer a corrida e sobrescrever a segunda.
  //
  // Não custa nada visualmente: `Root` (layout raiz do router) já renderiza
  // null enquanto `!isInitialized`, então nenhum consumidor destes contextos
  // existe nesta janela.
  if (!isInitialized) return <>{children}</>;

  return (
    <ProjectsProvider key={accountKey}>
      <SquadsProvider>
        <ChatsProvider>
          <ConversasProvider>
          <DocumentsProvider>
            <LikesProvider>
              <CommentsProvider>
                <ConnectorsProvider>
                  <MemoryProvider>
                    <DocumentoUploadProvider>
                      <AssistenteHostProvider>
                        <IaModalsHostProvider>{children}</IaModalsHostProvider>
                      </AssistenteHostProvider>
                    </DocumentoUploadProvider>
                  </MemoryProvider>
                </ConnectorsProvider>
              </CommentsProvider>
            </LikesProvider>
          </DocumentsProvider>
          </ConversasProvider>
        </ChatsProvider>
      </SquadsProvider>
    </ProjectsProvider>
  );
}
