// Import Dependencies
import { Navigate, useLocation, useOutlet } from "react-router";

// Local Imports
import { isLegacyFunnelPathTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";
import { GHOST_ENTRY_PATH, SIGNUP_ENTRY_PATH } from "@/constants/app";

// ----------------------------------------------------------------------

/**
 * Guard do funil legado de criação de conta (/cadastro, /calculadora,
 * /onboarding).
 *
 * As páginas continuam INTACTAS no código — parte delas será reaproveitada no
 * novo modelo de conta (a lógica PF/PJ do cadastro é a base da etapa de
 * pagador). Este guard apenas as torna inacessíveis, inclusive por deep link,
 * enquanto as flags `legacy*` de `temporarilyDisabledFeatures` estiverem `true`.
 *
 * A granularidade por rota sai de graça: zerar só `legacyPriceCalculator`
 * reabre `/calculadora` mantendo as outras duas bloqueadas.
 *
 * `replace` é obrigatório — sem ele, o botão Voltar devolve o usuário à URL
 * bloqueada e vira uma armadilha de redirect.
 */
export default function LegacyFunnelGuard() {
  const outlet = useOutlet();
  const { pathname } = useLocation();

  if (isLegacyFunnelPathTemporarilyDisabled(pathname)) {
    return <Navigate to={SIGNUP_ENTRY_PATH ?? GHOST_ENTRY_PATH} replace />;
  }

  return <>{outlet}</>;
}
