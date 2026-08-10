# Arquitectura de NEXO ERP

## Capas

1. **Interfaz web**: páginas responsivas para escritorio, tableta y POS táctil.
2. **API del servidor**: Route Handlers de Next.js con validación Zod.
3. **Servicios de dominio**: ventas y reglas financieras independientes de UI.
4. **Persistencia**: Prisma y PostgreSQL con transacciones serializables.
5. **Infraestructura**: HTTPS, SMTP y alojamiento PostgreSQL.

El navegador nunca se conecta directamente a PostgreSQL. Todas las mutaciones
requieren sesión, permiso y origen válido.

## Entidades principales

- Seguridad: `User`, `Session`, `PasswordResetToken`, `AuthAttempt`,
  `RegistrationVerification`, `AuditLog`.
- Inventario: `Category`, `Product`, `StockMovement`, `InventoryCount`.
- Compras: `Supplier`, `SupplierProduct`, `PurchaseOrder`,
  `PurchaseReceipt`.
- Ventas: `Sale`, `SaleItem`, `Refund`, `RefundItem`.
- Caja: `CashRegister`, `CashSession`, `CashMovement`.
- Configuración: `BusinessSettings`, `DocumentSequence`.

## Flujos transaccionales

### Registro verificado

1. Valida nombre, correo y política de contraseña en el servidor.
2. Protege la contraseña con Argon2id y guarda la solicitud fuera de `users`.
3. Envía un código de seis dígitos cuyo HMAC es el único valor persistido.
4. Comprueba vencimiento, intentos y coincidencia en tiempo constante.
5. Consume la solicitud y crea el usuario Cajero/Vendedor en una transacción
   serializable.

El rol nunca llega desde el navegador y una solicitud sin verificar no puede
crear sesiones ni consultar módulos del ERP.

### Recepción de compra

1. Valida que la orden esté enviada o parcialmente recibida.
2. Comprueba que cantidad y costo coincidan con lo pendiente.
3. Genera la recepción y actualiza la partida.
4. Incrementa existencias y recalcula costo promedio.
5. Inserta el movimiento de kardex.
6. Actualiza el precio de referencia del proveedor.
7. Cambia el estado de la orden.

Todo ocurre dentro de una transacción serializable. Si una validación falla, no
se guarda ninguna parte.

### Venta

1. Obtiene productos, precios e impuestos desde la base.
2. Recalcula partidas y descuento en el servidor.
3. Verifica el límite de descuento del rol cajero.
4. Valida sesión de caja y forma de pago.
5. Crea la venta y sus partidas.
6. Descuenta existencias con control optimista.
7. Inserta movimientos de inventario y efectivo.

Una venta en espera sólo guarda su fotografía comercial; no mueve inventario
ni caja hasta el cobro.

### Reembolso

1. Sólo el administrador puede autorizarlo.
2. Impide devolver más unidades de las vendidas.
3. Registra motivo y autorización externa cuando corresponde.
4. Reintegra las unidades al stock.
5. Registra la salida de caja para pagos en efectivo.
6. Actualiza el estado de la venta.

## Concurrencia

Ventas, recepciones, ajustes, conteos y cierres de caja usan aislamiento
`Serializable`. Además, los cambios de stock verifican que la existencia
observada siga vigente. Los conteos físicos se bloquean si hubo movimientos
desde su inicio.
