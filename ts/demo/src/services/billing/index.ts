import { mockBilling } from "./mockBilling";
import type { BillingService } from "./types";

/**
 * Instância ativa da camada de cobrança.
 *
 * Fase 1 (demo): `mockBilling` — pagamento simulado em localStorage.
 * Fase 2: trocar por `iuguBilling` (mesma interface `BillingService`).
 * O resto do app importa SEMPRE daqui, nunca da implementação concreta.
 */
export const billing: BillingService = mockBilling;

export * from "./types";
