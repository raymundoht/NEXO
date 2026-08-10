-- Ejecutar una sola vez en el SQL Editor de Supabase después de la migración.
-- El ERP usa conexión PostgreSQL exclusivamente desde el servidor.
-- No se exponen tablas por las APIs públicas de Supabase.

-- Prisma se conecta desde el backend con un rol privado. Como la aplicación
-- no usa JWT de Supabase dentro de PostgreSQL, las políticas RLS no pueden
-- identificar al usuario del ERP. El rol del servidor debe atravesar RLS y
-- la autorización por usuario se aplica en los Route Handlers de Next.js.
--
-- BYPASSRLS no concede acceso a una tabla por sí mismo: el rol también
-- necesita los GRANT explícitos definidos abajo. Se conservan deshabilitados
-- SUPERUSER, CREATEDB, CREATEROLE y REPLICATION.
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexo_backend') THEN
    RAISE EXCEPTION
      'El rol nexo_backend no existe. Créalo antes de ejecutar el hardening.';
  END IF;
END
$$;

ALTER ROLE "nexo_backend"
  WITH BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

COMMENT ON ROLE "nexo_backend" IS
  'NEXO ERP trusted server role; application RBAC is enforced in the Next.js backend.';

GRANT USAGE ON SCHEMA public TO "nexo_backend";
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO "nexo_backend";
GRANT USAGE, SELECT, UPDATE
  ON ALL SEQUENCES IN SCHEMA public TO "nexo_backend";

-- Las migraciones son propiedad de "prisma". Estos privilegios mantienen
-- accesibles para el backend las tablas y secuencias creadas en el futuro.
ALTER DEFAULT PRIVILEGES FOR ROLE "prisma" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "nexo_backend";
ALTER DEFAULT PRIVILEGES FOR ROLE "prisma" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "nexo_backend";

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Asegura que los historiales auditables no puedan alterarse por accidente
-- desde roles públicos. El rol privado del servidor conserva acceso.
COMMENT ON SCHEMA public IS
  'NEXO ERP: acceso únicamente mediante backend autenticado; APIs públicas revocadas.';
