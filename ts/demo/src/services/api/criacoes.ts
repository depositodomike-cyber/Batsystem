import axios from "@/utils/axios";

// Criações do AI Studio — o workspace privado de cada pessoa, contra o ts/api:
//  GET    /criacoes       → a lista da Home (só metadados)
//  GET    /criacoes/:id   → a criação inteira, para retomar
//  POST   /criacoes       → nasce quando há trabalho relevante
//  PATCH  /criacoes/:id   → autosave e renomear
//  DELETE /criacoes/:id   → exclui só a criação privada
//
// O proprietário NUNCA viaja no corpo: o servidor o lê do token. É por isso que
// nenhuma função daqui recebe um id de usuário.

/** Geradores que persistem trabalho hoje. */
export type CriacaoTipo = "apresentacao" | "planilha";

export type CriacaoStatus =
  | "rascunho"
  | "planejando"
  | "plano_pronto"
  | "gerando"
  | "concluido"
  | "erro";

/** O que a tabela da Home desenha. Sem `dados`: ver `CriacaoCompleta`. */
export interface CriacaoResumo {
  id: string;
  tipo: CriacaoTipo;
  status: CriacaoStatus;
  /** Onde retomar. Estado de navegação — não aparece na tabela. */
  etapa: string;
  /** Vazio até a IA sugerir um título; a tela mostra o fallback. */
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * A criação com o documento inteiro.
 *
 * `dados` é o que cada gerador guardou — briefing, configuração, fontes, guia
 * de marca, plano, ajustes e conteúdo final. A forma é de quem escreveu, e por
 * isso o tipo aqui é aberto: a tela que retoma sabe ler o seu.
 */
export interface CriacaoCompleta extends CriacaoResumo {
  repositorioId: string | null;
  dados: Record<string, unknown>;
}

export interface ListarCriacoesParams {
  q?: string;
  tipo?: CriacaoTipo;
  status?: CriacaoStatus;
  limit?: number;
  /** Id da última criação da página anterior. */
  cursor?: string;
}

export interface PaginaDeCriacoes {
  itens: CriacaoResumo[];
  /** `null` = última página. */
  proximoCursor: string | null;
}

/** GET /criacoes — sempre só as do usuário autenticado. */
export async function listarCriacoesApi(
  params: ListarCriacoesParams = {},
): Promise<PaginaDeCriacoes> {
  const { data } = await axios.get<PaginaDeCriacoes>("/criacoes", {
    // `undefined` não vira query string — é o que mantém "Todos" sem filtro.
    params: {
      q: params.q?.trim() || undefined,
      tipo: params.tipo || undefined,
      status: params.status || undefined,
      limit: params.limit || undefined,
      cursor: params.cursor || undefined,
    },
  });
  return data;
}

/** GET /criacoes/:id — 404 quando a criação é de outra pessoa. */
export async function obterCriacaoApi(id: string): Promise<CriacaoCompleta> {
  const { data } = await axios.get<CriacaoCompleta>(`/criacoes/${id}`);
  return data;
}

export async function criarCriacaoApi(entrada: {
  tipo: CriacaoTipo;
  titulo?: string;
  status?: CriacaoStatus;
  etapa?: string;
  dados?: Record<string, unknown>;
}): Promise<CriacaoCompleta> {
  const { data } = await axios.post<CriacaoCompleta>("/criacoes", entrada);
  return data;
}

/** PATCH /criacoes/:id — manda só o que mudou; o resto fica como está. */
export async function salvarCriacaoApi(
  id: string,
  entrada: {
    titulo?: string;
    status?: CriacaoStatus;
    etapa?: string;
    dados?: Record<string, unknown>;
  },
): Promise<CriacaoCompleta> {
  const { data } = await axios.patch<CriacaoCompleta>(
    `/criacoes/${id}`,
    entrada,
  );
  return data;
}

export async function excluirCriacaoApi(id: string): Promise<void> {
  await axios.delete(`/criacoes/${id}`);
}
