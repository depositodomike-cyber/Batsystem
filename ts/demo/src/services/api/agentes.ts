import axios from "@/utils/axios";
import { agenteSistemaVisivel } from "@/app/data/agentesVisiveis";

// Cliente dos agentes mencionáveis no Assistente (backend: /agentes).
// "Sistema" = o catálogo pré-programado (antigos squads, só leitura);
// "meus" = agentes personalizados do usuário (CRUD, só dele).

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

export interface AgentesDisponiveis {
  sistema: AgenteSistema[];
  meus: AgentePessoal[];
}

export interface SalvarAgenteInput {
  nome: string;
  mencao?: string;
  descricao?: string;
  instrucoes?: string;
  icone?: string | null;
}

export async function listarAgentesApi(): Promise<AgentesDisponiveis> {
  const { data } = await axios.get<AgentesDisponiveis>("/agentes");
  // Só os agentes do sistema liberados na interface (ver agentesVisiveis.ts).
  return {
    sistema: (data.sistema ?? []).filter((a) => agenteSistemaVisivel(a.id)),
    meus: data.meus ?? [],
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
