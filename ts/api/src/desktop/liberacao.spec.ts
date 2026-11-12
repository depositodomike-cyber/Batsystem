import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { achadosBloqueantes, estadoLiberacao } from './liberacao';

const tabela = (linhas: string) => `| ID | Severidade | Status | Título | Origem | Correção |\n|---|---|---|---|---|---|\n${linhas}`;

describe('liberação (SR-51 / SR-36)', () => {
  it('ALTA/CRITICA ABERTO ou CORRIGIDO bloqueiam; VALIDADO e ACEITO não', () => {
    const md = tabela(
      [
        '| GA-01 | ALTA | ABERTO | x | y | z |',
        '| GA-02 | CRITICA | CORRIGIDO | x | y | z |',
        '| GA-03 | ALTA | VALIDADO | x | y | z |',
        '| GA-04 | MEDIA | ABERTO | x | y | z |',
        '| GB-05 | ALTA | ACEITO | x | y | z |',
      ].join('\n'),
    );
    expect(achadosBloqueantes(md).map((b) => b.id)).toEqual(['GA-01', 'GA-02']);
    expect(estadoLiberacao('true', false, () => md)).toMatchObject({ ativo: false });
  });

  it('flag desligada, Vercel ou registro ausente = desativado (falha fechada)', () => {
    const ok = () => tabela('');
    expect(estadoLiberacao(undefined, false, ok).ativo).toBe(false);
    expect(estadoLiberacao('true', true, ok).ativo).toBe(false);
    expect(estadoLiberacao('true', false, () => { throw new Error('ENOENT'); }).ativo).toBe(false);
    expect(estadoLiberacao('true', false, ok).ativo).toBe(true);
  });

  // Gate técnico: este teste FALHA enquanto o registro real tiver achado
  // crítico/alto sem revalidação — e o CI não deixa liberar.
  it('o registro real de achados não tem crítico/alto pendente', () => {
    const md = readFileSync(join(__dirname, '..', '..', '..', '..', 'docs', 'security', 'achados.md'), 'utf8');
    expect(achadosBloqueantes(md)).toEqual([]);
  });
});
