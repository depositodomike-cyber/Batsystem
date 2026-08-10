// Import Dependencies
import { RouterProvider } from "react-router";

// Local Imports
import { AuthProvider } from "@/app/contexts/auth/Provider";
import { BreakpointProvider } from "@/app/contexts/breakpoint/Provider";
import { CompaniesProvider } from "@/app/contexts/companies/Provider";
import { LocaleProvider } from "@/app/contexts/locale/Provider";
import { AccountScopedProviders } from "@/app/contexts/AccountScopedProviders";
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
                  <AccountScopedProviders>
                    <RouterProvider router={router} />
                  </AccountScopedProviders>
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
