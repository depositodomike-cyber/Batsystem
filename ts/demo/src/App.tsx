// Import Dependencies
import { RouterProvider } from "react-router";

// Local Imports
import { AuthProvider } from "@/app/contexts/auth/Provider";
import { BreakpointProvider } from "@/app/contexts/breakpoint/Provider";
import { ChatsProvider } from "@/app/contexts/chats/Provider";
import { CompaniesProvider } from "@/app/contexts/companies/Provider";
import { LocaleProvider } from "@/app/contexts/locale/Provider";
import { ProjectsProvider } from "@/app/contexts/projects/Provider";
import { SquadsProvider } from "@/app/contexts/squads/Provider";
import { DocumentsProvider } from "@/app/contexts/documents/Provider";
import { LikesProvider } from "@/app/contexts/likes/Provider";
import { CommentsProvider } from "@/app/contexts/comments/Provider";
import { ConnectorsProvider } from "@/app/contexts/connectors/Provider";
import { MemoryProvider } from "@/app/contexts/memory/Provider";
import { IaModalsHostProvider } from "@/app/contexts/ia-modals/Provider";
import { SidebarProvider } from "@/app/contexts/sidebar/Provider";
import { ThemeProvider } from "@/app/contexts/theme/Provider";
import { PrototipoContasProvider } from "@/app/pages/prototypes/contas/model/Provider";
import router from "./app/router/router";

// ----------------------------------------------------------------------

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LocaleProvider>
          <BreakpointProvider>
            <SidebarProvider>
              <CompaniesProvider>
                <PrototipoContasProvider>
                  <ProjectsProvider>
                    <SquadsProvider>
                      <ChatsProvider>
                        <DocumentsProvider>
                          <LikesProvider>
                            <CommentsProvider>
                              <ConnectorsProvider>
                                <MemoryProvider>
                                  <IaModalsHostProvider>
                                    <RouterProvider router={router} />
                                  </IaModalsHostProvider>
                                </MemoryProvider>
                              </ConnectorsProvider>
                            </CommentsProvider>
                          </LikesProvider>
                        </DocumentsProvider>
                      </ChatsProvider>
                    </SquadsProvider>
                  </ProjectsProvider>
                </PrototipoContasProvider>
              </CompaniesProvider>
            </SidebarProvider>
          </BreakpointProvider>
        </LocaleProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
