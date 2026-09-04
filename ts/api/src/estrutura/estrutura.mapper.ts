import type { Area, Cargo } from '@prisma/client';

/**
 * Área/Cargo no formato que o front consome
 * (ts/demo/src/services/api/estrutura.ts).
 *
 * Uma interface só para os dois: as entidades são gêmeas e a tela é a mesma,
 * então um tipo por entidade só duplicaria a manutenção.
 */
export interface EstruturaPublica {
  id: string;
  empresaId: string;
  nome: string;
  descricao: string | null;
  status: Area['status'];
  /**
   * Quantos membros estão nesta área/cargo. SEMPRE derivado do `_count` — não
   * existe e não deve existir coluna de contagem, que divergiria na primeira
   * edição de membro feita por outro caminho.
   *
   * Conta todos os status de membro (ativo, convite pendente e inativo): é o
   * número que a UI usa para comunicar impacto, e ignorar inativos esconderia
   * vínculo que continua existindo.
   */
  membros: number;
  desativadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/** O que o service seleciona para montar uma `EstruturaPublica`. */
export type EstruturaComContagem = (Area | Cargo) & {
  _count?: { membros: number };
};

export function toEstruturaPublica(
  item: EstruturaComContagem,
): EstruturaPublica {
  return {
    id: item.id,
    empresaId: item.empresaId,
    nome: item.nome,
    descricao: item.descricao,
    status: item.status,
    membros: item._count?.membros ?? 0,
    desativadoEm: item.desativadoEm?.toISOString() ?? null,
    criadoEm: item.criadoEm.toISOString(),
    atualizadoEm: item.atualizadoEm.toISOString(),
  };
}
