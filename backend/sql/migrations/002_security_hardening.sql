-- Hardening: invalidate any reset links issued by the old plaintext/logging
-- flow, store only hashes of IoT credentials, and support session revocation.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;

DELETE FROM password_reset_tokens;
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_one_per_email
  ON password_reset_tokens (email);

ALTER TABLE sheds
  ADD COLUMN IF NOT EXISTS device_token_hash TEXT;
UPDATE sheds SET device_token_hash = NULL;
ALTER TABLE sheds DROP COLUMN IF EXISTS device_token;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sheds_device_token_hash_unique
  ON sheds (device_token_hash);

-- Earlier shed edits could copy the plaintext token into audit snapshots.
UPDATE audit_logs
SET previous_data = previous_data - 'device_token' - 'device_token_hash',
    new_data = new_data - 'device_token' - 'device_token_hash'
WHERE previous_data ? 'device_token'
   OR previous_data ? 'device_token_hash'
   OR new_data ? 'device_token'
   OR new_data ? 'device_token_hash';
