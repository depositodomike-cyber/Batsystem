import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RolesService } from '@/acesso/roles.service';
import type { AuthenticatedUser } from '@/auth/jwt.strategy';
import type { NivelRisco } from './ferramentas/ferramenta';

/** O que fazer com uma chamada de ferramenta antes de executá-la. */
export type Decisao =
  | { tipo: 'permitir' }
  | { tipo: 'negar'; motivo: string }
  /** Só roda depois que o usuário aprovar estes parâmetros exatos. */
  | { tipo: 'aprovar' };

/** Verifica uma permissão do catálogo para o usuário (já resolvida). */
export type Pode = (permissao: string) => boolean;

/**
 * Política de execução do orquestrador: DETERMINÍSTICA, sem modelo no meio.
 * É ela — e não o revisor de segurança — quem autoriza.
 *
 * 1. Permissão: a mesma regra do PermissoesGuard (owner/admin passam, exceto
 *    convidados; os demais precisam da permissão em alguma role).
 * 2. Risco: leitura roda direto; qualquer escrita exige aprovação humana dos
 *    parâmetros exatos.
 */
@Injectable()
export class PoliticaExecucaoService {
  constructor(private readonly roles: RolesService) {}

  /** Uma consulta por execução/retomada; o resultado vale para todas as chamadas. */
  async permissoesDe(user: AuthenticatedUser): Promise<Pode> {
    const ctx = await this.roles.contextoDeAutorizacao(user.empresaId, user.id);
    const bypass = !ctx.convidado && (user.role === 'owner' || user.role === 'admin');
    const conjunto = new Set(ctx.permissoes);
    return (p) => bypass || conjunto.has(p);
  }

  avaliar(perfil: { risco: NivelRisco; permissao: string } | undefined, pode: Pode): Decisao {
    if (!perfil) return { tipo: 'negar', motivo: 'Ferramenta desconhecida.' };
    if (!pode(perfil.permissao)) {
      return {
        tipo: 'negar',
        motivo: 'O usuário não tem permissão para esta ação. Não tente de novo; explique isso na resposta.',
      };
    }
    return perfil.risco === 'leitura' ? { tipo: 'permitir' } : { tipo: 'aprovar' };
  }
}

/** JSON com chaves ordenadas: o mesmo objeto sempre gera o mesmo texto. */
export function jsonEstavel(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonEstavel).join(',')}]`;
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${jsonEstavel(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Hash dos parâmetros aprovados: o que roda tem de ser o que foi aprovado. */
export function hashEntrada(entrada: unknown): string {
  return createHash('sha256').update(jsonEstavel(entrada)).digest('hex');
}
