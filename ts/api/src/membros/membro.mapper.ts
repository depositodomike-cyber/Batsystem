import type { Area, Cargo, Membro, Role } from '@prisma/client';
import { normalizarPermissoes } from '@/acesso/permissoes.catalog';

/**
 * Área/Cargo embutidos na resposta, só para exibição.
 *
 * `status` atravessa porque a UI precisa distinguir uma associação a algo
 * INATIVO (que continua válida e tem de aparecer) de uma opção nova.
 */
export interface EstruturaRef {
  id: string;
  nome: string;
  status: Area['status'] | Cargo['status'];
}

/** Campos do gestor embutidos na resposta, só para exibição. */
export interface GestorResumo {
  id: string;
  nome: string;
  /**
   * LEGADO: códigos de texto, preenchidos só em membros cadastrados antes da
   * V4. Quem já foi reconfigurado tem `areaRef`/`cargoRef` e estes nulos —
   * por isso o front resolve o rótulo com precedência entidade → legado, e
   * não pode ler só estes campos.
   */
  cargo: string | null;
  area: string | null;
  areaRef: EstruturaRef | null;
  cargoRef: EstruturaRef | null;
  /** A UI sinaliza quando o gestor está inativo, sem desfazer a relação. */
  status: Membro['status'];
}

/** Role embutida na resposta. As permissões vêm junto para o detalhe do membro
 *  poder mostrar o que foi HERDADO sem uma segunda chamada. */
export interface RoleResumo {
  id: string;
  nome: string;
  tipo: Role['tipo'];
  /** Códigos do catálogo, já normalizados. Herdados, nunca editáveis no membro. */
  permissoes: string[];
}

/** O que o service precisa selecionar para montar um `MembroPublico`. */
export type MembroComGestor = Membro & {
  gestor?: GestorResumo | null;
  /** LEGADO, junto de `Membro.roleId`. Só alimenta os campos de compatibilidade. */
  role?: RoleResumo | null;
  /**
   * Os vínculos com as roles. OBRIGATÓRIO de propósito: com o campo opcional,
   * um call site que esquecesse o include compilaria e devolveria `roles: []` —
   * a pessoa apareceria sem role nenhuma, sem erro em lugar nenhum.
   */
  rolesAtribuidas: { role: RoleResumo }[];
  /**
   * Os vínculos de gestor indireto. OBRIGATÓRIO pelo mesmo motivo das roles,
   * e o risco aqui é maior: lista vazia é o estado VÁLIDO e esperado de todo
   * membro anterior a esta versão, então um call site que esquecesse o include
   * devolveria a lista vazia e ninguém desconfiaria nunca.
   */
  gestoresIndiretos: { gestorIndireto: GestorResumo }[];
  areaRef?: EstruturaRef | null;
  cargoRef?: EstruturaRef | null;
};

/**
 * Membro no formato que o front consome (ts/demo/src/services/api/membros.ts).
 *
 * `Usuario` NUNCA é embutido aqui: só o `usuarioId` e o açúcar `temConta`
 * atravessam, então `senhaHash` não tem por onde vazar.
 *
 * A hierarquia ESTRUTURAL atravessa só como `gestorId` + o resumo `gestor`.
 * Equipe direta, cadeia acima e árvore são DERIVADAS dessa relação — não há
 * campo espelhado que possa divergir.
 *
 * `gestoresIndiretos` é a outra relação de gestão, e não participa de nada
 * disso: a árvore a ignora, e nenhum campo de autorização a lê.
 */
