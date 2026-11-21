import {
  applyMigrationsIdempotently,
  MigrationDefinition,
  MigrationEntry,
  SqlExecutor,
} from "./idempotent-migration-runner";

export const BASE_ARTWORKS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  creator_mark TEXT NOT NULL
);
`;

export const ADD_ARTWORKS_ACCESS_TOKEN_SQL = `
ALTER TABLE artworks
ADD COLUMN access_token TEXT;

CREATE INDEX IF NOT EXISTS idx_artworks_access_token
ON artworks (access_token);
`;

// Use this sample migration set with a fresh, separate test database.
export const CATALOG_MIGRATIONS: MigrationDefinition[] = [
  { id: "0001_create_artworks", sql: BASE_ARTWORKS_TABLE_SQL },
  { id: "0002_add_artworks_access_token", sql: ADD_ARTWORKS_ACCESS_TOKEN_SQL },
];
export const SAMPLE_CATALOG_MIGRATIONS = CATALOG_MIGRATIONS;

export interface ArtworkFixtureRow {
  id: string;
  title: string;
  creator_mark: string;
  access_token: string | null;
}

export const SAMPLE_ARTWORK_FIXTURES: ArtworkFixtureRow[] = [
  {
    id: "art-001",
    title: "Timelike Manifold I",
    creator_mark: "MaxJ",
    access_token: "tok_maxj_001",
  },
  {
    id: "art-002",
    title: "Rosetta Gate Study",
    creator_mark: "MaxJ",
    access_token: null,
  },
];

export const LEGACY_CATALOG_MIGRATIONS: MigrationEntry[] = [
  {
    id: "0001_create_artworks_table",
    sql: `
CREATE TABLE IF NOT EXISTS artworks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT
);
`,
  },
  {
    id: "0002_add_artworks_access_token",
    sql: `
ALTER TABLE artworks ADD COLUMN access_token TEXT;
CREATE INDEX IF NOT EXISTS idx_artworks_access_token ON artworks (access_token);
`,
  },
];

export interface CatalogTestFixture {
  db: SqlExecutor;
  appliedMigrations: string[];
  skippedMigrations: string[];
}

export async function setupCatalogTestFixture(
  db: SqlExecutor,
  extraMigrations: MigrationEntry[] = []
): Promise<CatalogTestFixture> {
  const { applied, skipped } = await applyMigrationsIdempotently(db, [
    ...LEGACY_CATALOG_MIGRATIONS,
    ...extraMigrations,
  ]);

  return {
    db,
    appliedMigrations: applied,
    skippedMigrations: skipped,
  };
}
