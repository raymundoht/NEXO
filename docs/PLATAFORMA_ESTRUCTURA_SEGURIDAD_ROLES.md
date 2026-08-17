# Manual Técnico de Estructura, Seguridad, Cifrado, Roles y Ventanas: Nexo ERP

Este documento ofrece un estudio profundo y completo de la arquitectura, encriptación, seguridad criptográfica, matriz de permisos por rol, catálogo explicativo de ventanas, paquetes de red y evaluación de las **10 Heurísticas de Usabilidad de Jakob Nielsen** para la plataforma **Nexo ERP**.

---

## 1. Filosofía de Sistema de Empresa Cerrada

Nexo ERP está diseñado bajo un modelo de **seguridad perimetral y acceso estricto de empresa cerrada**:
- **Sin auto-registro público**: La opción de auto-registro está desactivada por defecto (`SELF_REGISTRATION_ENABLED=false`). No existe la posibilidad de que usuarios externos o no autorizados creen cuentas desde la web.
- **Administración centralizada de identidades**: Únicamente los usuarios pertenecientes al rol `ADMIN` (Administrador) tienen acceso al módulo `/users` para dar de alta, editar roles, desbloquear o suspender cuentas de personal.
- **Acceso autenticado obligatorio**: Todas las vistas operativas (`/dashboard`, `/pos`, `/inventory`, `/purchases`, `/sales`, `/users`, etc.) están protegidas en el servidor por el middleware de autenticación y funciones de control de acceso perimetral (`requirePagePermission`).

---

## 2. Arquitectura de Seguridad y Encriptación

### 2.1. Cifrado de Contraseñas (Argon2id)
El almacenamiento de credenciales no utiliza algoritmos obsoletos como MD5 o SHA-1 ni hashing simple. Se implementa el algoritmo **Argon2id** (ganador del Password Hashing Competition):
- **Parámetros de Costo**:
  - `memoryCost`: 19,456 KiB (~19.4 MB de memoria RAM por intento).
  - `timeCost`: 2 iteraciones.
  - `parallelism`: 1 hilo.
- **Protección**: Resiste ataques con aceleración hardware en GPU/ASIC y ataques de canal lateral gracias a la combinación de Argon2d y Argon2i.

### 2.2. Manejo de Sesiones y Tokens SHA-256
- **Generación de Token**: Al iniciar sesión, el servidor genera una cadena aleatoria criptográfica de 32 bytes de alta entropía codificada en Base64URL (`generateSecureToken`).
- **Almacenamiento del Token**: El token en texto plano nunca se almacena en la base de datos. Se genera su hash unidireccional utilizando **SHA-256** (`tokenHash`) y solo este hash se guarda en la tabla `sessions`.
- **Cookie de Sesión Segura**:
  - `httpOnly: true`: Impide el acceso a la cookie mediante scripts JS en el cliente (mitigación XSS).
  - `secure: true` (en producción): Exige transmisión exclusiva bajo HTTPS.
  - `sameSite: "lax"`: Previene ataques CSRF en navegaciones entre sitios.
  - Expiración predeterminada: 12 horas con actualización de `lastSeenAt` cada 5 minutos.

### 2.3. Protección CSRF y Encabezados de Red
- **Verificación de Origen (`assertTrustedOrigin`)**: Toda petición HTTP de mutación (`POST`, `PUT`, `PATCH`, `DELETE`) valida que el encabezado `origin` coincida exactamente con el `host` / `x-forwarded-host` de la solicitud. Si no coinciden o están ausentes, la API responde con un error HTTP `403 CSRF_BLOCKED`.
- **Cache-Control**: En el middleware (`src/middleware.ts`), todas las rutas bajo `/api/` agregan automáticamente la cabecera `Cache-Control: no-store` para evitar la fuga de datos confidenciales en cachés intermedios o del navegador.

### 2.4. Control de Intentos de Acceso y Bloqueo Temporal
- **Protección Brute-Force**: Tras 5 intentos fallidos consecutivos de inicio de sesión (`failedLoginAttempts >= 5`), la cuenta entra en estado bloqueado por 15 minutos (`lockedUntil`).
- **Anonimización de IP**: La IP del cliente se procesa a través de un hash digest con HMAC-SHA256 (`hashIdentifier`), evitando registrar direcciones IP puras para cumplir con normativas de protección de datos personales.

---

## 3. Matriz Definitiva de Roles y Permisos (RBAC)

Nexo ERP cuenta con 4 roles bien estructurados: `ADMIN`, `WAREHOUSE`, `BUYER` y `CASHIER`.

