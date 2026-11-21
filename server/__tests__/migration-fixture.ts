import { readFileSync, readdirSync } from 'node:fs';

// These columns predate the checked-in migrations in the production database.
// Add them only to the fresh, synthetic databases used by these tests.
export function applyLegacyFixtureMigration(db: { exec(sql: string): void }, name: string) {
  if (name === '0014_usdc_checkout.sql') {
    db.exec('ALTER TABLE artworks ADD COLUMN fulfillment_uri TEXT; ALTER TABLE artworks ADD COLUMN buyer_email TEXT; ALTER TABLE artworks ADD COLUMN access_token TEXT;');
  } else if (name === '0016_catalog_release.sql') {
    db.exec('ALTER TABLE artworks ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0;');
  } else if (name === '0017_collector_recovery.sql') {
    db.exec('ALTER TABLE transactions ADD COLUMN buyer_wallet TEXT;');
  }
  db.exec(readFileSync(`migrations/${name}`, 'utf8'));
}

export function applyLegacyFixtureMigrations(db: { exec(sql: string): void }, before = '') {
  for (const name of readdirSync('migrations').filter(name => name.endsWith('.sql')).sort()) {
    if (before && name >= before) break;
    applyLegacyFixtureMigration(db, name);
  }
}
