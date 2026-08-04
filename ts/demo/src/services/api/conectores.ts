import axios from "@/utils/axios";

// Estado dos conectores no backend (ts/api, módulo src/conectores).
// O catálogo continua estático no front (src/app/data/conectores.ts);
// daqui só consumimos o ESTADO de conexão por empresa — o mesmo lido e
// alterado pelo servidor MCP (/mcp).

export interface ConectorStatus {
  id: string;
  connected: boolean;
  connectedAt: string | null;
  /** Conta/workspace autorizada via OAuth (ex.: nome do time Slack). */
  workspace: string | null;
  /** True quando há credenciais OAuth reais (não só o toggle de estado). */
  hasCredentials: boolean;
}

/** Estado de conexão de todos os conectores da empresa. */
export async function fetchConectoresApi(): Promise<ConectorStatus[]> {
  const { data } = await axios.get<ConectorStatus[]>("/conectores");
  return data;
}

/** Ativa um conector (idempotente). */
export async function connectConectorApi(id: string): Promise<void> {
  await axios.post(`/conectores/${encodeURIComponent(id)}/conectar`);
}

/** Desativa um conector (idempotente). */
export async function disconnectConectorApi(id: string): Promise<void> {
  await axios.delete(`/conectores/${encodeURIComponent(id)}`);
}

// Conectores com OAuth real: cada um tem sua família de rotas no backend
// (`/conectores/<familia>/<provedor>/...`).
const OAUTH_BASE: Record<string, string> = {
  slack: "/conectores/slack",
  gmail: "/conectores/email/gmail",
  outlook: "/conectores/email/outlook",
  "google-calendar": "/conectores/agenda/google-calendar",
};

/**
 * URL de autorização OAuth do conector — o navegador deve ser redirecionado
 * para ela. Falha com 503 se o servidor não tem as credenciais do provedor
 * (SLACK_*, GOOGLE_*, MICROSOFT_*).
 */
export async function getOauthAuthorizeUrlApi(
  connectorId: string,
): Promise<string> {
  const base = OAUTH_BASE[connectorId];
  if (!base) {
    throw new Error(`Conector "${connectorId}" não tem fluxo OAuth.`);
  }
  const { data } = await axios.get<{ url: string }>(`${base}/autorizar`);
  return data.url;
}

// Conectores que sabem confirmar a conta autorizada contra a API do provedor
// (o Slack não expõe essa rota).
const CONTA_SUPORTADA = ["gmail", "outlook", "google-calendar"];

/** True quando o conector oferece o botão "Testar conexão". */
export function suportaTesteDeConexao(connectorId: string): boolean {
  return CONTA_SUPORTADA.includes(connectorId);
}

/**
 * Confirma a conexão contra a API do provedor (renovando o token se preciso)
 * e devolve a conta autorizada.
 */
export async function checkContaConectorApi(
  connectorId: string,
): Promise<string> {
  const base = OAUTH_BASE[connectorId];
  if (!base || !suportaTesteDeConexao(connectorId)) {
    throw new Error(`Conector "${connectorId}" não confirma a conta.`);
  }
  const { data } = await axios.get<{ conta: string }>(`${base}/conta`);
  return data.conta;
}