| Permiso | Descripción | ADMIN | WAREHOUSE (Almacén) | BUYER (Compras) | CASHIER (Caja) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `dashboard.read` | Ver panel de métricas y resumen | **Sí** | **Sí** | **Sí** | **Sí** |
| `inventory.read` | Ver catálogo de productos y existencias | **Sí** | **Sí** | **Sí** | No |
| `inventory.write` | Crear/editar productos y ajustar stock | **Sí** | **Sí** | No | No |
| `inventory.audit` | Realizar y cerrar conteos físicos de inventario | **Sí** | **Sí** | No | No |
| `purchases.read` | Consultar órdenes de compra | **Sí** | **Sí** | **Sí** | No |
| `purchases.write` | Crear y emitir nuevas órdenes de compra | **Sí** | No | **Sí** | No |
| `purchases.receive` | Registrar entrada física de mercancía al almacén | **Sí** | **Sí** | No | No |
| `suppliers.manage` | Crear y gestionar expediente de proveedores | **Sí** | No | **Sí** | No |
| `pos.sell` | Operar la terminal de punto de venta | **Sí** | No | No | **Sí** |
| `sales.read` | Consultar historial de ventas | **Sí** | No | No | **Sí** |
| `sales.create` | Crear registros de ventas | **Sí** | No | No | **Sí** |
| `sales.manage` | Mantener en espera / pausar ventas | **Sí** | No | No | **Sí** |
| `sales.refund` | Aprobar y procesar reembolsos / devoluciones | **Sí** | No | No | No |
| `sales.cancel` | Cancelar ventas emitidas | **Sí** | No | No | No |
| `cash.manage` | Abrir/cerrar caja y registrar ingresos/retiros | **Sí** | No | No | **Sí** |
| `users.manage` | Crear, editar y administrar usuarios y roles | **Sí** | No | No | No |
| `settings.manage` | Modificar datos fiscales e identidad del negocio | **Sí** | No | No | No |
| `settings.appearance` | Personalizar tema visual y colores del sistema | **Sí** | No | No | **Sí** |
| `audit.read` | Ver bitácora inmutable de auditoría del sistema | **Sí** | No | No | No |
| `purchases.export` | Exportar reportes de compras en CSV/Excel/PDF | **Sí** | No | **Sí** | No |
| `sales.export` | Exportar reportes de ventas y finanzas | **Sí** | No | No | No |

---

## 4. Catálogo Completo de Ventanas, Roles y Funcionalidad de Botones

### 4.1. Pantalla de Acceso (`/login`)
- **Roles autorizados**: Público no autenticado. Si el usuario ya inició sesión, es redirigido automáticamente al `/dashboard`.
- **Elementos Visuales**: Formulario de credenciales (correo y contraseña), botón de alternar visibilidad de clave (icono ojo), aviso preventivo de intentos fallidos.
- **Botones y Acciones**:
  - `Entrar al sistema`: Valida campos client-side, envía petición `POST /api/auth/login`. Mientras procesa, desactiva el botón y muestra el estado "Verificando…".
  - `¿La olvidaste?`: Redirige al flujo de recuperación `/forgot-password`.

### 4.2. Panel Principal (`/dashboard`)
- **Roles autorizados**: `ADMIN`, `WAREHOUSE`, `BUYER`, `CASHIER`.
- **Elementos Visuales**: Tarjetas KPI de ventas del día, alertas de bajo stock, resumen de órdenes pendientes, accesos directos por rol.
- **Botones y Acciones**:
  - `Ir al Punto de Venta`: Redirige a `/pos` (Cajeros y Admins).
  - `Registrar Recepción`: Redirige a `/purchases` (Almacén y Compras).

### 4.3. Punto de Venta (`/pos`)
- **Roles autorizados**: `ADMIN`, `CASHIER`.
- **Elementos Visuales**: Buscador en tiempo real por SKU/código de barras, rejilla de productos con imágenes/avatares, carrito de compra interactivo, modal de cobro con cálculo automático de cambio en efectivo o integración con tarjeta Stripe.
- **Botones y Acciones**:
  - `F2 Buscar`: Enfoca automáticamente el buscador de productos.
  - `F4 Cobrar`: Abre el modal de pago.
  - `Pausar Venta`: Guarda el carrito en estado `HELD` para liberarlo posteriormente.
  - `Cancelar Venta en Curso`: Limpia la lista de artículos previa confirmación.
  - `Completar Venta`: Envía payload `POST /api/pos/checkout` con transacción atómica en base de datos.

