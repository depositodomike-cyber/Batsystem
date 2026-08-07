/**
 * Rota-host do protótipo de contas / workspaces / contextos.
 *
 * O estado vive em `PrototipoContasProvider` na raiz da app (`App.tsx`), para
 * o menu de perfil da BeCulture listar as mesmas organizações após o login.
 */

import { Outlet } from "react-router";

export default function PrototipoContas() {
  return <Outlet />;
}
