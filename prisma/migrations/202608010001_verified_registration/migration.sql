-- Public self-registration is completed only after a short-lived email code.
-- Unverified credentials remain isolated from the users table.
CREATE TABLE "registration_verifications" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CASHIER',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ip_hash" CHAR(64),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "resend_at" TIMESTAMPTZ(3) NOT NULL,
    "last_sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registration_verifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "registration_verifications_attempts_check"
      CHECK ("attempts" >= 0 AND "attempts" <= 5)
);

CREATE UNIQUE INDEX "registration_verifications_email_key"
  ON "registration_verifications"("email");
CREATE INDEX "registration_verifications_expires_at_idx"
  ON "registration_verifications"("expires_at");
CREATE INDEX "registration_verifications_ip_hash_last_sent_at_idx"
  ON "registration_verifications"("ip_hash", "last_sent_at");

ALTER TABLE "registration_verifications" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "registration_verifications" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexo_backend') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "registration_verifications" TO "nexo_backend"';
  END IF;
END
$$;
