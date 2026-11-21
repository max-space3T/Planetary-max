-- Standalone bookkeeping only. It neither verifies receipts nor moves USDC.
CREATE TABLE usdc_bucket_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('treasury','escrow','reallocation')),
  tier_id TEXT NOT NULL,
  amount_atomic TEXT NOT NULL CHECK (length(amount_atomic)>0 AND amount_atomic NOT GLOB '*[^0-9]*' AND (amount_atomic='0' OR substr(amount_atomic,1,1)!='0')),
  opted_in INTEGER NOT NULL CHECK (opted_in IN (0,1)),
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified=0),
  status TEXT NOT NULL CHECK (status IN ('unpaid_order','pending_verification')),
  tx_hash TEXT,
  payer_address TEXT,
  payout_destination TEXT DEFAULT NULL CHECK (payout_destination IS NULL)
);
CREATE TABLE bookkeeping_releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key TEXT NOT NULL UNIQUE,
  bucket TEXT NOT NULL CHECK (bucket IN ('treasury','escrow','reallocation')),
  amount_atomic TEXT NOT NULL CHECK (length(amount_atomic)>0 AND amount_atomic NOT GLOB '*[^0-9]*' AND substr(amount_atomic,1,1)!='0'),
  payout_destination TEXT,
  mode TEXT NOT NULL CHECK (mode='bookkeeping_only'),
  note TEXT NOT NULL
);
-- Corrections require an explicit future migration and audit policy.
CREATE TRIGGER bucket_entries_no_update BEFORE UPDATE ON usdc_bucket_entries BEGIN SELECT RAISE(ABORT,'Bucket entries are append-only'); END;
CREATE TRIGGER bucket_entries_no_delete BEFORE DELETE ON usdc_bucket_entries BEGIN SELECT RAISE(ABORT,'Bucket entries are append-only'); END;
CREATE TRIGGER bookkeeping_releases_no_update BEFORE UPDATE ON bookkeeping_releases BEGIN SELECT RAISE(ABORT,'Bookkeeping releases are append-only'); END;
CREATE TRIGGER bookkeeping_releases_no_delete BEFORE DELETE ON bookkeeping_releases BEGIN SELECT RAISE(ABORT,'Bookkeeping releases are append-only'); END;
