import axios from "@/utils/axios";

// Prompt "Pergunte ao seu Repositório" — chama o backend ts/api (POST /ai/prompt),
// portado do beculture/Confi. Três modos: Memória (vault), Web e Auto.

export type ModoBusca = "vault" | "web" | "auto";

/** Fonte da resposta: título de item do Repositório, ou página web citada. */
export type Fonte = string | { titulo: string; url: string };

export interface HistoricoTurno {
  pergunta: string;
  resposta: string;
}

/** Agente (o antigo "squad") que produziu uma resposta. */
export interface AgenteDaResposta {
  id: string;
  titulo: string;
}

/** Agente @mencionado numa pergunta (vai no `meta` da mensagem do usuário). */
export interface MencaoAgente {
  id: string;
  titulo: string;
  /** Sem o "@". */
  mencao: string;
}

/**
 * Arquivo gerado por um agente numa conversa. Pertence à CONVERSA (vive no
 * `meta` da mensagem) e só entra no Repositório se o usuário salvar.
 */
export interface ArquivoConversa {
  id: string;
  nome: string;
  tipo: "md";
  conteudo: string;
  tamanho: number;
  /** Id do documento no Repositório da organização, depois de salvo. */
  repositorioDocumentoId?: string | null;
  /** Agente que gerou o arquivo. */
  geradoPor?: AgenteDaResposta | null;
}

export interface PromptResposta {
  tipo: "resposta";
  resposta: string;
  fontes: Fonte[];
  origem: "vault" | "web";
  conversaId?: string;
  /** Mensagem da resposta — para marcar um arquivo dela como salvo. */
  mensagemId?: string;
  /** Agente que respondeu; null/ausente = Assistente padrão. */
  agente?: AgenteDaResposta | null;
  arquivos?: ArquivoConversa[];
}

export interface PromptParams {
  texto: string;
  modo: ModoBusca;
  /** Anexo de texto (ignorado no modo Web, igual ao Confi). */
  arquivo?: File | null;
  /** Notas/Insights/To-do's coletados no cliente para cruzamento. */
  referencia?: string;
  /** Turnos anteriores (continuação de conversa). */
  historico?: HistoricoTurno[];
  /** Conversa persistida a continuar. */
  conversaId?: string;
  /** Repositório ativo — a conversa fica isolada neste contexto. */
  repositorioId?: string;
  /** Agente que participa deste turno (ausente = Assistente padrão). */
  agenteId?: string | null;
  /** Agentes @mencionados na pergunta (gravados com a mensagem do usuário). */
  mencoes?: MencaoAgente[];
  /**
   * Mais um agente respondendo à MESMA pergunta (vários @mencionados): o
   * servidor grava só a resposta, sem repetir a mensagem do usuário.
   */
  respostaAdicional?: boolean;
}

export async function perguntarPromptApi(p: PromptParams): Promise<PromptResposta> {
  const usarAnexo = !!p.arquivo && p.modo !== "web";

  if (usarAnexo) {
    const fd = new FormData();
    fd.append("texto", p.texto);
    fd.append("modo", p.modo);
    if (p.arquivo) fd.append("arquivo", p.arquivo);
    if (p.referencia) fd.append("referencia", p.referencia);
    if (p.historico?.length) fd.append("historico", JSON.stringify(p.historico));
    if (p.conversaId) fd.append("conversaId", p.conversaId);
    if (p.repositorioId) fd.append("repositorioId", p.repositorioId);
    if (p.agenteId) fd.append("agenteId", p.agenteId);
    if (p.mencoes?.length) fd.append("mencoes", JSON.stringify(p.mencoes));
    if (p.respostaAdicional) fd.append("respostaAdicional", "1");
    const { data } = await axios.post<PromptResposta>("/ai/prompt", fd);
    return data;
  }

  const { data } = await axios.post<PromptResposta>("/ai/prompt", {
    texto: p.texto,
    modo: p.modo,
    ...(p.referencia ? { referencia: p.referencia } : {}),
    ...(p.historico?.length ? { historico: JSON.stringify(p.historico) } : {}),
    ...(p.conversaId ? { conversaId: p.conversaId } : {}),
    ...(p.repositorioId ? { repositorioId: p.repositorioId } : {}),
    ...(p.agenteId ? { agenteId: p.agenteId } : {}),
    ...(p.mencoes?.length ? { mencoes: JSON.stringify(p.mencoes) } : {}),
    ...(p.respostaAdicional ? { respostaAdicional: "1" } : {}),
  });
  return data;
}

/** Rótulo humano de uma fonte (para o chip). */
export function fonteLabel(f: Fonte): string {
  return typeof f === "string" ? f : f.titulo || f.url;
}

/** URL de uma fonte web (null para fontes do Repositório). */
export function fonteUrl(f: Fonte): string | null {
  return typeof f === "string" ? null : f.url || null;
}
