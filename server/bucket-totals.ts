import { formatAtomicToUsdc } from './verify-base-usdc';

export type BucketName = 'treasury' | 'escrow' | 'reallocation';
export type EntryStatus = 'unpaid_order' | 'pending_verification' | 'verified_funded';
export type BucketEntry = { bucket: BucketName; amount_atomic: string; verified: number; status: EntryStatus; count?: number };
export type BookkeepingRelease = { bucket: BucketName; amount_atomic: string; count?: number };
export type BucketSummary = {
  bucket: BucketName;
  verifiedFundedAtomic: string;
  verifiedFundedFormatted: string;
  unverifiedOrUnpaidAtomic: string;
  unverifiedOrUnpaidFormatted: string;
  releaseEligibleAtomic: string;
  releaseEligibleFormatted: string;
  entryCount: number;
};

const buckets = ['treasury', 'escrow', 'reallocation'] as const;
function amount(value: string): bigint {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]*)$/.test(value)) throw new Error('Invalid atomic USDC amount');
  return BigInt(value);
}

/**
 * Calculate from individual trusted records, including repeated equal amounts.
 * Releases are bookkeeping entries, not evidence of an on-chain transfer or custody.
 */
export function summarizeBucketTotals(entries: readonly BucketEntry[], releases: readonly BookkeepingRelease[]): Record<BucketName, BucketSummary> {
  const acc = Object.fromEntries(buckets.map(bucket => [bucket, { funded: 0n, unverified: 0n, released: 0n, count: 0 }])) as Record<BucketName, { funded: bigint; unverified: bigint; released: bigint; count: number }>;
  for (const row of entries) {
    if (!Object.hasOwn(acc, row.bucket) || !['unpaid_order', 'pending_verification', 'verified_funded'].includes(row.status) || ![0, 1].includes(row.verified)) throw new Error('Invalid bucket entry');
    if ((row.status === 'verified_funded') !== (row.verified === 1)) throw new Error('Inconsistent verification status');
    const current = acc[row.bucket];
    const value = amount(row.amount_atomic);
    if (row.status === 'verified_funded' && value === 0n) throw new Error('A funded entry must have a positive amount');
    const count = row.count ?? 1;
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(current.count + count)) throw new Error('Invalid entry count');
    if (row.status === 'verified_funded') current.funded += value * BigInt(count);
    else current.unverified += value * BigInt(count);
    current.count += count;
  }
  for (const row of releases) {
    if (!Object.hasOwn(acc, row.bucket)) throw new Error('Invalid release bucket');
    const value = amount(row.amount_atomic);
    if (value === 0n) throw new Error('A bookkeeping release must have a positive amount');
    const count = row.count ?? 1;
    if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid release count');
    acc[row.bucket].released += value * BigInt(count);
  }
  return Object.fromEntries(buckets.map(bucket => {
    const { funded, unverified, released, count } = acc[bucket];
    const eligible = funded > released ? funded - released : 0n;
    return [bucket, { bucket, verifiedFundedAtomic: funded.toString(), verifiedFundedFormatted: formatAtomicToUsdc(funded), unverifiedOrUnpaidAtomic: unverified.toString(), unverifiedOrUnpaidFormatted: formatAtomicToUsdc(unverified), releaseEligibleAtomic: eligible.toString(), releaseEligibleFormatted: formatAtomicToUsdc(eligible), entryCount: count }];
  })) as Record<BucketName, BucketSummary>;
}
