import axios from "@/utils/axios";

/**
 * Cliente da API de membros da organização (backend ts/api, módulo `membros`).
 *
 * O JWT e o header de repositório são injetados pelo interceptor de
 * `utils/axios.ts`. Os tipos vivem aqui, como nos outros serviços de
 * `services/api/*` — não há pasta de tipos separada no projeto.
 */

export type MembroStatus = "ativo" | "convite_pendente" | "inativo";

/**
 * Área/Cargo embutidos na resposta, só para exibição.
 *
 * `status` atravessa porque a UI precisa distinguir uma associação a algo
 * INATIVO — que continua válida e tem de aparecer — de uma opção nova.
 */
export interface EstruturaRef {
  id: string;
  nome: string;
  status: "ativo" | "inativo";
}

/** Role embutida na resposta do membro, com as permissões herdadas. */
export interface RoleResumo {
  id: string;
  nome: string;
  tipo: "sistema" | "personalizada";
  permissoes: string[];
}

/** Resumo do gestor embutido na resposta, só para exibição. */
export interface GestorResumo {
  id: string;
  nome: string;
  /** @deprecated Código legado; use `cargoRef`/`areaRef` via `rotuloCargo`. */
  cargo: string | null;
  /** @deprecated Código legado; use `areaRef` via `rotuloArea`. */
  area: string | null;
  areaRef: EstruturaRef | null;
  cargoRef: EstruturaRef | null;
  /** A UI sinaliza gestor inativo sem desfazer a relação. */
  status: MembroStatus;
}

export interface Membro {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  /**
   * @deprecated Código do catálogo estático que existia em `@/app/data/areas`.
   * Congelado: o backend não escreve mais. Continua vindo na resposta como
   * fallback de exibição de quem foi cadastrado antes de Áreas virarem
   * entidades — sempre leia via `rotuloArea()`, nunca direto.
   */
  area: string | null;
  /** @deprecated Como `area`; leia via `rotuloCargo()`. */
  cargo: string | null;
  /**
   * Área da organização. null = sem área, estado válido.
   * Responde ONDE a pessoa está alocada. Não concede permissão (isso é a role)
   * nem define hierarquia (isso é o gestor direto).
   */
  areaId: string | null;
  areaRef: EstruturaRef | null;
  /**
   * Cargo da organização. null = sem cargo, estado válido.
   * Responde QUAL POSIÇÃO profissional a pessoa ocupa. Dois membros com o mesmo
   * cargo podem ter relação hierárquica entre si: cargo não é hierarquia.
   */
  cargoId: string | null;
  cargoRef: EstruturaRef | null;
  status: MembroStatus;
  /** Conta de login vinculada. null = convidado que ainda não tem conta. */
  usuarioId: string | null;
  /** Trava a edição de e-mail e esconde "Cancelar convite". */
  temConta: boolean;
  /**
   * Gestor direto. null = topo da estrutura (ou ainda não configurado).
   * É a ÚNICA relação hierárquica persistida: equipe direta e árvore são
   * derivadas dela no cliente (ver hierarquia-membros.ts).
   */
  gestorId: string | null;
  gestor: GestorResumo | null;
  /**
   * As roles do membro: de zero a duas. Nenhuma prevalece sobre a outra, e a
   * ordem é alfabética e estável — `roleIds[i]` e `roles[i]` são a mesma role.
   * Independentes de cargo, área e gestor: nenhum deles sugere role.
   */
  roleIds: string[];
  roles: RoleResumo[];
  /**
   * O que o membro PODE FAZER: a UNIÃO das permissões de todas as roles dele,
   * calculada pelo backend. É o mesmo conjunto que a autorização aplica.
   *
   * Renderize este campo em vez de recalcular a união no cliente: o backend
   * normaliza (descarta código que saiu do catálogo, reinstala dependências), e
   * um `Set` aqui daria um número diferente do que o guard enxerga.
   */
  permissoesEfetivas: string[];
  /** @deprecated Compatibilidade: o id só quando há UMA role. Use `roleIds`. */
  roleId: string | null;
  /** @deprecated Compatibilidade, como `roleId`. Use `roles`. */
  role: RoleResumo | null;
  convidadoEm: string | null; // ISO
  desativadoEm: string | null; // ISO
  criadoEm: string; // ISO
  atualizadoEm: string; // ISO
}

export interface CriarMembroInput {
  nome: string;
  email: string;
  /** Id de uma Área da organização. String vazia limpa a relação. */
  areaId?: string;
  /** Id de um Cargo da organização. String vazia limpa a relação. */
  cargoId?: string;
  /** Omitido = `convite_pendente`, que é o fluxo da tela de adicionar. */
  status?: MembroStatus;
  /** Id de outro membro. String vazia limpa a relação (convenção de área/cargo). */
  gestorId?: string;
  /**
   * Roles do membro: até duas, sem prioridade entre elas. Lista vazia ou
   * omitida = sem role, que é estado válido. A mesma role não entra duas vezes.
   */
  roleIds?: string[];
}

export type AtualizarMembroInput = Partial<CriarMembroInput> & {
  /**
   * Nova liderança dos liderados diretos. Obrigatória quando o PATCH desativa
   * um membro que lidera alguém — desativar também é sair da estrutura, e a
   * equipe não pode ficar sem gestor. Ignorada nas outras edições.
   */
  reatribuirLiderados?: string;
};

/** GET /empresa/membros → membros do tenant logado. */
export async function fetchMembrosApi(params?: {
  status?: MembroStatus;
  q?: string;
}): Promise<Membro[]> {
  const { data } = await axios.get<Membro[]>("/empresa/membros", { params });
  return data;
}

/** POST /empresa/membros → cria o membro. Só admin/owner. */
export async function criarMembroApi(input: CriarMembroInput): Promise<Membro> {
  const { data } = await axios.post<Membro>("/empresa/membros", input);
  return data;
}

/** PATCH /empresa/membros/:id → edita o membro. Só admin/owner. */
export async function atualizarMembroApi(
  id: string,
  input: AtualizarMembroInput,
): Promise<Membro> {
  const { data } = await axios.patch<Membro>(
    `/empresa/membros/${encodeURIComponent(id)}`,
    input,
  );
  return data;
}

/**
 * DELETE /empresa/membros/:id → cancela um convite (membro sem conta).
 *
 * `reatribuirLiderados` é obrigatório quando o membro lidera alguém: o id de
 * quem assume os liderados diretos. Sem isso a API recusa com 409 e a
 * contagem — a equipe nunca fica sem gestor em silêncio.
 */
export async function removerMembroApi(
  id: string,
  reatribuirLiderados?: string,
): Promise<void> {
  await axios.delete(`/empresa/membros/${encodeURIComponent(id)}`, {
    params: reatribuirLiderados ? { reatribuirLiderados } : undefined,
  });
}
