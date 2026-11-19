import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

/**
 * `prisma migrate deploy` sem o CLI do Prisma (GD-16).
 *
 * Mesmo protocolo e mesma tabela `_prisma_migrations` do Prisma, para que o
 * banco continue compatível com o CLI (ex.: em desenvolvimento):
 * - cada pasta de `prisma/migrations` com `migration.sql`, em ordem de nome;
 * - pendente = sem linha concluída e não revertida;
 * - antes de aplicar, insere a linha (checksum = SHA-256 hex do arquivo);
 *   aplica o script inteiro numa única chamada (transação implícita do
 *   Postgres para múltiplos comandos); depois marca `finished_at`;
 * - falha: registra `logs` e para. Uma migration falhada e não resolvida
 *   impede as próximas (como o erro P3009 do Prisma).
 *
 * Checksum diferente do registrado (ex.: CRLF/LF depois de um checkout) só
 * gera aviso, como no Prisma.
 */

const DDL_TABELA = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

export interface Migracao {
  nome: string;
  sql: string;
  checksum: string;
}

export function lerMigracoes(pasta: string): Migracao[] {
  return readdirSync(pasta, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(pasta, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort()
    .map((nome) => {
      const bytes = readFileSync(path.join(pasta, nome, "migration.sql"));
      return { nome, sql: bytes.toString("utf8"), checksum: createHash("sha256").update(bytes).digest("hex") };
    });
}

interface Linha {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
}

/** Decide o que aplicar; erro se houver migration falhada e não resolvida. */
export function planejar(
  migracoes: Migracao[],
  linhas: Linha[],
): { pendentes: Migracao[]; avisos: string[] } {
  const falhada = linhas.find((l) => !l.finished_at && !l.rolled_back_at);
  if (falhada) {
    throw new Error(
      `A migration ${falhada.migration_name} falhou numa execução anterior. Veja migracoes.log.`,
    );
  }
  const concluidas = new Map(
    linhas.filter((l) => l.finished_at && !l.rolled_back_at).map((l) => [l.migration_name, l]),
  );
  const avisos: string[] = [];
  for (const m of migracoes) {
    const l = concluidas.get(m.nome);
    if (l && l.checksum !== m.checksum) avisos.push(`checksum diferente do aplicado: ${m.nome}`);
  }
  return { pendentes: migracoes.filter((m) => !concluidas.has(m.nome)), avisos };
}

export async function aplicarMigracoes(
  urlBanco: string,
  pasta: string,
  registrar: (linha: string) => void,
): Promise<string[]> {
  const c = new Client({ connectionString: urlBanco });
  await c.connect();
  try {
    await c.query(DDL_TABELA);
    const { rows } = await c.query<Linha>(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"',
    );
    const { pendentes, avisos } = planejar(lerMigracoes(pasta), rows);
    for (const a of avisos) registrar(`aviso: ${a}`);
    for (const m of pendentes) {
      const id = randomUUID();
      registrar(`aplicando ${m.nome}`);
      await c.query(
        'INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count) VALUES ($1, $2, $3, now(), 0)',
        [id, m.checksum, m.nome],
      );
      try {
        await c.query(m.sql);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await c.query('UPDATE "_prisma_migrations" SET logs = $2 WHERE id = $1', [id, msg]);
        throw new Error(`Falha na migration ${m.nome}: ${msg}`);
      }
      await c.query(
        'UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1',
        [id],
      );
    }
    registrar(pendentes.length ? `${pendentes.length} migration(s) aplicada(s)` : "banco já atualizado");
    return pendentes.map((m) => m.nome);
  } finally {
    await c.end();
  }
}
