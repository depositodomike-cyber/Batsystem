/**
 * Flags de desabilitação temporária de funcionalidades do produto.
 *
 * IMPORTANTE: as features NÃO são removidas do código — só ficam
 * inacessíveis na UI (visíveis, opacas, sem clique). Para reativar,
 * altere a flag correspondente para `false`.
 *
 * Padrão visual: `cursor-not-allowed opacity-40`.
 */

export type TemporarilyDisabledFeature =
  | "aiStudio"
  | "squads"
  | "groups"
  | "history"
  | "insights"
  | "notes"
  | "email"
  | "slack"
  | "calendar"
  | "connectors"
  | "notifications"
  | "settingsAppearance"
  | "settingsVoice"
  | "settingsMemory"
  | "memoryUploadAudio"
  | "memoryUploadTranscript";

export const TEMPORARILY_DISABLED: Record<
  TemporarilyDisabledFeature,
  boolean
> = {
  aiStudio: true,
  squads: true,
  groups: true,
  history: true,
  insights: true,
  notes: true,
  email: true,
  slack: true,
  calendar: true,
  connectors: true,
  notifications: true,
  settingsAppearance: true,
  settingsVoice: true,
  settingsMemory: true,
  memoryUploadAudio: true,
  memoryUploadTranscript: true,
};

/** Classe Tailwind do estado desabilitado (padrão do produto). */
export const DISABLED_MENU_CLASS = "cursor-not-allowed opacity-40";

export function isFeatureTemporarilyDisabled(
  feature: TemporarilyDisabledFeature,
): boolean {
  return TEMPORARILY_DISABLED[feature];
}

/**
 * Resolve se um item de navegação (ceoOs) está temporariamente desabilitado,
 * a partir do `id` (ex.: "behuman.insights") ou do último segmento do `path`.
 */
export function isNavItemTemporarilyDisabled(
  id: string,
  path?: string,
): boolean {
  const bySuffix: Record<string, TemporarilyDisabledFeature> = {
    insights: "insights",
    notas: "notes",
    email: "email",
    slack: "slack",
    agenda: "calendar",
    "upload-audio": "memoryUploadAudio",
    "upload-transcricao": "memoryUploadTranscript",
  };

  const suffix = id.split(".").pop() ?? "";
  const fromId = bySuffix[suffix];
  if (fromId && TEMPORARILY_DISABLED[fromId]) return true;

  if (path) {
    const seg = path.split("/").filter(Boolean).pop()?.split("?")[0] ?? "";
    const fromPath = bySuffix[seg];
    if (fromPath && TEMPORARILY_DISABLED[fromPath]) return true;

    // Deep links /ia?fn=audio|transcricao (uploads sob Memória).
    if (
      /[?&]fn=audio(?:&|$)/.test(path) &&
      TEMPORARILY_DISABLED.memoryUploadAudio
    ) {
      return true;
    }
    if (
      /[?&]fn=transcricao(?:&|$)/.test(path) &&
      TEMPORARILY_DISABLED.memoryUploadTranscript
    ) {
      return true;
    }
  }

  return false;
}

/** Bloqueia abertura de modal de upload da Memória via `?fn=`. */
export function isMemoryUploadFnTemporarilyDisabled(fnId: string): boolean {
  if (fnId === "audio") return TEMPORARILY_DISABLED.memoryUploadAudio;
  if (fnId === "transcricao")
    return TEMPORARILY_DISABLED.memoryUploadTranscript;
  return false;
}
