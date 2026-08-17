-- Pending records from the old flow are discarded because they did not carry
-- a browser-bound continuation secret and could be replaced by another client.
DELETE FROM "registration_verifications";
ALTER TABLE "registration_verifications"
  ADD COLUMN "continuation_hash" CHAR(64) NOT NULL;
