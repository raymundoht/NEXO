-- Keep every ERP data table protected from Supabase public roles.
-- The trusted Next.js server role receives BYPASSRLS separately through
-- prisma/supabase-hardening.sql and application users are authorized in RBAC.
DO $$
DECLARE
  target_table record;
BEGIN
  FOR target_table IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      target_table.schemaname,
      target_table.tablename
    );
  END LOOP;
END
$$;
