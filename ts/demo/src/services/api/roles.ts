import axios from "@/utils/axios";

/**
 * Cliente da API de roles e permissões (backend ts/api, módulo `acesso`).
 *
 * Uma role responde "o que o membro PODE FAZER". Sobre quais dados é escopo de
 * acesso, que ainda não existe.
 */

export type RoleTipo = "sistema" | "personalizada";

export interface Role {
  id: string;
  empresaId: string;
  nome: string;
  descricao: string | null;
  tipo: RoleTipo;
  /** Chave estável das roles de sistema (admin|editor|viewer); null nas outras. */
  codigo: string | null;
  /** Códigos do catálogo, já normalizados pelo backend. */
  permissoes: string[];
  /** Quantos membros usam esta role — deriva o aviso de impacto e a exclusão. */
  membros: number;
  /** Role de sistema é imutável: não pode ser editada nem excluída. */
  editavel: boolean;
  criadoEm: string; // ISO
  atualizadoEm: string; // ISO
}

export interface CriarRoleInput {
  nome: string;
  descricao?: string;
  permissoes: string[];
}

export type AtualizarRoleInput = Partial<CriarRoleInput>;

/** GET /empresa/roles → roles do tenant. Cria as de sistema na primeira vez. */
export async function fetchRolesApi(): Promise<Role[]> {
  const { data } = await axios.get<Role[]>("/empresa/roles");
  return data;
}

/** POST /empresa/roles → cria role personalizada. Exige `acesso.gerenciar`. */
export async function criarRoleApi(input: CriarRoleInput): Promise<Role> {
  const { data } = await axios.post<Role>("/empresa/roles", input);
  return data;
}

/** PATCH /empresa/roles/:id → edita nome/descrição/permissões. */
export async function atualizarRoleApi(
  id: string,
  input: AtualizarRoleInput,
): Promise<Role> {
  const { data } = await axios.patch<Role>(
    `/empresa/roles/${encodeURIComponent(id)}`,
    input,
  );
  return data;
}

/**
 * DELETE /empresa/roles/:id
 *
 * `reatribuirPara` é obrigatório quando a role tem membros: o id de outra role
 * ou `"nenhuma"` para deixá-los sem role. Sem isso a API recusa com 409 e a
 * contagem — nunca exclui em silêncio.
 */
export async function removerRoleApi(
  id: string,
  reatribuirPara?: string,
): Promise<void> {
  await axios.delete(`/empresa/roles/${encodeURIComponent(id)}`, {
    params: reatribuirPara ? { reatribuirPara } : undefined,
  });
}

export interface MinhasPermissoes {
  permissoes: string[];
  /** Owner/admin da conta passam por cima das permissões (bypass legado). */
  administradorDaConta: boolean;
}

/** GET /empresa/roles/minhas-permissoes → o que o usuário logado pode fazer. */
export async function fetchMinhasPermissoesApi(): Promise<MinhasPermissoes> {
  const { data } = await axios.get<MinhasPermissoes>(
    "/empresa/roles/minhas-permissoes",
  );
  return data;
}
