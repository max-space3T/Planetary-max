import { describe, expect, it } from 'vitest';
import { summarizeBucketTotals } from '../bucket-totals';

describe('bookkeeping bucket totals', () => {
  it('counts repeated amounts exactly, beyond SQLite integer range, and deducts separate releases', () => {
    const total = summarizeBucketTotals([
      { bucket: 'treasury', amount_atomic: '9223372036854775808', verified: 1, status: 'verified_funded' },
      { bucket: 'treasury', amount_atomic: '9223372036854775808', verified: 1, status: 'verified_funded' },
      { bucket: 'treasury', amount_atomic: '5000000', verified: 0, status: 'pending_verification' },
      { bucket: 'escrow', amount_atomic: '0', verified: 0, status: 'unpaid_order' },
    ], [{ bucket: 'treasury', amount_atomic: '1000000' }]);
    expect(total.treasury).toEqual({ bucket: 'treasury', verifiedFundedAtomic: '18446744073709551616', verifiedFundedFormatted: '18446744073709.551616', unverifiedOrUnpaidAtomic: '5000000', unverifiedOrUnpaidFormatted: '5.000000', releaseEligibleAtomic: '18446744073708551616', releaseEligibleFormatted: '18446744073708.551616', entryCount: 3 });
    expect(total.escrow).toMatchObject({ entryCount: 1, verifiedFundedAtomic: '0', releaseEligibleAtomic: '0' });
    expect(total.reallocation).toMatchObject({ entryCount: 0, verifiedFundedAtomic: '0' });
  });
  it('preserves grouped multiplicities for funded entries and releases', () => {
    const totals = summarizeBucketTotals([
      { bucket: 'treasury', amount_atomic: '9223372036854775808', verified: 1, status: 'verified_funded', count: 3 },
    ], [{ bucket: 'treasury', amount_atomic: '5', count: 2 }]);
    expect(totals.treasury).toMatchObject({ verifiedFundedAtomic: '27670116110564327424', releaseEligibleAtomic: '27670116110564327414', entryCount: 3 });
  });
  it('never produces negative eligibility when bookkeeping releases exceed funded entries', () => {
    expect(summarizeBucketTotals([{ bucket: 'escrow', amount_atomic: '5', verified: 1, status: 'verified_funded' }], [{ bucket: 'escrow', amount_atomic: '6' }]).escrow.releaseEligibleAtomic).toBe('0');
  });
  it('rejects malformed and inconsistent records instead of silently inflating totals', () => {
    for (const row of [
      { bucket: 'treasury', amount_atomic: '-1', verified: 0, status: 'unpaid_order' },
      { bucket: 'treasury', amount_atomic: '01', verified: 0, status: 'unpaid_order' },
      { bucket: 'treasury', amount_atomic: '5', verified: 0, status: 'verified_funded' },
      { bucket: 'treasury', amount_atomic: '0', verified: 1, status: 'verified_funded' },
      { bucket: 'other', amount_atomic: '5', verified: 1, status: 'verified_funded' },
    ]) expect(() => summarizeBucketTotals([row as never], [])).toThrow();
    expect(() => summarizeBucketTotals([], [{ bucket: 'escrow', amount_atomic: '0' }])).toThrow();
  });
});
