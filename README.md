# NEXO ERP

Sistema integral web para inventarios, compras y punto de venta, construido a
partir del SRD entregado. Incluye backend transaccional, base PostgreSQL,
autenticación propia, control de acceso por roles y frontend responsivo.

## Módulos incluidos

- Autenticación por correo y contraseña con bloqueo después de 5 intentos.
- Recuperación de contraseña con token de un solo uso por 30 minutos.
- Registro con código de seis dígitos enviado al correo, vencimiento de 10
  minutos, límite de intentos y reenvío controlado.
- Indicador visual de seguridad de contraseña en registro y restablecimiento.
- Usuarios internos y RBAC: administrador, almacenista, comprador y cajero.
- Productos editables, alertas de mínimos/máximos, kardex consultable y ajustes auditados.
- Conteos físicos con protección contra movimientos concurrentes.
- Proveedores editables con condiciones y precios de referencia por producto.
- Órdenes desde faltantes y recepciones parciales o completas validadas.
- POS con búsqueda/lector, descuentos autorizados, impuestos y ventas en espera.
- Efectivo y tarjeta; no almacena PAN, CVV ni datos sensibles del plástico.
- Apertura, movimientos, conteo por denominaciones, arqueo y cierre de caja.
- Tickets digitales en PDF.
- Historiales y exportaciones CSV/PDF.
- Reembolsos y cancelaciones supervisadas con reversión automática.
- Dashboard, bitácora de auditoría y configuración del negocio.

## Tecnologías

- Next.js 15 + React 19 + TypeScript
- PostgreSQL
- Prisma ORM
- Argon2id para contraseñas
- Zod para validación de entradas
- Tailwind CSS 4
- Vitest

## Inicio rápido

Requisitos: Node.js 20.9 o superior y PostgreSQL 15 o superior.

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Abre `http://localhost:3000`. Si mantuviste los datos de desarrollo del archivo
de ejemplo, el correo inicial es `admin@nexo.local`.

Para cambiar de forma segura el correo y la contraseña del administrador que ya
existe en la base, configura `SEED_ADMIN_EMAIL` en `.env` y ejecuta:

```bash
npm run admin:credentials
```

El comando solicita la contraseña dos veces sin mostrarla, actualiza el hash
Argon2id, quita cualquier bloqueo temporal y revoca las sesiones anteriores. La
contraseña debe tener al menos 10 caracteres e incluir mayúscula, minúscula,
número y carácter especial. Usa una contraseña exclusiva del ERP; nunca
reutilices la contraseña de tu correo u otra cuenta.

## Estado de esta entrega

- Las migraciones iniciales ya estaban aplicadas al proyecto de Supabase; esta
  versión agrega `202608010001_verified_registration`, que debe aplicarse antes
  de utilizar `/register`.
- El usuario administrador, la caja principal y los datos de demostración ya
  están cargados.
- El backend usa `nexo_backend`, un rol PostgreSQL privado con `BYPASSRLS` pero
  sin permisos de superusuario, creación de bases o creación de roles. Prisma
  usa un rol separado para migraciones.
- Los roles públicos `anon` y `authenticated` no pueden leer ni modificar las
  tablas del ERP.
- La Data API de Supabase está desactivada; la base sólo se consume mediante el
  backend autenticado.
- `.env` contiene la conexión privada necesaria para ejecutar esta copia. Está
  ignorado por Git y debe rotarse antes de publicar o compartir el proyecto.

## Configuración de Supabase

1. Crea un proyecto PostgreSQL en Supabase.
2. Usa el Transaction Pooler de Supabase (puerto `6543`) en `DATABASE_URL`:

   ```env
   DATABASE_URL="postgresql://nexo_backend.PROJECT_REF:PASSWORD@POOLER_HOST:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1&connect_timeout=30"
   ```

   Usa la conexión directa o el Session Pooler (puerto `5432`) en
   `DIRECT_URL`, exclusivamente para migraciones. Las credenciales sólo deben
   existir en variables del servidor.
3. Ejecuta:

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

4. Abre el SQL Editor y ejecuta
   `prisma/supabase-hardening.sql`. Este archivo mantiene RLS habilitado,
   autoriza al rol privado `nexo_backend` y revoca el acceso de los roles
   públicos de Supabase; todo acceso pasa por el backend.
5. Configura `APP_URL`, `SESSION_HASH_KEY` y SMTP.

No copies claves de base de datos al código ni uses variables con prefijo
`NEXT_PUBLIC_` para secretos.

### Inicio de sesión detenido por RLS

Si el servidor registra
`new row violates row-level security policy for table "auth_attempts"`, no
desactives RLS tabla por tabla. Ejecuta de nuevo
`prisma/supabase-hardening.sql` desde el rol `postgres` del SQL Editor. El
backend necesita `BYPASSRLS` porque la identidad y los permisos del usuario del
ERP se validan en Next.js, no mediante Supabase Auth dentro de PostgreSQL.

## Recuperación de contraseña

Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM`.
En desarrollo, `ALLOW_DEV_RESET_LINK=true` imprime el enlace en la consola. En
producción, el sistema exige SMTP y nunca devuelve el token al navegador.

## Registro verificado por correo

Configura `SELF_REGISTRATION_ENABLED=true` para mostrar y habilitar el flujo
`/register`. La cuenta no se crea en `users` hasta que el código de seis
dígitos enviado por correo se valida. El código sólo se conserva como HMAC,
vence en 10 minutos y se bloquea después de cinco errores.

Las cuentas autorregistradas reciben exclusivamente el rol `CASHIER`. El
administrador puede cambiar el rol posteriormente desde Usuarios; el navegador
nunca puede elegir privilegios. En producción configura
`REGISTRATION_ALLOWED_DOMAINS` con uno o más dominios separados por coma, o
deshabilita el registro.

Para comprobar el correo real sin crear usuarios ni tokens:

```bash
npm run email:test -- --to tu-correo@empresa.com
```

Si actualizas una base ya existente, aplica la nueva migración antes de probar
el registro y vuelve a ejecutar `prisma/supabase-hardening.sql` en Supabase:

```bash
npm run db:migrate
```

## Despliegue

El servidor debe ejecutar:

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run build
npm start
```

Requisitos de producción:

- HTTPS obligatorio; configura TLS 1.3 en el proxy o proveedor de hosting.
- `APP_URL` debe comenzar con `https://`.
- `SESSION_HASH_KEY` debe ser aleatoria y tener al menos 32 bytes.
- `ALLOW_DEV_RESET_LINK=false`.
- `REGISTRATION_ALLOWED_DOMAINS` limitado si el registro está habilitado.
- `SEED_DEMO_DATA=false`.
- La cuenta PostgreSQL usada por el backend no debe compartirse con clientes.
- Respaldos automáticos, monitoreo y rotación de credenciales.

Antes de liberar el dominio ejecuta:

```bash
npm run verify:production
```

El comando no imprime secretos; detiene la liberación si faltan HTTPS, SMTP,
SSL en PostgreSQL, clave de sesión segura o si siguen activos los modos de
desarrollo/demostración.

## Comandos de verificación

```bash
npm run typecheck
npm test
npm run build
npx prisma validate
```

## Documentación adicional

- [Arquitectura](docs/ARCHITECTURE.md)
- [Seguridad](docs/SECURITY.md)
- [Trazabilidad del SRD](docs/REQUIREMENTS_TRACEABILITY.md)
- [Lista de producción](docs/PRODUCTION_CHECKLIST.md)
