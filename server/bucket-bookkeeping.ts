import { getOutputTier } from '../src/shared/outputTiers';
import { parseUsdcToAtomic } from './verify-base-usdc';
import { summarizeBucketTotals, type BucketEntry, type BookkeepingRelease, type BucketName, type BucketSummary } from './bucket-totals';

export interface SettlementIntakeInput {
  idempotencyKey: string;
  tierId: string;
  optedIn: boolean;
  requestedBucket?: BucketName;
  txHash?: string | null;
  payerAddress?: string | null;
  proofSignature?: string | null;
  receiptVerifiedOnChain?: boolean;
}
type Entry = BucketEntry & { id: number; idempotency_key: string; tier_id: string; opted_in: number; tx_hash: string | null; payer_address: string | null; payout_destination: null };
type StoredEntry = Entry & { request_fingerprint: string };
type Release = BookkeepingRelease & { id: number; idempotency_key: string; payout_destination: string | null; mode: 'bookkeeping_only'; note: string };
const entriesColumns = 'id, idempotency_key, request_fingerprint, bucket, tier_id, amount_atomic, opted_in, verified, status, tx_hash, payer_address, payout_destination';
const releaseColumns = 'id, idempotency_key, bucket, amount_atomic, payout_destination, mode, note';
function key(value: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)) throw new Error('Invalid idempotency key');
  return value;
}
function bucket(value: unknown): BucketName {
  if (value !== 'treasury' && value !== 'escrow' && value !== 'reallocation') throw new Error('An explicit supported bucket is required');
  return value;
}
function optionalHex(value: string | null | undefined, length: number): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !new RegExp(`^0x[0-9a-fA-F]{${length}}$`).test(value)) throw new Error('Invalid receipt or proof field');
  return value.toLowerCase();
}
async function fingerprint(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
function publicEntry(row: StoredEntry): Entry {
  const { request_fingerprint: _fingerprint, ...entry } = row;
  return entry;
}

// Trusted server use only: the caller must authorize access to the idempotency key.
// A client-provided verification flag or signature never creates funded state.
export async function recordIdempotentOptIn(db: D1Database, input: SettlementIntakeInput): Promise<{ idempotentReplay: boolean; record: Entry }> {
  const idempotencyKey = key(input.idempotencyKey);
  const requestedBucket = bucket(input.requestedBucket);
  if (typeof input.tierId !== 'string' || typeof input.optedIn !== 'boolean') throw new Error('Invalid intake');
  const tx = optionalHex(input.txHash, 64);
  const payer = optionalHex(input.payerAddress, 40);
  const signature = optionalHex(input.proofSignature, 130);
  const requestFingerprint = await fingerprint([input.tierId, input.optedIn, requestedBucket, tx, payer, signature]);
  const session = db.withSession('first-primary');
  const find = () => session.prepare(`SELECT ${entriesColumns} FROM usdc_bucket_entries WHERE idempotency_key=?`).bind(idempotencyKey).first<StoredEntry>();
  const existing = await find();
  if (existing) {
    if (existing.request_fingerprint !== requestFingerprint) throw new Error('Idempotency key conflicts with another intake');
    return { idempotentReplay: true, record: publicEntry(existing) };
  }
  const tier = getOutputTier(input.tierId);
  const atomic = tier ? parseUsdcToAtomic(tier.priceUsdc) : null;
  if (!tier || atomic === null) throw new Error('Unsupported or invalid catalog tier');
  const status = atomic > 0n && tx ? 'pending_verification' : 'unpaid_order';
  const inserted = await session.prepare(`INSERT INTO usdc_bucket_entries (idempotency_key,request_fingerprint,bucket,tier_id,amount_atomic,opted_in,verified,status,tx_hash,payer_address,payout_destination) VALUES (?,?,?,?,?,?,0,?,?,?,NULL) ON CONFLICT(idempotency_key) DO NOTHING RETURNING ${entriesColumns}`)
    .bind(idempotencyKey, requestFingerprint, requestedBucket, tier.id, atomic.toString(), input.optedIn ? 1 : 0, status, tx, payer).first<StoredEntry>();
  const saved = inserted ?? await find();
  if (!saved || saved.request_fingerprint !== requestFingerprint) throw new Error('Idempotency key conflicts with another intake');
  return { idempotentReplay: !inserted, record: publicEntry(saved) };
}

export async function computeSafeBucketTotals(db: D1Database): Promise<Record<BucketName, BucketSummary>> {
  // Both grouped reads share a D1 batch transaction. Counts preserve duplicates;
  // arithmetic is performed on decimal strings with BigInt, never SQLite SUM/REAL.
  const session = db.withSession('first-primary');
  const results = await session.batch<BucketEntry | BookkeepingRelease>([
    session.prepare('SELECT bucket,amount_atomic,verified,status,COUNT(*) AS count FROM usdc_bucket_entries GROUP BY bucket,amount_atomic,verified,status'),
    session.prepare('SELECT bucket,amount_atomic,COUNT(*) AS count FROM bookkeeping_releases GROUP BY bucket,amount_atomic'),
  ]);
  return summarizeBucketTotals(results[0].results as BucketEntry[], results[1].results as BookkeepingRelease[]);
}

export async function logDeferredBookkeepingRelease(db: D1Database, params: { idempotencyKey: string; bucket: BucketName; amountAtomic: bigint; deferredPayoutDestination?: string | null; actorNote?: string }): Promise<{ idempotentReplay: boolean; release: Release }> {
  const idempotencyKey = key(params.idempotencyKey);
  const target = bucket(params.bucket);
  if (typeof params.amountAtomic !== 'bigint' || params.amountAtomic <= 0n || params.amountAtomic >= 2n ** 256n) throw new Error('Invalid release amount');
  const destination = params.deferredPayoutDestination ?? null;
  if (destination !== null && (typeof destination !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(destination))) throw new Error('Invalid payout destination');
  const normalizedDestination = destination?.toLowerCase() ?? null;
  const note = params.actorNote ?? 'Deferred payout / bookkeeping release logged';
  if (typeof note !== 'string' || note.length < 1 || note.length > 500) throw new Error('Invalid release note');
  const session = db.withSession('first-primary');
  const find = () => session.prepare(`SELECT ${releaseColumns} FROM bookkeeping_releases WHERE idempotency_key=?`).bind(idempotencyKey).first<Release>();
  const matches = (row: Release) => row.bucket === target && row.amount_atomic === params.amountAtomic.toString() && row.payout_destination === normalizedDestination && row.note === note && row.mode === 'bookkeeping_only';
  const existing = await find();
  if (existing) {
    if (!matches(existing)) throw new Error('Idempotency key conflicts with another release');
    return { idempotentReplay: true, release: existing };
  }
  const inserted = await session.prepare(`INSERT INTO bookkeeping_releases (idempotency_key,bucket,amount_atomic,payout_destination,mode,note) VALUES (?,?,?,?,'bookkeeping_only',?) ON CONFLICT(idempotency_key) DO NOTHING RETURNING ${releaseColumns}`)
    .bind(idempotencyKey, target, params.amountAtomic.toString(), normalizedDestination, note).first<Release>();
  const saved = inserted ?? await find();
  if (!saved || !matches(saved)) throw new Error('Idempotency key conflicts with another release');
  return { idempotentReplay: !inserted, release: saved };
}