### 4.4. Gestión de Caja y Cortes (`/cash`)
- **Roles autorizados**: `ADMIN`, `CASHIER`.
- **Elementos Visuales**: Desglose de denominaciones de billetes y monedas (MXN/USD), historial de movimientos (ingresos/retiros), indicador de sesión de caja activa/cerrada.
- **Botones y Acciones**:
  - `Abrir Caja`: Registra el monto inicial de apertura.
  - `Registrar Entrada/Salida`: Permite ingresar u obtener efectivo argumentando una justificación.
  - `Realizar Corte de Caja`: Calcula la diferencia entre el efectivo contado y el esperado en sistema.

### 4.5. Catálogo de Inventario (`/inventory`)
- **Roles autorizados**: `ADMIN`, `WAREHOUSE`, `BUYER` (Solo lectura).
- **Elementos Visuales**: Tabla paginada de productos con badge de estado, costo, precio de venta, margen de utilidad, existencias actuales y mínimo deseado.
- **Botones y Acciones**:
  - `+ Nuevo Producto`: Abre modal de creación con validaciones Zod (Costo, Precio, IVA, SKU único).
  - `Editar / Ajustar Stock`: Muestra formulario para modificar precios o registrar entrada/salida manual con justificación obligatoria.

### 4.6. Conteos Físicos de Inventario (`/inventory-counts`)
- **Roles autorizados**: `ADMIN`, `WAREHOUSE`.
- **Elementos Visuales**: Formulario de captura para auditoría física de pasillos/estantes. Muestra diferencia entre inventario en sistema y el físico contado.
- **Botones y Acciones**:
  - `Iniciar Conteo`: Genera una orden de conteo en borrador.
  - `Aplicar Ajuste de Conteo`: Transacciona y actualiza existencias oficiales en el sistema.

### 4.7. Movimientos e Historial de Stock (`/inventory-movements`)
- **Roles autorizados**: `ADMIN`, `WAREHOUSE`.
- **Elementos Visuales**: Kardex de movimientos de inventario con tipo de movimiento (`PURCHASE_RECEIPT`, `SALE`, `REFUND`, `MANUAL_ADJUSTMENT`), usuario responsable y existencias antes/después.

### 4.8. Compras y Recepción (`/purchases`)
- **Roles autorizados**: `ADMIN`, `BUYER` (Crear órdenes), `WAREHOUSE` (Recibir mercancía).
- **Elementos Visuales**: Módulo de órdenes de compra a proveedores. Formulario con adición dinámica de productos, cálculo automático de impuestos y costos totales.
- **Botones y Acciones**:
  - `Crear Órden de Compra`: Emite documento en estado `DRAFT` o `SENT`.
  - `Recibir Mercancía`: (Solo Almacén/Admin) Abre pantalla para verificar cantidades recibidas físicamente e incrementar existencias en sistema.

### 4.9. Directorio de Proveedores (`/suppliers`)
- **Roles autorizados**: `ADMIN`, `BUYER`.
- **Elementos Visuales**: Directorio comercial con Razón Social, RFC, Días de crédito, Límite de crédito y datos de contacto del ejecutivo asignado.

### 4.10. Historial de Ventas y Reembolsos (`/sales`)
- **Roles autorizados**: `ADMIN`, `CASHIER` (Solo lectura).
- **Elementos Visuales**: Lista de ticket/folios emitidos, método de pago usado (Efectivo/Tarjeta), cajero emisor y estado de venta (`COMPLETED`, `REFUNDED`, `CANCELLED`).
- **Botones y Acciones**:
  - `Ver Ticket`: Abre vista imprimible/PDF del comprobante.
  - `Solicitar Reembolso`: (Exclusivo Admin) Abre modal de autorización para devolver dinero y reintegrar inventario automáticamente.

### 4.11. Usuarios y Control de Accesos (`/users`) *(Exclusivo ADMIN)*
- **Roles autorizados**: Únicamente `ADMIN`.
- **Elementos Visuales**: Tabla de colaboradores registrados con badge de rol (`ADMIN`, `WAREHOUSE`, `BUYER`, `CASHIER`), estado de cuenta (`ACTIVE`, `SUSPENDED`, `LOCKED`), fecha de último acceso y botón de acciones.
- **Botones y Acciones**:
  - `+ Crear Usuario`: Abre modal para dar de alta nuevo personal asignándole nombre, correo institucional, rol y contraseña inicial.
  - `Editar Rol / Estado`: Permite promover, reasignar áreas o suspender cuentas.
  - `Desbloquear Cuenta`: Limpia el bloqueo temporal de 15 minutos en caso de olvido de clave.

### 4.12. Bitácora de Auditoría (`/audit`) *(Exclusivo ADMIN)*
- **Roles autorizados**: Únicamente `ADMIN`.
- **Elementos Visuales**: Registro inmutable de eventos de seguridad (Inicios de sesión, creación de usuarios, ajustes de inventario, cobros Stripe, cancelaciones).

---

