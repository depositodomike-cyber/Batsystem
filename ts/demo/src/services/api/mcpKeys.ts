import axios from "@/utils/axios";

// API keys do servidor MCP da empresa (ts/api, módulo src/mcp).
// A chave crua só aparece na resposta da criação — depois disso o
// servidor conhece apenas o hash.

export interface McpKey {
  id: string;
  nome: string;
  last4: string;
  criadoEm: string;
  lastUsedAt: string | null;
}

/** Criação devolve a chave crua (`key`) uma única vez. */
export interface CreatedMcpKey extends McpKey {
  key: string;
}

export async function listMcpKeysApi(): Promise<McpKey[]> {
  const { data } = await axios.get<McpKey[]>("/mcp/keys");
  return data;
}

export async function createMcpKeyApi(nome: string): Promise<CreatedMcpKey> {
  const { data } = await axios.post<CreatedMcpKey>("/mcp/keys", { nome });
  return data;
}

export async function revokeMcpKeyApi(id: string): Promise<void> {
  await axios.delete(`/mcp/keys/${encodeURIComponent(id)}`);
}
