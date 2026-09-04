import axios from "@/utils/axios";

/**
 * Cliente da API de Áreas e Cargos (backend ts/api, módulo `estrutura`).
 *
 * Área responde ONDE a pessoa está alocada; Cargo, QUAL POSIÇÃO profissional
 * ela ocupa. Nenhum dos dois concede permissão (isso é Role) nem define
 * hierarquia (isso é o Gestor direto do membro).
 *
 * As duas entidades têm exatamente a mesma forma: só a rota muda. Um tipo só
 * para as duas, e os aliases abaixo existem para o código de chamada continuar
 * legível sobre o que está manipulando.
 */

export type EstruturaStatus = "ativo" | "inativo";

export interface EstruturaItem {
  id: string;
  empresaId: string;
  nome: string;
  /** Só informativa: não afeta permissão, hierarquia nem acesso. */
  descricao: string | null;
  /**
   * `inativo` preserva registro e associações — só tira a entidade das
   * escolhas novas.
   */
  status: EstruturaStatus;
  /**
   * Quantos membros estão nesta área / neste cargo. Derivado no backend
   * (`_count`), nunca um campo de cadastro. Conta todos os status de membro.
   */
  membros: number;
  desativadoEm: string | null; // ISO
  criadoEm: string; // ISO
  atualizadoEm: string; // ISO
}

export type Area = EstruturaItem;
export type Cargo = EstruturaItem;

export interface CriarEstruturaInput {
  nome: string;
  descricao?: string;
}

export interface AtualizarEstruturaInput {
  nome?: string;
  /** String vazia limpa a descrição (convenção de área/cargo em membros). */
  descricao?: string;
  status?: EstruturaStatus;
}

export interface ListarEstruturaParams {
  status?: EstruturaStatus;
  q?: string;
}

// ---------------------------------------------------------------- Áreas

/** GET /empresa/areas → áreas do tenant, com a contagem de membros. */
export async function fetchAreasApi(
  params?: ListarEstruturaParams,
): Promise<Area[]> {
  const { data } = await axios.get<Area[]>("/empresa/areas", { params });
  return data;
}

/** POST /empresa/areas → cria a área. Exige `estrutura.gerenciar`. */
export async function criarAreaApi(input: CriarEstruturaInput): Promise<Area> {
  const { data } = await axios.post<Area>("/empresa/areas", input);
  return data;
}

/** PATCH /empresa/areas/:id → edita nome, descrição ou status. */
export async function atualizarAreaApi(
  id: string,
  input: AtualizarEstruturaInput,
): Promise<Area> {
  const { data } = await axios.patch<Area>(
    `/empresa/areas/${encodeURIComponent(id)}`,
    input,
  );
  return data;
}

/**
 * DELETE /empresa/areas/:id
 *
 * Só passa quando nenhum membro está na área. Com membros, a API recusa com
 * 409 e a contagem — a saída é desativar, que preserva os vínculos. Nunca há
 * exclusão em cascata.
 */
export async function removerAreaApi(id: string): Promise<void> {
  await axios.delete(`/empresa/areas/${encodeURIComponent(id)}`);
}

// --------------------------------------------------------------- Cargos

/** GET /empresa/cargos → cargos do tenant, com a contagem de membros. */
export async function fetchCargosApi(
  params?: ListarEstruturaParams,
): Promise<Cargo[]> {
  const { data } = await axios.get<Cargo[]>("/empresa/cargos", { params });
  return data;
}

/** POST /empresa/cargos → cria o cargo. Exige `estrutura.gerenciar`. */
export async function criarCargoApi(
  input: CriarEstruturaInput,
): Promise<Cargo> {
  const { data } = await axios.post<Cargo>("/empresa/cargos", input);
  return data;
}

/** PATCH /empresa/cargos/:id → edita nome, descrição ou status. */
export async function atualizarCargoApi(
  id: string,
  input: AtualizarEstruturaInput,
): Promise<Cargo> {
  const { data } = await axios.patch<Cargo>(
    `/empresa/cargos/${encodeURIComponent(id)}`,
    input,
  );
  return data;
}

/** DELETE /empresa/cargos/:id → só quando nenhum membro ocupa o cargo. */
export async function removerCargoApi(id: string): Promise<void> {
  await axios.delete(`/empresa/cargos/${encodeURIComponent(id)}`);
}
