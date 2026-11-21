import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { computeSafeBucketTotals, logDeferredBookkeepingRelease, recordIdempotentOptIn } from '../bucket-bookkeeping';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
let sqlite: InstanceType<typeof DatabaseSync>;
function makeDb(): D1Database {
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) { args = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...args) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    };
    return statement;
  };
  const session = { prepare, async batch(statements: ReturnType<typeof prepare>[]) { return Promise.all(statements.map(statement => statement.all())); } };
  return { withSession: () => session } as unknown as D1Database;
}
const intake = { idempotencyKey: 'request-1', tierId: 'tier_std_5', optedIn: true, requestedBucket: 'treasury' as const, txHash: `0x${'a'.repeat(64)}`, payerAddress: `0x${'b'.repeat(40)}`, proofSignature: `0x${'c'.repeat(130)}`, receiptVerifiedOnChain: true };
beforeEach(() => { sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync('migrations/0026_bucket_bookkeeping.sql', 'utf8')); });
afterEach(() => sqlite.close());

describe('standalone bucket bookkeeping', () => {
  it('derives price from the catalog and never trusts a claimed verified receipt', async () => {
    const db = makeDb();
    const result = await recordIdempotentOptIn(db, intake);
    expect(result).toMatchObject({ idempotentReplay: false, record: { amount_atomic: '5000000', verified: 0, status: 'pending_verification', payout_destination: null } });
    expect(result.record).not.toHaveProperty('request_fingerprint');
    expect((await recordIdempotentOptIn(db, intake)).idempotentReplay).toBe(true);
    expect(await computeSafeBucketTotals(db)).toMatchObject({ treasury: { verifiedFundedAtomic: '0', unverifiedOrUnpaidAtomic: '5000000', entryCount: 1 } });
    expect(() => sqlite.prepare("UPDATE usdc_bucket_entries SET verified=1, status='verified_funded'").run()).toThrow();
  });
  it('rejects key reuse for a different intake and requires known tier and explicit bucket', async () => {
    const db = makeDb();
    await recordIdempotentOptIn(db, intake);
    await expect(recordIdempotentOptIn(db, { ...intake, tierId: 'tier_ext_15' })).rejects.toThrow('conflicts');
    await expect(recordIdempotentOptIn(db, { ...intake, idempotencyKey: 'new', tierId: 'unknown' })).rejects.toThrow('catalog tier');
    await expect(recordIdempotentOptIn(db, { ...intake, idempotencyKey: 'new', requestedBucket: undefined })).rejects.toThrow('explicit');
  });
  it('handles concurrent same-key calls and never counts duplicates as separate entries', async () => {
    const db = makeDb();
    const results = await Promise.all([recordIdempotentOptIn(db, intake), recordIdempotentOptIn(db, intake)]);
    expect(results.map(result => result.idempotentReplay).sort()).toEqual([false, true]);
    expect((await computeSafeBucketTotals(db)).treasury.entryCount).toBe(1);
  });
  it('includes repeated values and separate bookkeeping releases in exact totals', async () => {
    const db = makeDb();
    await recordIdempotentOptIn(db, intake);
    await recordIdempotentOptIn(db, { ...intake, idempotencyKey: 'request-2' });
    const release = { idempotencyKey: 'release-1', bucket: 'treasury' as const, amountAtomic: 1000000n };
    const results = await Promise.all([logDeferredBookkeepingRelease(db, release), logDeferredBookkeepingRelease(db, release)]);
    expect(results.map(result => result.idempotentReplay).sort()).toEqual([false, true]);
    expect((await computeSafeBucketTotals(db)).treasury).toMatchObject({ unverifiedOrUnpaidAtomic: '10000000', verifiedFundedAtomic: '0', releaseEligibleAtomic: '0', entryCount: 2 });
    await expect(logDeferredBookkeepingRelease(db, { ...release, amountAtomic: 2n })).rejects.toThrow('conflicts');
    expect(() => sqlite.prepare('DELETE FROM bookkeeping_releases').run()).toThrow();
  });
  it('validates amounts and destination for a bookkeeping-only release', async () => {
    const db = makeDb();
    await expect(logDeferredBookkeepingRelease(db, { idempotencyKey: 'x', bucket: 'escrow', amountAtomic: 0n })).rejects.toThrow();
    await expect(logDeferredBookkeepingRelease(db, { idempotencyKey: 'x', bucket: 'escrow', amountAtomic: 1n, deferredPayoutDestination: 'bad' })).rejects.toThrow();
    expect((await logDeferredBookkeepingRelease(db, { idempotencyKey: 'x', bucket: 'escrow', amountAtomic: 9223372036854775808n })).release).toMatchObject({ amount_atomic: '9223372036854775808', mode: 'bookkeeping_only' });
  });
});
