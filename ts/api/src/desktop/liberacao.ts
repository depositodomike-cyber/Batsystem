// SR-51 / SR-36: a funcionalidade só liga com a flag E sem achado crítico ou
// alto pendente no registro do Security Engineer Agent. Sem o registro
// (arquivo ausente/ilegível) = não liberada: falha fechada.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A API roda de `ts/api`; o registro fica na raiz do repositório. */
export const ARQUIVO_ACHADOS =
  process.env.DESKTOP_ACHADOS_PATH || join(process.cwd(), '..', '..', 'docs', 'security', 'achados.md');

export interface Bloqueio {
  id: string;
  severidade: string;
  status: string;
}

/** Linhas CRITICA/ALTA com status ABERTO ou CORRIGIDO (não revalidado). */
export function achadosBloqueantes(markdown: string): Bloqueio[] {
  const out: Bloqueio[] = [];
  for (const linha of markdown.split(/\r?\n/)) {
    const cols = linha.split('|').map((c) => c.trim());
    // | ID | Severidade | Status | ...
    if (cols.length < 5 || !/^[A-Z]{1,4}-\d+$/.test(cols[1])) continue;
    const [, id, severidade, status] = cols;
    if ((severidade === 'CRITICA' || severidade === 'ALTA') && (status === 'ABERTO' || status === 'CORRIGIDO')) {
      out.push({ id, severidade, status });
    }
  }
  return out;
}

export interface EstadoLiberacao {
  ativo: boolean;
  motivo?: string;
}

export function estadoLiberacao(
  flag: string | undefined,
  ehVercel: boolean,
  lerAchados: () => string = () => readFileSync(ARQUIVO_ACHADOS, 'utf8'),
): EstadoLiberacao {
  if ((flag ?? 'false').trim() !== 'true') return { ativo: false, motivo: 'Desativado (DESKTOP_ATIVO).' };
  if (ehVercel) return { ativo: false, motivo: 'Indisponível em deploy serverless.' };
  let md: string;
  try {
    md = lerAchados();
  } catch {
    return { ativo: false, motivo: 'Registro de achados de segurança indisponível.' };
  }
  const b = achadosBloqueantes(md);
  if (b.length) {
    return { ativo: false, motivo: `Bloqueado pela revisão de segurança: ${b.map((x) => x.id).join(', ')}.` };
  }
  return { ativo: true };
}
