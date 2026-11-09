// Import Dependencies
import { Navigate, useLocation, useOutlet } from "react-router";

// Local Imports
import {
  isPathHiddenByOracle,
  ORACLE_HOME_PATH,
} from "@/configs/oracleModules";

// ----------------------------------------------------------------------

/**
 * Guard dos módulos ocultos do Oracle (ver `configs/oracleModules.ts`).
 *
 * As rotas dos produtos de RH e das áreas corporativas continuam registradas e
 * as páginas intactas; este guard só impede que um link direto ou favorito
 * exponha o que a navegação esconde, mandando para a home do Oracle. Reativar
 * o módulo na configuração central reabre as rotas sem mais nada.
 *
 * `replace` pelo mesmo motivo do `LegacyFunnelGuard`: sem ele, o Voltar
 * devolveria o usuário à URL bloqueada.
 */
export default function OracleModuleGuard() {
  const outlet = useOutlet();
  const { pathname } = useLocation();

  if (isPathHiddenByOracle(pathname)) {
    return <Navigate to={ORACLE_HOME_PATH} replace />;
  }

  return <>{outlet}</>;
}
