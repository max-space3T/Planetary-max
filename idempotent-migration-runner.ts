export interface SqlExecutor {
  exec(sql: string, params?: unknown[]): Promise<void> | void;
  query<TRow = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<TRow[]> | TRow[];
}

export interface MigrationEntry {
  id: string;
  sql: string;
}

export interface MigrationDefinition {
  id: string;
  sql: string;
}

export interface MigrationRunResult {
  applied: string[];
  skipped: string[];
}

export interface AppliedMigrationRow {
  id: string;
  applied_at: string;
}

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _beemax_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

export async function ensureMigrationLedger(executor: SqlExecutor): Promise<void> {
  await executor.exec(MIGRATIONS_TABLE_SQL);
}

export async function runIdempotentMigrations(
  executor: SqlExecutor,
  migrations: MigrationDefinition[],
  nowIso: () => string = () => new Date().toISOString()
): Promise<MigrationRunResult> {
  await ensureMigrationLedger(executor);

  const existingRows = await executor.query<{ id: string }>(
    "SELECT id FROM _beemax_migrations"
  );
  const appliedSet = new Set(existingRows.map((row) => row.id));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    if (appliedSet.has(migration.id)) {
      skipped.push(migration.id);
      continue;
    }

    await executor.exec(migration.sql);
    await executor.exec(
      "INSERT INTO _beemax_migrations (id, applied_at) VALUES (?, ?)",
      [migration.id, nowIso()]
    );
    appliedSet.add(migration.id);
    applied.push(migration.id);
  }

  return { applied, skipped };
}

export async function applyMigrationsIdempotently(
  db: SqlExecutor,
  migrations: MigrationEntry[]
): Promise<{ applied: string[]; skipped: string[] }> {
  await db.exec(MIGRATIONS_TABLE_SQL);

  const existingRows = await db.query<AppliedMigrationRow>(
    "SELECT id, applied_at FROM _beemax_migrations;"
  );
  const alreadyApplied = new Set(existingRows.map((row) => row.id));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    if (alreadyApplied.has(migration.id)) {
      skipped.push(migration.id);
      continue;
    }

    await db.exec(migration.sql);
    await db.query(
      "INSERT INTO _beemax_migrations (id, applied_at) VALUES (?, ?);",
      [migration.id, new Date().toISOString()]
    );
    alreadyApplied.add(migration.id);
    applied.push(migration.id);
  }

  return { applied, skipped };
}
