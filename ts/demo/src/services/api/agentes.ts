import axios, { HEADER_ORGANIZACAO } from "@/utils/axios";
import { agenteSistemaVisivel } from "@/app/data/agentesVisiveis";

// Cliente dos agentes mencionáveis no Assistente (backend: /agentes).
// "Sistema" = o catálogo pré-programado (antigos squads, só leitura);
// "meus" = agentes personalizados do usuário (CRUD, só dele);
// "organizacao" = agentes da organização ativa (CRUD, todos dela veem).
//
// O dono (organização) vai no header X-Organizacao-Id explícito quando quem
// chama o tem — mesmo motivo de services/api/repositorioOrg.ts: o valor do
// interceptor só é gravado depois do primeiro render.

export interface AgenteSistema {
  id: string;
  titulo: string;
  /** Identificador depois do "@" (ex.: "Cultura", "GestãoDePessoas"). */
  mencao: string;
  /** Chave do ícone em `navigationIcons`. */
  icone: string | null;
  descricao: string;
}

export interface AgentePessoal {
  id: string;
  titulo: string;
  mencao: string;
  descricao: string;
  instrucoes: string;
  /** Ícone do avatar ("agente:…"); null = iniciais. */
  icone: string | null;
  /** ISO. */
  atualizadoEm: string;
}

/** Agente da organização: mesma forma do pessoal, outro dono. */
export type AgenteOrganizacao = AgentePessoal;

export interface AgentesDisponiveis {
  sistema: AgenteSistema[];
  meus: AgentePessoal[];
  organizacao: AgenteOrganizacao[];
}

function comDono(dono: string | null | undefined) {
  return dono ? { headers: { [HEADER_ORGANIZACAO]: dono } } : undefined;
}

export interface SalvarAgenteInput {
  nome: string;
  mencao?: string;
  descricao?: string;
  instrucoes?: string;
  icone?: string | null;
}

export async function listarAgentesApi(
  dono?: string | null,
): Promise<AgentesDisponiveis> {
  const { data } = await axios.get<AgentesDisponiveis>(
    "/agentes",
    comDono(dono),
  );
  // Só os agentes do sistema liberados na interface (ver agentesVisiveis.ts).
  return {
    sistema: (data.sistema ?? []).filter((a) => agenteSistemaVisivel(a.id)),
    meus: data.meus ?? [],
    organizacao: data.organizacao ?? [],
  };
}

export async function criarAgenteApi(
  input: SalvarAgenteInput,
): Promise<AgentePessoal> {
  const { data } = await axios.post<AgentePessoal>("/agentes", input);
  return data;
}

export async function atualizarAgenteApi(
  id: string,
  input: SalvarAgenteInput,
): Promise<AgentePessoal> {
  const { data } = await axios.patch<AgentePessoal>(
    `/agentes/${encodeURIComponent(id)}`,
    input,
  );
  return data;
}

export async function excluirAgenteApi(id: string): Promise<void> {
  await axios.delete(`/agentes/${encodeURIComponent(id)}`);
}

// Agentes da organização ------------------------------------------------

export async function criarAgenteOrganizacaoApi(
  dono: string,
  input: SalvarAgenteInput,
): Promise<AgenteOrganizacao> {
  const { data } = await axios.post<AgenteOrganizacao>(
    "/agentes/organizacao",
    input,
    comDono(dono),
  );
  return data;
}

export async function atualizarAgenteOrganizacaoApi(
  dono: string,
  id: string,
  input: SalvarAgenteInput,
): Promise<AgenteOrganizacao> {
  const { data } = await axios.patch<AgenteOrganizacao>(
    `/agentes/organizacao/${encodeURIComponent(id)}`,
    input,
    comDono(dono),
  );
  return data;
}

/**
 * Edita um agente do SISTEMA só na organização: o servidor cria a versão
 * própria dela, que passa a vir em `organizacao` no lugar do original.
 */
export async function editarAgenteSistemaOrganizacaoApi(
  dono: string,
  sistemaId: string,
  input: SalvarAgenteInput,
): Promise<AgenteOrganizacao> {
  const { data } = await axios.patch<AgenteOrganizacao>(
    `/agentes/organizacao/sistema/${encodeURIComponent(sistemaId)}`,
    input,
    comDono(dono),
  );
  return data;
}

/** Tira um agente do SISTEMA da organização (as outras não são afetadas). */
export async function excluirAgenteSistemaOrganizacaoApi(
  dono: string,
  sistemaId: string,
): Promise<void> {
  await axios.delete(
    `/agentes/organizacao/sistema/${encodeURIComponent(sistemaId)}`,
    comDono(dono),
  );
}

export async function excluirAgenteOrganizacaoApi(
  dono: string,
  id: string,
): Promise<void> {
  await axios.delete(
    `/agentes/organizacao/${encodeURIComponent(id)}`,
    comDono(dono),
  );
}

// ----------------------------------------------------------------------
// Menções — as mesmas regras do backend (ts/api/src/agentes/mencao.ts).

/** "Revisor de UX" → "RevisorDeUX" (PascalCase, sem espaços, com acentos). */
export function mencaoDe(nome: string): string {
  return nome
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((p) =>
      p === p.toUpperCase() && p.length > 1
        ? p
        : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join("")
    .slice(0, 40);
}

/** Forma de comparação: sem "@", sem acento e sem caixa. */
export function chaveMencao(mencao: string): string {
  return mencao
    .replace(/^@/, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}
