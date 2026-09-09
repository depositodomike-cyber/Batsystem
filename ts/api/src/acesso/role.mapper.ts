import type { Role } from '@prisma/client';
import {
  CODIGOS_DE_ROLE_PROTEGIDA,
  ROLE_OWNER,
} from './permissoes.catalog';

/** Role no formato que o front consome (ts/demo/src/services/api/roles.ts). */
export interface RolePublica {
  id: string;
  empresaId: string;
  nome: string;
  descricao: string | null;
  tipo: Role['tipo'];
  /** Chave estável das roles de sistema (owner|admin|editor|viewer); null nas outras. */
  codigo: string | null;
  /** Códigos do catálogo, já normalizados (dependências incluídas). */
  permissoes: string[];
  /**
   * Quantos membros usam esta role. Derivado — a UI usa para comunicar o
   * impacto de uma edição e para exigir resolução antes de excluir.
   */
  membros: number;
  /**
   * Pode ser editada e excluída — e, por consequência, é uma role que se pode
   * ATRIBUIR a alguém no cadastro. Falso para as duas protegidas, Owner e
   * Convidado; Admin, Editor e Viewer são de sistema por ORIGEM, mas
   * administráveis como qualquer outra.
   *
   * Até a V7 este campo era literalmente `!proprietaria` — o mesmo booleano
   * com dois nomes —, e por isso toda condicional que testava `proprietaria`
   * testava sem saber os dois conceitos. Agora eles são independentes:
   * `editavel` responde "pode ser mexida/dada", `proprietaria` responde "tem
   * a ação Transferir". Uma role pode ser não editável sem ser proprietária.
   */
  editavel: boolean;
  /**
   * É a role do proprietário da organização. A interface usa isto para oferecer
   * "Transferir propriedade" — que é a única ação dela, e que NÃO existe para a
   * outra role protegida.
   *
   * Derivado de `codigo`, e não do nome nem do `tipo`: é a identificação
   * estrutural que um rename ou um dado legado não dissolve.
   */
  proprietaria: boolean;
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
    // `CODIGOS_DE_ROLE_PROTEGIDA` e não uma lista à mão: o dia em que uma
    // terceira role de sistema imutável existir, ela entra pelo catálogo e este
    // arquivo não precisa saber.
    editavel: role.codigo == null || !CODIGOS_DE_ROLE_PROTEGIDA.has(role.codigo),
    proprietaria: role.codigo === ROLE_OWNER,
    criadoEm: role.criadoEm.toISOString(),
    atualizadoEm: role.atualizadoEm.toISOString(),
  };
}
