<!-- coderabbit-ai-generated:v1 -->

# Bucket bookkeeping

Migration `0026_bucket_bookkeeping.sql` and `server/bucket-bookkeeping.ts` provide standalone server-side records for the approved sports output tiers. They are not connected to an HTTP route or an existing checkout. No migration or deployment has been run remotely.

Intake requires an explicit supported bucket because tier defaults were not specified. It takes the tier amount from the existing server catalog and records a zero or unpaid order or a pending receipt. Caller-provided receipt flags and signatures cannot establish verified funding. Migration 0026 prevents verified entries until a future, independently verified integration is designed. Retries recover identical records, including concurrent insert conflicts; reusing a key for different input fails. Callers must authenticate and authorize access before invoking these functions.

Totals use exact integer arithmetic and include repeated amounts and separate bookkeeping releases. Release records are append-only notes: they do not transfer funds, establish escrow, validate available balance, or authorize a payout. Eligibility is a bookkeeping calculation and is not an on-chain balance. Intake and release corrections, trusted receipt verification, single-use receipt claims across checkout flows, allocation defaults, authorization, and any actual payout process need explicit integration before production use.
