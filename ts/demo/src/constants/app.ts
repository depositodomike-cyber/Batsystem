export const APP_NAME = "beculture";
export const APP_KEY = "beculture";

// Redirect Paths
export const REDIRECT_URL_KEY = "redirect";
export const HOME_PATH = "/";
export const GHOST_ENTRY_PATH = "/login";

/**
 * Entrada pública do fluxo de criação de conta.
 *
 * Aponta para o protótipo do novo modelo de contas enquanto o funil legado está
 * oculto (flags `legacy*` em `@/app/data/temporarilyDisabledFeatures`). É usada
 * tanto pelo link "Criar conta" do login quanto pelo destino do
 * `LegacyFunnelGuard`, então retomar o funil antigo é: apontar isto para
 * "/cadastro" e zerar a flag `legacySignup`.
 *
 * `null` = nenhum fluxo disponível — o link fica opaco e os deep links do funil
 * antigo caem no login. A anotação de tipo explícita é necessária para o TS não
 * estreitar para `null` e rejeitar o `??` nos consumidores.
 */
export const SIGNUP_ENTRY_PATH: string | null =
  "/prototypes/contas/criar-conta";

// Navigation Types
export type NavigationType = "root" | "group" | "collapse" | "item" | "divider";

export const COLORS = [
  "neutral",
  "primary",
  "secondary",
  "info",
  "success",
  "warning",
  "error",
] as const;

export type ColorType = (typeof COLORS)[number];
