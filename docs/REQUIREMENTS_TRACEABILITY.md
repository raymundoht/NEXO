# Trazabilidad verificable del SRD

Esta matriz corresponde a las tres páginas de `erp.pdf`. “Implementado” indica
que existe modelo de datos, autorización de backend y una interfaz utilizable.
Los puntos de infraestructura se validan al desplegar, porque TLS y entrega de
correo no pueden garantizarse desde el repositorio.

| Requisito del SRD | Estado | Implementación y comprobación |
| --- | --- | --- |
| RBAC con administrador, almacenista, comprador y cajero | Implementado | `src/lib/permissions.ts`, protección por página, API y navegación; pruebas RBAC. |
| Login por correo institucional | Implementado | `/login`, sesión HTTP-only y fallback POST sin credenciales en la URL. |
| Bloqueo tras 5 intentos durante 15 minutos | Implementado | `users.failed_login_attempts`, `first_failed_at`, `locked_until`, límite adicional por IP. |
| Recuperación con token criptográfico de 30 minutos | Implementado | `/forgot-password`, token hasheado de un solo uso y correo SMTP. Requiere SMTP configurado. |
| Registro solicitado con verificación de correo | Implementado | `/register`, código HMAC de seis dígitos, vigencia de 10 minutos, reenvío controlado y rol inicial de cajero fijado por servidor. |
| Indicador de contraseña segura | Implementado | Checklist y nivel visual en registro, restablecimiento y alta administrativa; el backend vuelve a imponer la política. |
| Stock en tiempo real y mínimos/máximos | Implementado | `products.current_stock`, alertas LOW/HIGH en Inventario y dashboard según rol. |
| Trazabilidad total de entradas y salidas | Implementado | `/inventory-movements`, filtros y `stock_movements` con antes/después, usuario, costo y referencia. |
| Inventarios físicos y ajustes auditados | Implementado | `/inventory-counts`, `/inventory-movements`, transacciones serializables y bitácora. |
| POS con código de barras y búsqueda predictiva | Implementado | `/pos`; búsqueda incremental y alta exacta mediante Enter de lector/SKU. |
| Ventas en espera | Implementado | Estado `HELD`, recuperación y cobro posterior sin descontar stock antes del cobro. |
| Descuentos autorizados | Implementado | Captura por partida, límite configurable para cajero y recálculo exclusivo en servidor. |
| Impuestos y cambio automático | Implementado | `src/lib/money.ts` y `src/services/sales.ts`; pruebas monetarias. |
| Ticket digital e impresión | Implementado | `/api/sales/[id]/ticket`, reimpresión desde historial. |
| Proveedores con crédito, entrega y precios de referencia | Implementado | `/suppliers`; edición, condiciones, precios por producto y proveedor preferido. |
| Órdenes ligadas a faltantes | Implementado | “Desde faltantes” precarga productos en mínimo y cantidad objetivo hasta máximo. |
| Recepción validada contra orden | Implementado | No permite exceder cantidad ni cambiar costo; actualiza stock, costo promedio y referencia. |
| Historial de compras con proveedor y fechas | Implementado | Filtros en `/purchases`; detalle, recepciones y CSV/PDF por partida. |
| Historial de ventas | Implementado | Filtros, detalle de ítems, descuentos, impuestos, pago, caja, cajero y devoluciones. |
| Reembolsos y cancelaciones supervisadas | Implementado | Sólo administrador; reversión transaccional de stock y efectivo, motivo y auditoría. |
| CSV/PDF estándar | Implementado | Exportación protegida contra fórmulas; PDF horizontal con partidas y costos/precios. |
| Diseño responsivo y táctil | Implementado | Navegación adaptable, tablas desplazables y controles táctiles en POS y caja. |
| Efectivo con apertura, arqueo, cierre y denominaciones | Implementado | Conteo MXN/USD por billetes/monedas; el servidor verifica que el total coincida. |
| Tarjeta con código de autorización sin datos plásticos | Implementado | Sólo guarda autorización; rechaza valores con apariencia de PAN y no modela PAN/CVV. |
| Contraseña robusta y hash moderno | Implementado | Mínimo 10 caracteres, complejidad y Argon2id con salt individual. |
| RLS y acceso privado a Supabase | Implementado | Migración idempotente y `prisma/supabase-hardening.sql`; roles públicos revocados. |
| HTTPS con TLS 1.3 | Requiere hosting | Redirección, cookies Secure, HSTS y `npm run verify:production`; verificar TLS 1.3 en el dominio desplegado. |
| Chrome, Firefox, Edge y Safari | Requiere prueba final | Código sin plugins, APIs web estándar y build compatible; completar matriz manual/E2E en el dominio final. |

## Criterio de entrega

Antes de liberar a producción deben pasar:

```bash
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:production
```

Los primeros cinco validan el código. El último valida variables; después deben
probarse correo real, TLS 1.3, respaldos y los cuatro navegadores en el hosting.