## 5. Cumplimiento de las 10 Heurísticas de Usabilidad de Nielsen

### H1: Visibilidad del Estado del Sistema
- Los botones de acción (`Entrar`, `Guardar`, `Completar Venta`, `Abrir Caja`) cambian inmediatamente su texto y muestran spinners o estados inhabilitados (`disabled={loading}`) para informar que el servidor está procesando la solicitud.
- Los badges de colores especifican visualmente el estado del producto (Verde: Activo, Rojo: Inactivo/Bajo Stock), ventas (Verde: Completada, Amarillo: En espera) y usuarios (Azul: Activo, Rojo: Suspendido).

### H2: Coincidencia entre el Sistema y el Mundo Real
- Utilización de terminología contable e industrial estándar de la región: *RFC, Folio, SKU, Código de barras, Corte de caja, Proveedores, Kardex*.
- Moneda presentada en formato nativo `$1,250.00 MXN` con dos decimales y alineación contable a la derecha.

### H3: Control y Libertad del Usuario
- Todos los modales y cuadros de diálogo flotantes incluyen un botón de cierre `✕` o acción explícita de `Cancelar`.
- El Punto de Venta permite pausar una venta (`HOLD`) para atender a otro cliente y reanudarla posteriormente sin perder la captura.

### H4: Consistencia y Estándares
- Sistema de diseño unificado (`NEXO Design System`) con paletas HSL adaptables a Modo Claro y Modo Oscuro.
- La navegación secundaria y la estructura de encabezados se mantienen idénticas en todos los módulos operacionales.

### H5: Prevención de Errores
- Exigencia de política de contraseñas fuertes desde el cliente y el servidor mediante validación con esquemas **Zod**.
- Los botones de acciones destructivas (suspender usuarios, cancelar ventas) están protegidos mediante modales de confirmación explícita.
- El servidor bloquea ventas si el stock actual es insuficiente y el producto no tiene habilitada la opción de existencias negativas.

### H6: Reconocimiento antes que Recuerdo
- Búsqueda con autocompletado en POS e Inventario que permite encontrar productos escribiendo su nombre, categoría o escaneando el código de barras sin necesidad de memorizar claves internas.
- Selector visual de avatares para usuarios (`AvatarPicker`).

### H7: Flexibilidad y Eficiencia de Uso
- Atajos de teclado en el Punto de Venta: `F2` para enfocar la búsqueda de productos, `F4` para iniciar la ventana de cobro y `Enter` para finalizar la transacción en segundos.

### H8: Diseño Estético y Minimalista
- Interfaces limpias con glassmorphism sutil, tipografía legible Poppins/Inter y jerarquía de contraste visual. Se elimina el desorden en pantalla concentrando los controles en barras de herramientas.

### H9: Ayudar a los Usuarios a Reconocer, Diagnosticar y Recuperarse de Errores
- Todos los errores de API retornan respuestas estandarizadas `ApiError` con explicaciones claras en español (ej. *"El correo no está registrado"*, *"Espera 45 segundos antes de solicitar otro código"*, *"No puedes suspender tu propia cuenta"*), evitando tracebacks crudos de código.

### H10: Ayuda y Documentación
- Tooltips flotantes explicativos en campos complejos y este manual completo de arquitectura y operación para capacitación de personal.

---

## 6. Verificación Automatizada y Batería de Pruebas

El sistema cuenta con **42 pruebas automatizadas** ejecutables mediante `npm test` que garantizan la solidez del software:

```bash
> nexo-erp@1.0.0 test
> vitest run

 RUN  v3.2.7 /Users/raymundoherrera/Desktop/Copia de Nexo-ERP-completo 2

 ✓ src/lib/cash-denominations.test.ts (3 tests)
 ✓ src/lib/registration.test.ts (3 tests)
 ✓ src/__tests__/stripe.test.ts (3 tests)
 ✓ src/lib/money.test.ts (3 tests)
 ✓ src/lib/validators.test.ts (3 tests)
 ✓ src/lib/security.test.ts (11 tests)
 ✓ src/__tests__/nielsen-heuristics-and-rbac.test.ts (12 tests)
 ✓ src/lib/permissions.test.ts (4 tests)

 Test Files  8 passed (8)
      Tests  42 passed (42)
```

### Resumen del Cumplimiento Técnico
1. **Seguridad Perimetral**: 100% verificado para entornos corporativos cerrados.
2. **Encriptación**: Argon2id + SHA-256 + HMAC-SHA256 validados.
3. **Roles y Permisos**: Aislamiento estricto verificado para Admin, Almacén, Compras y Caja.
4. **UX/UI**: Evaluación completa de las 10 Heurísticas de Usabilidad de Nielsen.
