# NEXO ERP — Guia Completa del Sistema

> **Sistema cerrado**: Solo empleados autorizados. No hay acceso publico.
> Solo el rol **ADMIN** tiene acceso a la gestion de usuarios.

---

## Tabla de Contenidos

1. [Que es NEXO ERP](#1-que-es-nexo-erp)
2. [Seguridad y Encriptado](#2-seguridad-y-encriptado)
3. [Roles y Permisos](#3-roles-y-permisos)
4. [Ventanas del Sistema](#4-ventanas-del-sistema)
5. [Funcionalidad de Botones](#5-funcionalidad-de-botones)
6. [Datos de Prueba](#6-datos-de-prueba)
7. [Heuristicas de Nielsen](#7-heuristicas-de-nielsen)
8. [Correcciones Aplicadas](#8-correcciones-aplicadas)
9. [Paquetes y Llaves](#9-paquetes-y-llaves)
10. [Bateria de Pruebas](#10-bateria-de-pruebas)

---

## 1. Que es NEXO ERP

NEXO ERP es un sistema de gestion integral para cadena de suministros. Centraliza:
- **Inventario** (Almacén): Control de stock, kardex, conteos fisicos
- **Compras**: Ordenees de compra, proveedores, recepciones
- **Ventas/POS**: Punto de venta, tickets PDF, historial
- **Caja**: Apertura, arqueo, movimientos de efectivo

### Stack Tecnologico

| Capa | Tecnologia | Archivo clave |
|------|------------|---------------|
| Frontend | Next.js 15 + React 19 + Tailwind CSS 4 | `src/app/`, `src/components/` |
| Backend API | Next.js Route Handlers | `src/app/api/` |
| Base de datos | PostgreSQL + Prisma 6.19 | `prisma/schema.prisma` |
| Autenticacion | Sesiones propias (cookie httpOnly) | `src/lib/auth.ts` |
| Hashing | Argon2id (OWASP) | `src/lib/security.ts` |
| Pagos | Stripe (Checkout + Webhooks) | `src/app/api/stripe/` |
| Validacion | Zod 3.25 | `src/lib/validators.ts` |

---

## 2. Seguridad y Encriptado

### 2.1 Contrasenas

| Aspecto | Implementacion |
|---------|---------------|
| Algoritmo | **Argon2id** (recomendado por OWASP) |
| Parametros | `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1` |
| Politica | 10-128 caracteres, mayuscula, minuscula, numero, especial |
| Almacenamiento | Solo `passwordHash` — **nunca** texto plano |

### 2.2 Sesiones

| Aspecto | Implementacion |
|---------|---------------|
| Token | `randomBytes(32)` — 256 bits de entropia |
| En DB | Solo se guarda SHA-256 del token |
| Cookie | `httpOnly: true`, `secure: true` (prod), `sameSite: "lax"` |
| Duracion | 12 horas |
| Revocacion | `revokeCurrentSession()` marca `revokedAt` |

### 2.3 Proteccion CSRF

- `assertTrustedOrigin()` verifica que `Origin` coincida con `Host` en mutaciones (POST, PATCH, DELETE).

### 2.4 Rate Limiting

| Capa | Limite |
|------|--------|
| Login por IP | 25 fallos / 15 min |
| Login por cuenta | 5 fallos -> bloqueo 15 min |
| Registro por IP | 10 solicitudes / 15 min |

### 2.5 Login Timing-Safe

El login **siempre** ejecuta `verifyPassword()` aunque el usuario no exista (usa hash dummy), evitando ataques de timing.

### 2.6 Auditoria

Cada accion sensible se registra en `AuditLog` con: usuario, accion, entidad, IP hasheada (HMAC-SHA256), metadata.

---

## 3. Roles y Permisos

### 3.1 Los 4 Roles

| Rol | Que hace | Quien lo usa |
|-----|----------|-------------|
| **ADMIN** | Acceso total. Gestiona usuarios, config, todos los modulos | Gerente / IT |
| **WAREHOUSE** | Inventario, conteos, recepcion de compras | Personal de almacen |
| **BUYER** | Ordenes de compra, proveedores | Departamento de compras |
| **CASHIER** | POS, caja, ventas | Personal de caja/ventas |

### 3.2 Matriz de Permisos (que puede hacer cada rol)

| Que puede hacer | ADMIN | WAREHOUSE | BUYER | CASHIER |
|-----------------|:-----:|:---------:|:-----:|:-------:|
| Ver dashboard | Si | Si | Si | Si |
| Ver inventario | Si | Si | Si | No |
| Crear/editar productos | Si | Si | No | No |
| Hacer conteos fisicos | Si | Si | No | No |
| Ver compras | Si | Si | Si | No |
| Crear ordenes de compra | Si | No | Si | No |
| Recibir mercancia | Si | Si | No | No |
| Gestionar proveedores | Si | No | Si | No |
| Vender en POS | Si | No | No | Si |
| Ver historial de ventas | Si | No | No | Si |
| Manejar caja | Si | No | No | Si |
| Cambiar contrasenas | Si | No | No | No |
| Gestionar usuarios | Si | No | No | No |
| Configurar sistema | Si | No | No | No |
| Ver auditoria | Si | No | No | No |
| Reembolsos/cancelaciones | Si | No | No | No |
| Exportar compras | Si | No | Si | No |
| Exportar ventas | Si | No | No | No |
| Cambiar apariencia | Si | No | No | Si |

### 3.3 Control de Acceso en 3 Capas

```
Capa 1 - Navegacion (UI)
  El sidebar oculta modulos que el usuario no tiene permiso.
  Archivo: src/components/layout/app-shell.tsx (linea 167-173)

Capa 2 - Paginas (Server)
  Cada pagina verifica permiso antes de renderizar.
  Si no tiene permiso, retorna 404.
  Archivo: src/lib/page-auth.ts

Capa 3 - API (Backend)
  Cada endpoint verifica permiso con requirePermission().
  Si no tiene permiso, retorna error 403.
  Archivo: src/lib/auth.ts (linea 129-133)
```

> **Importante**: Ocultar un boton no es seguridad. La verificacion real ocurre en el servidor.

### 3.4 El Admin Cambia Roles de Usuarios

El admin puede cambiar el rol de cualquier usuario desde la pantalla `/users`:

1. Ve a **Usuarios** en el sidebar
2. En la tabla, cada usuario tiene un **selector de rol** debajo del badge
3. Selecciona el nuevo rol y se guarda automaticamente

**Protecciones**:
- El admin **no puede** cambiar su propio rol (evita degradacion accidental)
- El admin **no puede** dejarse sin permisos de administrador
- El admin **no puede** suspender su propia cuenta

---

## 4. Ventanas del Sistema

### 4.1 Login (`/login`)

**Que hace**: Permite ingresar al sistema.

| Elemento | Funcion |
|----------|---------|
| Campo email | Ingresa correo institucional |
| Campo contrasena | Ingresa contrasena (se puede mostrar/ocultar) |
| Boton "Entrar" | Valida credenciales, crea sesion |
| Link "Olvidaste tu contrasena?" | Redirige a `/forgot-password` |
| Mensaje | "Despues de 5 intentos fallidos, tu cuenta se bloqueara 15 minutos" |

### 4.2 Dashboard (`/dashboard`)

**Que hace**: Vista general de la operacion.

| Elemento | Que muestra |
|----------|-------------|
| Tarjeta "Ventas de hoy" | Total vendido hoy + numero de transacciones |
| Tarjeta "Ordenes pendientes" | Compras por recibir |
| Tarjeta "Stock bajo" | Productos por reabastecer |
| Tarjeta "Cajas abiertas" | Sesiones activas |
| Grafico de barras | Tendencia de ventas ultimos 7 dias |
| Ranking de productos | Top productos por rotacion |
| Alertas de inventario | Productos en nivel minimo |

> Cada metrica se muestra solo si el usuario tiene el permiso correspondiente.

### 4.3 Punto de Venta (`/pos`)

**Que hace**: Interfaz para cobrar ventas rapidamente.

| Elemento | Funcion |
|----------|---------|
| Barra de busqueda | Escanea codigo de barras o busca por nombre/SKU |
| Cuadricula de productos | Muestra productos con precio y stock |
| Carrito | Lista de articulos a vender |
| Botones +/- | Cambia cantidad de un producto |
| Boton papelera | Elimina producto del carrito |
| Selector moneda | MXN o USD con tipo de cambio |
| Boton "Descuento" | Aplica descuento global (limitado por rol) |
| Boton "Efectivo" | Selecciona pago en efectivo |
| Boton "Tarjeta" | Selecciona pago con tarjeta (solo MXN, usa Stripe) |
| Boton "Espera" | Guarda venta sin cobrar (HOLD) |
| Boton "Cobrar" | Completa la venta y descuenta inventario |
| Boton "Abrir ticket" | Genera ticket PDF |

### 4.4 Caja (`/cash`)

**Que hace**: Apertura, movimientos y cierre de caja.

| Elemento | Funcion |
|----------|---------|
| Selector de caja | Elige terminal fisica |
| Contador de denominaciones | Ingresa billetes/monedas |
| Boton "Abrir caja" | Crea sesion OPEN con fondo inicial |
| Boton "Registrar movimiento" | Entrada o retiro manual de efectivo |
| Boton "Cerrar caja" | Arqueo con conteo fisico y calculo de diferencia |
| Tabla de historial | Sesiones con fondo, conteo final, diferencia |

### 4.5 Historial de Ventas (`/sales`)

**Que hace**: Consulta de ventas pasadas.

| Elemento | Funcion |
|----------|---------|
| Tabla de ventas | Folio, estado, total, cajero, fecha |
| Boton "Ver detalle" | Muestra items y reembolsos |
| Boton "Reembolso" | Solo ADMIN — reintegra stock y efectivo |
| Boton "Cancelar" | Solo ADMIN — anula venta |
| Boton "Ticket" | Genera ticket PDF |
| Boton "Exportar" | Descarga CSV/PDF |

### 4.6 Inventario (`/inventory`)

**Que hace**: Catalogo de productos.

| Elemento | Funcion |
|----------|---------|
| Barra de busqueda | Filtra por nombre, SKU o codigo de barras |
| Boton "Nuevo producto" | Abre formulario (solo ADMIN y WAREHOUSE) |
| Boton "Editar" | Modifica producto existente |
| Tabla de productos | SKU, nombre, categoria, precio, stock, estado |
| Badge de stock | LOW (rojo) / HIGH / OK |

### 4.7 Kardex y Ajustes (`/inventory-movements`)

**Que hace**: Historial de movimientos de inventario.

| Elemento | Funcion |
|----------|---------|
| Filtros | Por producto, tipo de movimiento, fecha |
| Tabla de movimientos | Tipo, cantidad, stock antes/despues, usuario |
| Boton "Ajuste manual" | Crea ajuste con justificacion |

### 4.8 Conteos Fisicos (`/inventory-counts`)

**Que hace**: Auditoria fisica de inventario.

| Elemento | Funcion |
|----------|---------|
| Boton "Nuevo conteo" | Crea conteo DRAFT |
| Formulario | Cuenta por producto: sistema vs fisico |
| Boton "Iniciar" | Cambia a IN_PROGRESS |
| Boton "Completar" | Aplica diferencias al stock |

### 4.9 Compras (`/purchases`)

**Que hace**: Ordenees de compra a proveedores.

| Elemento | Funcion |
|----------|---------|
| Boton "Nueva orden" | Crea orden DRAFT |
| Selector de proveedor | Elige proveedor |
| Agregar items | Selecciona producto, cantidad, costo |
| Boton "Enviar" | Cambia estado a SENT |
| Boton "Recibir" | Registra recepcion con cantidades |

### 4.10 Proveedores (`/suppliers`)

**Que hace**: Directorio de proveedores.

| Elemento | Funcion |
|----------|---------|
| Boton "Nuevo proveedor" | Crea proveedor |
| Tabla | Codigo, razon social, contacto, condiciones |
| Boton "Editar" | Modifica datos |
| Productos del proveedor | Precios de referencia por producto |

### 4.11 Usuarios (`/users`) — Solo ADMIN

**Que hace**: Gestion de usuarios del sistema.

| Elemento | Funcion |
|----------|---------|
| Boton "Nuevo usuario" | Abre formulario de creacion |
| Campo nombre | Nombre completo |
| Campo email | Correo institucional |
| Selector de rol | ADMIN, WAREHOUSE, BUYER, CASHIER |
| Campo contrasena | Temporal con indicador de fortaleza |
| Boton "Crear usuario" | Crea el usuario |
| **Selector de rol en tabla** | **Cambia el rol de usuario existente** |
| Boton "Aprobar" | Activa cuenta PENDING_APPROVAL |
| Boton "Rechazar" | Rechaza solicitud |
| Boton "Suspender/Activar" | Alterna estado |
| Boton "Desbloquear" | Resetea bloqueo por intentos fallidos |

### 4.12 Auditoria (`/audit`) — Solo ADMIN

**Que hace**: Bitacora de acciones del sistema.

| Elemento | Funcion |
|----------|---------|
| Filtro de acciones | Busca por tipo (LOGIN, CREATED, etc.) |
| Tabla | Usuario, accion, entidad, fecha, IP hasheada |

### 4.13 Reportes (`/reports`)

**Que hace**: Exportacion de datos.

| Elemento | Funcion |
|----------|---------|
| Filtros de fecha | Desde / Hasta |
| Selector de proveedor | Filtra compras por proveedor |
| Boton "Exportar compras" | CSV/PDF (ADMIN y BUYER) |
| Boton "Exportar ventas" | CSV/PDF (ADMIN y CASHIER) |

### 4.14 Configuracion (`/settings`) — Solo ADMIN

**Que hace**: Configuracion general del negocio.

| Elemento | Funcion |
|----------|---------|
| Nombre del negocio | Se edita directamente |
| RFC / Tax ID | Identificacion fiscal |
| Moneda base | MXN o USD |
| Tasa de impuesto | Porcentaje default |
| Maximo descuento cajero | Limite porcentual |
| Pie de ticket | Texto libre |
| Boton "Guardar" | Actualiza configuracion |

### 4.15 Apariencia (`/settings/appearance`)

**Que hace**: Personalizacion visual.

| Elemento | Funcion |
|----------|---------|
| Color de acento | Selector de color |
| Estilo de sidebar | Dark/Light |
| Radio de bordes | sm/md/lg |
| Tamano de fuente | xs/sm/md/lg |
| Logo | Subir imagen |

---

## 5. Funcionalidad de Botones

### 5.1 Sidebar (Navegacion)

| Boton | Que hace |
|-------|----------|
| Cada enlace | Navega a la ruta (solo si tiene permiso) |
| Hamburguesa | Abre menu en movil |
| Colapsar | Contrae sidebar a iconos |
| Avatar | Abre modal para cambiar avatar |
| Clave | Abre modal para cambiar contrasena |
| Salir | Cierra sesion |
| Toggle tema | Cambia light/dark |

### 5.2 POS (Punto de Venta)

| Boton | Que hace | Validacion |
|-------|----------|-----------|
| Producto (cuadricula) | Agrega al carrito | Verifica stock > 0 y caja abierta |
| Enter en busqueda | Busca y agrega producto | Consulta API |
| +/- | Modifica cantidad | Elimina si cantidad = 0 |
| Papelera | Elimina linea | Filtra del carrito |
| Descuento | Abre modal | Verifica maximo por rol |
| Efectivo | Selecciona metodo | Sin validacion extra |
| Tarjeta | Selecciona metodo | Solo MXN, redirige Stripe |
| Espera | Guarda HOLD | POST /api/sales con mode HOLD |
| Cobrar | Completa venta | Valida monto >= total |
| Limpiar | Vacia carrito | Pide confirmacion |

### 5.3 Usuarios

| Boton | Que hace | Quien |
|-------|----------|-------|
| Crear usuario | Crea nuevo usuario | ADMIN |
| Cambiar rol (select) | Cambia rol de usuario existente | ADMIN |
| Aprobar | Activa cuenta pendiente | ADMIN |
| Rechazar | Rechaza solicitud | ADMIN |
| Suspender | Desactiva cuenta | ADMIN |
| Activar | Reactiva cuenta | ADMIN |
| Desbloquear | Quita bloqueo | ADMIN |

---

## 6. Datos de Prueba

Para probar el sistema, ejecuta:
```bash
SEED_DEMO_DATA=true npm run db:seed
```

### Usuarios de prueba

| Email | Contrasena | Rol | Que puede hacer |
|-------|-----------|-----|-----------------|
| `admin@nexo.local` | `Admin#2026Seguro` | ADMIN | Todo |
| `almacen@nexo.local` | `Test#2026Seguro` | WAREHOUSE | Inventario, conteos, recepciones |
| `compras@nexo.local` | `Test#2026Seguro` | BUYER | Ordenees de compra, proveedores |
| `cajero@nexo.local` | `Test#2026Seguro` | CASHIER | POS, caja, ventas |

### Productos de prueba (8 productos, 4 categorias)

| SKU | Nombre | Precio | Stock | Categoria |
|-----|--------|--------|-------|-----------|
| BEB-AGUA-600 | Agua natural 600 ml | $14.00 | 84 | Bebidas |
| BEB-ISO-500 | Bebida isotonica 500 ml | $29.00 | 16 | Bebidas |
| BEB-COC-355 | Coca-Cola 355 ml | $16.00 | 200 | Bebidas |
| SNK-BAR-045 | Barra de proteina 45 g | $38.00 | 42 | Snacks |
| SNK-CHI-050 | Papas fritas 50 g | $18.00 | 80 | Snacks |
| HIG-TOA-100 | Toallas desinfectantes 100 pzas | $79.00 | 10 | Higiene |
| ELEC-AUD-01 | Audifonos Bluetooth | $299.00 | 35 | Electronica |
| ELEC-CAR-01 | Cable USB-C 1m | $45.00 | 150 | Electronica |

### Proveedores de prueba (2 proveedores)

| Codigo | Nombre | Credito | Entrega |
|--------|--------|---------|---------|
| PROV-001 | Distribuidora Demo del Norte | 30 dias | 3 dias |
| PROV-002 | TechSupply Mexico | 15 dias | 5 dias |

### Caja de prueba

| Codigo | Nombre |
|--------|--------|
| CAJA-01 | Caja principal |

### Flujo de prueba recomendado

1. Ingresa como `admin@nexo.local`
2. Ve a **Usuarios** y verifica que puedes cambiar roles
3. Ve a **Inventario** y revisa los 8 productos
4. Ve a **Compras** y crea una orden al PROV-001
5. Ve a **Caja** y abre sesion en CAJA-01
6. Ve a **POS** y realiza una venta
7. Cierra la caja y verifica el arqueo
8. Ve a **Reportes** y exporta CSV

---

## 7. Heuristicas de Nielsen

### H1: Visibilidad del Estado del Sistema (8/10)

- Skeleton loaders en todas las vistas
- Badges de estado con colores (abierto/cerrado, activo/inactivo)
- Toast de exito/error en cada operacion
- Indicador de caja abierta en POS

### H2: Correspondencia Sistema-Mundo Real (9/10)

- Terminos en espanol (Cajero, Almacenista, Comprador)
- Iconos intuitivos de Lucide
- Moneda con formato MXN localizado
- Flujo de POS similar a sistema fisico

### H3: Control y Libertad del Usuario (8/10)

- Boton "Volver" en formularios
- Confirmacion antes de acciones destructivas
- Venta en espera (HOLD) permite pausar
- Escape cierra drawer movil

### H4: Consistencia y Estandares (9/10)

- Design system uniforme (card, btn, field, badge)
- Paleta de colores CSS variables
- Misma tipografia en toda la app
- Botones primarios/secundaries/danger consistentes

### H5: Prevencion de Errores (8/10)

- Validacion Zod en todos los endpoints
- Confirmacion antes de cerrar caja
- Campos deshabilitados cuando no aplica
- Politica de contrasena visible

### H6: Reconocimiento vs Recall (7/10)

- Navegacion visible y agrupada
- Productos en cuadricula con info
- Carrito siempre visible durante venta
- Podria mejorar con tooltips

### H7: Flexibilidad y Eficiencia (7/10)

- Enter para escanear en POS
- Sidebar colapsable para usuarios expertos
- Busqueda rapida de productos
- Podria agregar atajos de teclado

### H8: Estetica Minimalista (8/10)

- Diseno limpio sin elementos redundantes
- Espaciado consistente
- Jerarquia visual clara
- Sin sobrecarga informativa

### H9: Ayuda con Errores (8/10)

- Mensajes claros y en espanol
- Errores por campo (Zod)
- Bloqueo temporal informativo
- Banner de caja no abierta

### H10: Ayuda y Documentacion (7/10)

- Descripciones en PageHeader de cada vista
- Textos orientativos en formularios
- EmptyState con sugerencias
- Podria agregar tooltips

### Promedio: 7.9/10

---

## 8. Correcciones Aplicadas

### 8.1 Sistema Cerrado (vs SRD)

| Archivo | Error | Correccion |
|---------|-------|-----------|
| `.env` | `SELF_REGISTRATION_ENABLED="true"` | `"false"` |
| `src/lib/registration.ts` | Default `true` en dev | Default `false` siempre |
| `src/app/page.tsx` | Landing page de marketing | Redirige a `/login` |
| `src/app/(auth)/login/page.tsx` | Link "Crear cuenta" visible | `registrationEnabled={false}` |

### 8.2 Permisos Corregidos

| Archivo | Error | Correccion |
|---------|-------|-----------|
| `src/app/(erp)/reports/page.tsx` | Requeria `purchases.export` (bloqueaba CASHIER) | Ahora acepta `purchases.export` O `sales.export` |
| `src/app/api/stripe/status/[id]/route.ts` | Requeria `sales.create` (bloqueaba CASHIER) | Ahora usa `pos.sell` |
| `src/app/api/settings/logo/route.ts` | `requirePermission` duplicado | Eliminada la segunda llamada |

### 8.3 Funcionalidad Admin Corregida

| Archivo | Error | Correccion |
|---------|-------|-----------|
| `src/components/users/users-view.tsx` | Sin selector de rol para usuarios existentes | Agregado `<select>` de rol en cada fila |
| `src/app/api/users/[id]/route.ts` | Admin podia degradarse a si mismo | Bloqueado: "No puedes cambiar tu propio rol" |

### 8.4 Otros Fixes

| Archivo | Error | Correccion |
|---------|-------|-----------|
| `src/__tests__/stripe.test.ts` | Typo `okey` al inicio | Eliminado |
| `src/lib/page-auth.ts` | Sin `requireAnyPagePermission` | Funcion agregada |

---

## 9. Paquetes y Llaves

### 9.1 Dependencias Principales

| Paquete | Para que sirve |
|---------|---------------|
| `next` 15.5 | Framework fullstack |
| `react` 19.1 | UI |
| `@prisma/client` 6.19 | ORM (base de datos) |
| `argon2` 0.44 | Hashing de contrasenas |
| `zod` 3.25 | Validacion de datos |
| `stripe` 22.4 | Pagos con tarjeta |
| `nodemailer` 9.0 | Envio de emails |
| `pdfkit` 0.17 | Generacion de PDFs |
| `lucide-react` 0.468 | Iconos |
| `vitest` 3.2 | Testing |

### 9.2 Variables de Entorno

| Variable | Para que sirve | Seguridad |
|----------|---------------|-----------|
| `DATABASE_URL` | Conexion a PostgreSQL | Secret |
| `SESSION_HASH_KEY` | HMAC para tokens e IPs | **Obligatoria en produccion** |
| `SMTP_*` | Configuracion de correo | Secret |
| `STRIPE_SECRET_KEY` | Llave secreta de Stripe | Secret |
| `SELF_REGISTRATION_ENABLED` | Habilita registro publico | `"false"` en sistema cerrado |

---

## 10. Bateria de Pruebas

### 10.1 Comandos

```bash
npm run test          # Ejecuta todas las pruebas
npm run typecheck     # Verifica tipos TypeScript
npm run lint          # Verifica codigo
npm run verify:production  # Verificacion de produccion
```

### 10.2 Resultados

| Prueba | Estado |
|--------|--------|
| `cash-denominations.test.ts` (3 tests) | PASA |
| `registration.test.ts` (3 tests) | PASA |
| `stripe.test.ts` (3 tests) | PASA |
| `permissions.test.ts` (4 tests) | PASA |
| `money.test.ts` (3 tests) | PASA |
| `security.test.ts` (11 tests) | PASA |
| `validators.test.ts` (3 tests) | PASA |
| **Total: 30/30** | **PASA** |

### 10.3 Estructura de Archivos

```
src/
├── app/
│   ├── (auth)/           # Login, register, forgot-password
│   ├── (erp)/            # Todas las vistas del ERP
│   │   ├── dashboard/    # Resumen operativo
│   │   ├── pos/          # Punto de venta
│   │   ├── cash/         # Caja y arqueos
│   │   ├── sales/        # Historial de ventas
│   │   ├── inventory/    # Catalogo de productos
│   │   ├── inventory-movements/  # Kardex
│   │   ├── inventory-counts/     # Conteos fisicos
│   │   ├── purchases/    # Ordenees de compra
│   │   ├── suppliers/    # Proveedores
│   │   ├── reports/      # Exportaciones
│   │   ├── users/        # Gestion (solo ADMIN)
│   │   ├── audit/        # Bitacora (solo ADMIN)
│   │   └── settings/     # Config (solo ADMIN)
│   ├── api/              # Todos los endpoints REST
│   └── layout.tsx        # Layout raiz
├── components/
│   ├── auth/             # Login, Register, PasswordStrength
│   ├── layout/           # AppShell, UserContext, ThemeContext
│   ├── ui/               # Componentes reutilizables
│   └── [modulos]/        # Vista de cada modulo
├── lib/
│   ├── auth.ts           # Sesiones y autenticacion
│   ├── security.ts       # Hashing, tokens, validacion
│   ├── permissions.ts    # RBAC por rol (22 permisos)
│   ├── page-auth.ts      # Proteccion de paginas
│   ├── api.ts            # Respuestas API estandarizadas
│   ├── audit.ts          # Bitacora de auditoria
│   ├── validators.ts     # Esquemas Zod
│   └── client-api.ts     # fetch wrapper
├── services/
│   └── sales.ts          # Logica de negocio de ventas
└── middleware.ts          # HTTPS, cache headers
```