export interface MembroPublico {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  /**
   * LEGADO (pré-V4): código do catálogo estático. Continua na resposta para os
   * membros que ainda não foram reconfigurados — o front usa como fallback de
   * exibição. Nunca mais é escrito.
   */
  area: string | null;
  cargo: string | null;
  /**
   * Área e Cargo como entidades da organização. null = sem área/cargo, estado
   * válido. Área diz ONDE a pessoa está alocada; Cargo, QUAL posição ocupa.
   * Nenhum dos dois concede permissão nem define hierarquia.
   */
  areaId: string | null;
  cargoId: string | null;
  areaRef: EstruturaRef | null;
  cargoRef: EstruturaRef | null;
  status: Membro['status'];
  /**
   * Que ESPÉCIE de vínculo a pessoa tem com a organização — eixo independente
   * de `status`, que diz em que ponto do onboarding ela está.
   *
   * `convidado` fica fora do organograma e da hierarquia, não tem área nem
   * cargo, não pode ser gestor de ninguém, e carrega exclusivamente a role
   * Convidado. Todo campo de estrutura de um convidado é nulo ou vazio por
   * invariante do service, não por convenção da interface.
   */
  tipo: Membro['tipo'];
  /**
   * Conta de login vinculada. null = ainda não concluiu o acesso.
   *
   * NÃO tem relação com `tipo`: a redação anterior dizia "convidado que ainda
   * não tem conta", usando "convidado" como adjetivo para quem foi convidado e
   * não entrou. Desde que `tipo` existe, essa leitura confunde dois conceitos
   * distintos — um convidado pode ter conta, e um membro pode não ter.
   */
  usuarioId: string | null;
  /** A UI usa isto para travar o campo de e-mail e esconder "Cancelar convite". */
  temConta: boolean;
  /** Gestor direto. null = topo da estrutura (ou ainda não configurado). */
  gestorId: string | null;
  /** Resumo do gestor, para a listagem não depender de ter a lista inteira. */
  gestor: GestorResumo | null;
  /**
   * Gestores indiretos: as outras lideranças que acompanham este membro.
   *
   * Relação MÚLTIPLA e DIRECIONAL, complementar a `gestorId` e nunca
   * substituta dele — a posição do membro na árvore continua saindo só do
   * gestor direto. Lista vazia é estado válido.
   *
   * Ordem alfabética e estável, sem prioridade entre eles:
   * `gestorIndiretoIds[i]` e `gestoresIndiretos[i]` são a mesma pessoa.
   */
  gestorIndiretoIds: string[];
  gestoresIndiretos: GestorResumo[];
  /**
   * As roles do membro: de zero a duas. Nenhuma prevalece sobre a outra.
   * Ordem alfabética e estável — `roleIds[i]` e `roles[i]` são a mesma role.
   */
  roleIds: string[];
  roles: RoleResumo[];
  /**
   * O que o membro PODE FAZER: a união das permissões de todas as roles dele,
   * já normalizada. É o conjunto que a autorização usa — a interface renderiza
   * este campo em vez de recalcular a união, senão o número exibido poderia
   * divergir do que o guard aplica (o normalizador descarta código que saiu do
   * catálogo; um `Set` no cliente não descartaria).
   *
   * Sai das ROLES e só delas. Gestor direto e gestores indiretos não
   * contribuem nada aqui: gestão organizacional e autorização da plataforma
   * são eixos independentes, e é essa separação que impede editar a estrutura
   * de ampliar acesso em silêncio.
   */
  permissoesEfetivas: string[];
  /**
   * @deprecated Compatibilidade com bundles anteriores à V6. É o id quando o
   * membro tem EXATAMENTE uma role, e null com zero ou duas — com duas não há
   * resposta certa, e escolher uma inventaria o conceito de role principal.
   */
  roleId: string | null;
/** @deprecated Compatibilidade, como `roleId`. Use `roles`. */
  role: RoleResumo | null;
  convidadoEm: string | null;
  desativadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * Roles do membro, em ordem ALFABÉTICA e estável.
 *
 * A ordenação vive aqui, e não num `orderBy` do include, porque o mapper é o
 * funil único das quatro respostas: um call site que esqueça o orderBy não
 * consegue vazar a ordem física do Postgres, que muda com update e vacuum.
 *
 * Alfabética de propósito. Por `criadoEm`, a primeira role atribuída apareceria
 * sempre primeiro — e "a primeira" se lê como principal, que é justamente o
 * conceito que esta versão recusa.
 */
function ordenarRoles(roles: RoleResumo[]): RoleResumo[] {
  return [...roles].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Gestores indiretos, em ordem ALFABÉTICA e estável.
 *
 * Mesmo argumento de `ordenarRoles`, e aqui ele é mais forte: esta é a única
 * lista cuja ordem física muda de verdade a cada save, porque
 * `sincronizarGestoresIndiretos` remove e recria linhas.
 *
 * Alfabética e não por `criadoEm`: por data o primeiro adicionado apareceria
 * sempre primeiro e se leria como "o principal" — e posição privilegiada é
 * exatamente o que o gestor direto reserva para si.
 */
function ordenarGestores(gestores: GestorResumo[]): GestorResumo[] {
  return [...gestores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function toMembroPublico(membro: MembroComGestor): MembroPublico {
  const roles = ordenarRoles(membro.rolesAtribuidas.map((v) => v.role));
  const indiretos = ordenarGestores(
    membro.gestoresIndiretos.map((v) => v.gestorIndireto),
  );
  return {
    id: membro.id,
    empresaId: membro.empresaId,
    nome: membro.nome,
    email: membro.email,
    area: membro.area,
    cargo: membro.cargo,
    areaId: membro.areaId,
    cargoId: membro.cargoId,
    areaRef: membro.areaRef ?? null,
    cargoRef: membro.cargoRef ?? null,
    status: membro.status,
    tipo: membro.tipo,
    usuarioId: membro.usuarioId,
    temConta: membro.usuarioId != null,
    gestorId: membro.gestorId,
    gestor: membro.gestor ?? null,
    // Os dois saem do MESMO array ordenado, como `roleIds`/`roles`.
    gestorIndiretoIds: indiretos.map((g) => g.id),
    gestoresIndiretos: indiretos,
    // `roleIds` sai do MESMO array ordenado, nunca da ordem do request: assim
    // `roleIds[i]` e `roles[i]` não têm como discordar.
    roleIds: roles.map((r) => r.id),
    roles,
    // A união passa pelo mesmo normalizador da escrita e do guard.
    permissoesEfetivas: normalizarPermissoes(
      roles.flatMap((r) => r.permissoes),
    ),
    // Compatibilidade: um id só quando há exatamente uma role.
    roleId: roles.length === 1 ? roles[0].id : null,
    role: roles.length === 1 ? roles[0] : null,
    convidadoEm: membro.convidadoEm?.toISOString() ?? null,
    desativadoEm: membro.desativadoEm?.toISOString() ?? null,
    criadoEm: membro.criadoEm.toISOString(),
    atualizadoEm: membro.atualizadoEm.toISOString(),
  };
}
