# Lista de salida a producción

## 1. Secretos y base de datos

- Rotar las credenciales PostgreSQL que se hayan compartido fuera del panel.
- Usar `DATABASE_URL` con Transaction Pooler, SSL, `pgbouncer=true` y límite de conexiones.
- Reservar `DIRECT_URL` para migraciones.
- Generar una nueva `SESSION_HASH_KEY` de al menos 32 bytes.
- Ejecutar `prisma/supabase-hardening.sql` desde el SQL Editor.
- Confirmar que `anon` y `authenticated` no pueden leer `users`.

## 2. Recuperación de acceso

- Configurar SMTP con una cuenta exclusiva de envío.
- Establecer `ALLOW_DEV_RESET_LINK=false`.
- Solicitar un restablecimiento real y confirmar recepción, vencimiento a 30 minutos y uso único.
- Ejecutar `npm run email:test -- --to correo@empresa.com`.
- Aplicar la migración de `registration_verifications` y repetir el hardening.
- Decidir si `SELF_REGISTRATION_ENABLED` estará activo; si lo está, limitar
  `REGISTRATION_ALLOWED_DOMAINS`.
- Probar registro, código correcto, código incorrecto, reenvío y acceso con el
  rol inicial Cajero/Vendedor.

## 3. Hosting y TLS

- Publicar detrás de un proxy o proveedor con HTTPS obligatorio y TLS 1.3.
- Configurar `APP_URL=https://...`.
- Confirmar redirección HTTP a HTTPS, cookie `Secure` y encabezado HSTS.
- Ejecutar:

```bash
npm run verify:production
```

## 4. Pruebas de aceptación

- Chrome, Firefox, Edge y Safari.
- Escritorio y tableta táctil.
- Login correcto, cinco fallos y desbloqueo a los 15 minutos.
- Recuperación por correo.
- Producto, alerta, ajuste y conteo físico.
- Orden desde faltantes y recepción exacta.
- Venta en efectivo, tarjeta, espera, ticket, reembolso y cancelación.
- Apertura y cierre con denominaciones.
- Exportaciones CSV/PDF con partidas.

## 5. Operación

- Respaldos automáticos y prueba de restauración.
- Monitoreo de errores y disponibilidad.
- Rotación periódica de credenciales.
- Usuario administrador nominal y cuentas separadas por empleado.
- `SEED_DEMO_DATA=false` y datos de ejemplo eliminados.
