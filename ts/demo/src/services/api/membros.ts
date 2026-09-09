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
 * Que ESPÉCIE de vínculo a pessoa tem com a organização.
 *
 * Eixo independente de `MembroStatus`, que diz em que ponto do onboarding ela
 * está: existe convidado ativo, convidado com convite pendente e convidado
 * inativo. Não confundir também com `temConta` — "convidado" ali era adjetivo
 * para quem ainda não entrou, e não tem relação com este campo.
 */
export type MembroTipo = "membro" | "convidado";

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
  /**
   * Membro da organização ou convidado externo.
   *
   * Um convidado não entra no organograma, não tem área, cargo, gestor direto
   * nem gestores indiretos, não pode ser gestor de ninguém, e carrega
   * exclusivamente a role Convidado. Todos esses campos vêm nulos ou vazios
   * por invariante do backend — a interface não precisa (nem deve) fingir isso
   * por conta própria.
   */
  tipo: MembroTipo;
  /**
   * Conta de login vinculada. null = ainda não concluiu o acesso.
   *
   * NÃO tem relação com `tipo`: a redação anterior dizia "convidado que ainda
   * não tem conta", usando "convidado" como adjetivo para quem foi convidado e
   * não entrou. Desde que `tipo` existe, essa leitura confunde dois conceitos
   * distintos — um convidado pode ter conta, e um membro pode não ter.
   */
  usuarioId: string | null;
  /** Trava a edição de e-mail e esconde "Cancelar convite". */
  temConta: boolean;
  /**
   * Gestor direto. null = topo da estrutura (ou ainda não configurado).
   * É a única relação hierárquica ESTRUTURAL: equipe direta e árvore são
   * derivadas dela no cliente (ver hierarquia-membros.ts).
   */
  gestorId: string | null;
  gestor: GestorResumo | null;
  /**
   * Gestores indiretos: as outras lideranças que acompanham este membro.
   *
   * A segunda relação de gestão, e a diferença em relação a `gestorId` é o
   * ponto: MÚLTIPLA, DIRECIONAL e sem participação na árvore. Ela não define
   * posição, então `montarHierarquia` a ignora e cada membro continua com um
   * único nó no organograma — as relações indiretas entram lá como conexões
   * entre nós que já existem (ver organograma-conexoes.ts).
   *
   * Direcional: aparecer aqui não cria o vínculo inverso. Se Amanda é gestora
   * indireta de Michael, Michael não é nada de Amanda até que alguém cadastre
   * a relação oposta.
   *
   * Não concede nada — nem acesso a dados, nem permissão, nem role, nem
   * participação em equipe para autorização. `permissoesEfetivas` sai só das
   * roles.
   *
   * Ordem alfabética e estável, sem prioridade entre eles:
   * `gestorIndiretoIds[i]` e `gestoresIndiretos[i]` são a mesma pessoa.
   * Lista vazia é o estado normal e o de todo membro anterior a esta versão.
   */
  gestorIndiretoIds: string[];
  gestoresIndiretos: GestorResumo[];
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
  /**
   * Tipo de vínculo. Omitido = `membro`, que é o fluxo de sempre.
   *
   * Ao ENVIAR `convidado`, mande também os campos estruturais como string
   * vazia (`areaId`, `cargoId`, `gestorId`) e `gestorIndiretoIds: []` — num
   * PATCH, omitir significa "não mexe", e a pessoa continuaria com gestor no
   * banco, aparecendo como gestor de outra. Ver `dadosDoFormulario`.
   *
   * NÃO mande `roleIds` com a role Convidado: ela é consequência do tipo e
   * quem atribui é o backend. Mandá-la criaria duas fontes de verdade.
   */
  tipo?: MembroTipo;
  /** Id de outro membro. String vazia limpa a relação (convenção de área/cargo). */
  gestorId?: string;
  /**
   * Gestores indiretos: ids de outros membros, até cinco, sem ordem nem
   * prioridade. Lista vazia ou omitida = nenhum, que é estado válido.
   *
   * O gestor DIRETO não pode estar aqui. Quando os dois campos vêm no mesmo
   * PATCH e o gestor direto MUDOU, o backend subtrai o repetido em silêncio
   * (a relação direta é a de maior relevância); quando o gestor direto não
   * mudou, ele recusa com 409. A tela previne o caso removendo o gestor direto
   * das opções.
   */
  gestorIndiretoIds?: string[];
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
