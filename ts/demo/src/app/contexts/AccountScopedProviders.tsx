import { ReactNode, useEffect } from "react";

import { useAuthContext } from "@/app/contexts/auth/context";
import { ChatsProvider } from "@/app/contexts/chats/Provider";
import { ProjectsProvider } from "@/app/contexts/projects/Provider";
import { SquadsProvider } from "@/app/contexts/squads/Provider";
import { DocumentsProvider } from "@/app/contexts/documents/Provider";
import { LikesProvider } from "@/app/contexts/likes/Provider";
import { CommentsProvider } from "@/app/contexts/comments/Provider";
import { ConnectorsProvider } from "@/app/contexts/connectors/Provider";
import { MemoryProvider } from "@/app/contexts/memory/Provider";
import { DocumentoUploadProvider } from "@/app/contexts/documento-upload/Provider";
import { IaModalsHostProvider } from "@/app/contexts/ia-modals/Provider";
import { applyAppearancePrefs } from "@/utils/beculturePrefs";

/**
 * Providers com dados de conta. Remontam quando o usuário muda (login/logout
 * ou troca de conta), zerando estado em memória e recarregando storage
 * namespaced por `escopoConta()`.
 */
export function AccountScopedProviders({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const accountKey = user?.id ?? "anon";

  useEffect(() => {
    applyAppearancePrefs();
  }, [accountKey]);

  return (
    <ProjectsProvider key={accountKey}>
      <SquadsProvider>
        <ChatsProvider>
          <DocumentsProvider>
            <LikesProvider>
              <CommentsProvider>
                <ConnectorsProvider>
                  <MemoryProvider>
                    <DocumentoUploadProvider>
                      <IaModalsHostProvider>{children}</IaModalsHostProvider>
                    </DocumentoUploadProvider>
                  </MemoryProvider>
                </ConnectorsProvider>
              </CommentsProvider>
            </LikesProvider>
          </DocumentsProvider>
        </ChatsProvider>
      </SquadsProvider>
    </ProjectsProvider>
  );
}
