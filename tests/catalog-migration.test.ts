import { describe, expect, it } from "vitest";
import { runIdempotentMigrations, SqlExecutor } from "../idempotent-migration-runner";
import { CATALOG_MIGRATIONS } from "../catalog-test-fixture";

function createFakeSqlExecutor(): SqlExecutor & { executedSql: string[] } {
  const ledger = new Set<string>();
  const executedSql: string[] = [];

  return {
    executedSql,
    exec(sql: string, params?: unknown[]) {
      executedSql.push(sql.trim());
      if (sql.includes("INSERT INTO _beemax_migrations") && params?.[0]) {
        ledger.add(String(params[0]));
      }
    },
    query<T>(sql: string): T[] {
      if (sql.includes("FROM _beemax_migrations")) {
        return Array.from(ledger).map((id) => ({ id } as unknown as T));
      }
      return [];
    },
  };
}

describe("Catalog migrations", () => {
  it("applies migrations once and skips on repeat run", async () => {
    const db = createFakeSqlExecutor();
    const first = await runIdempotentMigrations(db, CATALOG_MIGRATIONS);
    expect(first.applied).toEqual([
      "0001_create_artworks",
      "0002_add_artworks_access_token",
    ]);
    expect(first.skipped).toEqual([]);

    const second = await runIdempotentMigrations(db, CATALOG_MIGRATIONS);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual([
      "0001_create_artworks",
      "0002_add_artworks_access_token",
    ]);
  });
});
