import type { Role } from '@prisma/client';

/** Role no formato que o front consome (ts/demo/src/services/api/roles.ts). */
export interface RolePublica {
  id: string;
  empresaId: string;
  nome: string;
  descricao: string | null;
  tipo: Role['tipo'];
  /** Chave estável das roles de sistema (admin|editor|viewer); null nas outras. */
  codigo: string | null;
  /** Códigos do catálogo, já normalizados (dependências incluídas). */
  permissoes: string[];
  /**
   * Quantos membros usam esta role. Derivado — a UI usa para comunicar o
   * impacto de uma edição e para exigir resolução antes de excluir.
   */
  membros: number;
  /** Role de sistema é imutável: não pode ser editada nem excluída. */
  editavel: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

/**
 * O que o service seleciona para montar uma `RolePublica`.
 *
 * `_count` é OBRIGATÓRIO de propósito. Com ele opcional, um call site que
 * esquecesse o `include` compilaria e devolveria contagem 0 — a role apareceria
 * sem membros na aba Acesso, e no modal de exclusão `emUso` viraria 0, então o
 * modal deixaria de pedir a substituição e o backend responderia 409 como erro
 * genérico. Obrigatório transforma esse silêncio em erro de build.
 */
export type RoleComContagem = Role & {
  _count: { membrosAtribuidos: number };
};

export function toRolePublica(role: RoleComContagem): RolePublica {
  return {
    id: role.id,
    empresaId: role.empresaId,
    nome: role.nome,
    descricao: role.descricao,
    tipo: role.tipo,
    codigo: role.codigo,
    permissoes: role.permissoes,
    // Conta VÍNCULOS (membro_roles), não a coluna legada `membros.roleId`. A
    // unique (membroId, roleId) garante um vínculo por membro, então é o mesmo
    // número que o 409 da exclusão usa — por construção, não por coincidência.
    membros: role._count.membrosAtribuidos,
    editavel: role.tipo !== 'sistema',
    criadoEm: role.criadoEm.toISOString(),
    atualizadoEm: role.atualizadoEm.toISOString(),
  };
}
