# Seguridad

## Credenciales

- Contraseñas de 10 a 128 caracteres.
- Requieren mayúscula, minúscula, número y símbolo.
- Hash Argon2id con salt único.
- Nunca se almacenan ni envían contraseñas en texto plano.
- Cinco fallos dentro de 15 minutos bloquean la cuenta durante 15 minutos.
- Existe un límite adicional por IP anonimizada.

## Sesiones

- Token aleatorio de 256 bits.
- En base de datos sólo se almacena SHA-256 del token.
- Cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción.
- Vigencia de 12 horas y revocación al cerrar sesión.
- Cambiar o restablecer contraseña revoca todas las sesiones del usuario.

## Recuperación

- Token criptográfico de 256 bits.
- Sólo se almacena su hash.
- Vigencia de 30 minutos y uso único.
- La respuesta es genérica para no revelar si el correo existe.
- El enlace sólo se envía por SMTP en producción.
- Antes de emitir tokens se comprueba que SMTP esté disponible; un fallo de
  entrega invalida el token recién creado.

## Registro y verificación de correo

- El registro conserva la solicitud en una tabla separada; no crea un usuario
  activo antes de verificar el correo.
- Código numérico de seis dígitos, HMAC con secreto del servidor, vigencia de
  10 minutos, cinco intentos y espera de 60 segundos para reenvío.
- La contraseña pendiente ya está protegida con Argon2id; nunca se almacena en
  texto plano ni se envía por correo.
- El rol se fija en el servidor como Cajero/Vendedor. El cliente no puede
  solicitar administrador, almacenista o comprador.
- El registro puede deshabilitarse y limitarse por dominios mediante variables
  del servidor.

## Autorización

| Capacidad | Admin | Almacén | Compras | Cajero |
| --- | ---: | ---: | ---: | ---: |
| Usuarios y configuración | Sí | No | No | No |
| Inventario y conteos | Sí | Sí | Consulta | No |
| Emitir órdenes | Sí | No | Sí | No |
| Recibir compras | Sí | Sí | No | No |
| POS y caja | Sí | No | No | Sí |
| Reembolsos | Sí | No | No | No |
| Auditoría | Sí | No | No | No |

La navegación oculta módulos no autorizados y el backend vuelve a comprobar
cada permiso. Ocultar un botón no se considera una medida de seguridad.

## Aplicación y transporte

- Todas las mutaciones verifican el encabezado `Origin`.
- Cabeceras CSP, `X-Frame-Options`, `nosniff`, política de permisos y
  referencia restrictiva.
- HSTS y redirección a HTTPS en producción.
- TLS 1.3 debe configurarse en el proxy o proveedor.
- Las entradas se validan con límites de longitud y tipo.
- CSV aplica mitigación de inyección de fórmulas.
- Los errores de producción no exponen consultas ni stack traces.

## Datos de tarjeta

Se guarda únicamente el código de autorización devuelto por la terminal. No
existen columnas para PAN, CVV, banda magnética, PIN ni fecha de vencimiento.
La captura real del pago se realiza en el dispositivo bancario externo.

## Base de datos

- Claves foráneas y restricciones `CHECK`.
- Índices únicos para sesiones de caja abiertas.
- RLS permanece habilitado en las tablas del esquema `public`.
- Los roles públicos `anon` y `authenticated` no tienen privilegios sobre las
  tablas, secuencias ni funciones del ERP.
- El rol privado `nexo_backend` usa `BYPASSRLS` porque la aplicación se conecta
  desde un servidor de confianza y aplica RBAC en cada Route Handler. Ese rol
  no es superusuario y no puede crear bases, roles ni replicaciones.
- El rol `prisma` se reserva para migraciones; el tráfico normal nunca debe
  usar sus credenciales.
- Operaciones críticas atómicas y serializables.
- Kardex y bitácora conservan el usuario y la referencia de cada operación.

Antes de producción se recomienda agregar monitoreo de errores, alertas,
respaldos probados, rotación de secretos, escaneo de dependencias y pruebas de
penetración.
