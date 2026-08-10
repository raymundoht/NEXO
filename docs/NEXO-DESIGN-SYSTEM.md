# NEXO UI — Manual del Sistema de Diseño

NEXO UI es el lenguaje de diseño y sistema de componentes unificado para NEXO ERP. Este sistema ha sido reconstruido tomando inspiración de la consistencia semántica y estructural de **Webpixels**, **IBM Carbon**, **PatternFly** y **SAP Fiori**, asegurando una experiencia responsiva, accesible (WCAG 2.2 AA) y optimizada para la operación de datos de alta densidad.

---

## 1. Principios de Diseño
* **Alta Precisión Estructurada:** En lugar de interfaces flotantes "sin bordes", el ERP utiliza líneas finas divisorias (`1px`) y áreas definidas para organizar la jerarquía de información.
* **Sobriedad Operativa:** La paleta de colores reduce la fatiga visual. El fondo general es de color Slate sutil, y las superficies de trabajo son de color blanco puro.
* **Densidad Inteligente:** El espaciado respeta la ley de Fitts y los objetivos de tamaño táctil, manteniendo el flujo del Punto de Venta (POS) compacto pero altamente interactivo y seguro.
* **Accesibilidad por Defecto:** Uso de semántica HTML correcta, soporte de teclado nativo, contraste AA y aros de foco visibles.

---

## 2. Tokens de Diseño

Mapeados en `src/app/globals.css` mediante variables CSS nativas que responden al cambio de tema (Claro / Oscuro):

### Paleta Semántica
| Token | Light Mode | Dark Mode | Propósito |
| :--- | :--- | :--- | :--- |
| `canvas` | `#f1f5f9` (Slate 100) | `#090d16` (Slate 950) | Base del viewport de la app |
| `app` | `#f8fafc` (Slate 50) | `#0b0f19` (Slate 900) | Fondo principal de pantallas |
| `surface` | `#ffffff` (Blanco) | `#111827` (Gray 900) | Superficie de tarjetas y paneles |
| `surface-subtle`| `#f8fafc` (Slate 50) | `#1f2937` (Gray 800) | Secciones anidadas y cabeceras de tabla |
| `text` | `#0f172a` (Slate 900) | `#f9fafb` (Gray 50) | Texto principal de lectura |
| `text-muted` | `#475569` (Slate 600) | `#9ca3af` (Gray 400) | Etiquetas secundarias y descripciones |
| `text-disabled`| `#94a3b8` (Slate 400) | `#4b5563` (Gray 600) | Estados deshabilitados |
| `border` | `#e2e8f0` (Slate 200) | `#374151` (Gray 700) | Líneas divisorias de 1px |
| `border-strong`| `#cbd5e1` (Slate 300) | `#4b5563` (Gray 600) | Bordes de cabeceras de tabla y divisorias |
| `accent` | `#2563eb` (Blue 600) | `#3b82f6` (Blue 500) | Color de marca, botones primarios |
| `focus` | `rgba(37,99,235,0.15)`| `rgba(59,130,246,0.2)`| Anillo de enfoque de 4px (`ring-4`) |

### Tipografía (Poppins / Inter)
* `xs`: 12px (etiquetas, badges, notas secundarias).
* `sm`: 14px (cuerpo base, botones, celdas de tabla, inputs).
* `md`: 16px (subtítulos, descripciones en encabezados).
* `lg`: 20px (títulos de sección).
* `xl`: 24px (títulos de página).
* `2xl`: 32px (encabezados de Landing Page y Hero).

### Espaciado y Layout (Base 4px)
* Escala: `4px` (`--space-1`), `8px` (`--space-2`), `12px` (`--space-3`), `16px` (`--space-4`), `20px` (`--space-5`), `24px` (`--space-6`), `32px` (`--space-8`), `40px` (`--space-10`), `48px` (`--space-12`).

### Radios
* `radius-xs`: 6px (botones, inputs).
* `radius-sm`: 8px (tarjetas pequeñas, badges).
* `radius-md`: 12px (tarjetas y diálogos).
* `radius-lg`: 16px (paneles amplios, contenedores).

---

## 3. Breakpoints & Adaptatividad de AppShell

El `AppShell` (`src/components/layout/app-shell.tsx`) implementa una adaptatividad de 3 fases que controla el espacio de forma inteligente:

1. **Desktop Amplio (>= 1280px):**
   * Sidebar lateral completamente expandida (ancho fijo de `256px`).
   * Contenido principal central visible al 100% con scroll independiente.
2. **Laptop / Tablet Horizontal (1024px - 1279px):**
   * Sidebar colapsada en forma de **Rail Compacto (76px)**.
   * Oculta textos y solo muestra los iconos de las herramientas, equipados con `title` para tooltips descriptivos automáticos.
3. **Móvil / Tablet Vertical (< 1024px):**
   * Sidebar oculta por defecto.
   * Se despliega como un **Drawer móvil de 288px** con backdrop translúcido (`bg-black/60`).
   * Bloquea el scroll del cuerpo de fondo (`overflow: hidden`).
   * Soporta cierre con la tecla `Escape` o haciendo clic fuera del drawer.

---

## 4. Reglas de Navegación y Estructura

La navegación está agrupada lógicamente por responsabilidades para mejorar la velocidad mental del operador:
* **Operación:** Punto de Venta (POS), Caja y el Historial de ventas.
* **Logística:** Inventario, Kardex/Ajustes, Conteos físicos, Compras y Proveedores.
* **Gestión y Control:** Dashboard (Resumen), Reportes, Usuarios, Auditoría y Configuración.

El ítem activo cuenta con un fondo azul de acento (`bg-[var(--color-accent)]`), texto blanco brillante y, en la barra rail compacta, una línea vertical de indicación a la izquierda.

---

## 5. Patrones de Página Estándar
Cada página administrativa está construida con la siguiente estructura:
1. **Breadcrumbs/Eyebrow:** Texto descriptivo superior en color de acento (`text-[var(--color-accent)]`).
2. **PageHeader:** Contiene el título principal en negrita (`font-extrabold text-[var(--color-text)]`), una descripción detallada de una sola línea a juego con `text-muted`, y las acciones de página alineadas a la derecha (`flex gap-2.5`).
3. **White Card Container:** Todo el contenido administrativo se renderiza dentro de un gran contenedor blanco con bordes ultra-finos y sombras discretas (`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm p-6 md:p-8`).
   * *Caso especial:* La ruta `/pos` (Punto de Venta) deshabilita este envoltorio de tarjeta para maximizar el espacio de venta interactivo.

---

## 6. Componentes Compartidos Refactorizados

* **AppShell** (`src/components/layout/app-shell.tsx`): Estructura responsiva de 3 niveles, buscador lateral y trampa de navegación.
* **PageHeader** (`src/components/ui/page-header.tsx`): Encabezado tipográfico de página con separador sutil e inserción de botones de acción.
* **StatusBadge** (`src/components/ui/status-badge.tsx`): Medallas de estado (Active, Completed, Pending Approval, Suspended) con fondo y bordes calculados semánticamente en base al color de estado.
* **EmptyState** (`src/components/ui/empty-state.tsx`): Ilustración simplificada y mensajes vacíos orientados a acciones de reintento.
* **Notice** (`src/components/ui/notice.tsx`): Alertas en línea con diseño técnico de Carbon.

---

## 7. Accesibilidad (WCAG 2.2 AA)
* **Saltar al Contenido:** Añadido un enlace oculto al inicio de `AppShell` (`class="skip-link sr-only focus:not-sr-only"`) para que los usuarios de lectores de pantalla salten directo al contenido principal `#main-content`.
* **Foco Visible:** Configurado `:focus-visible` globalmente para usar `--focus-ring` (anillo de 4px).
* **Navegación de Teclado:** El Drawer móvil escucha los eventos del teclado, cerrándose de forma nativa al presionar `Escape`.
* **Etiquetas ARIA:** Enlaces y botones de toggle equipados con `aria-expanded` y `aria-controls` semánticos.

---

## 8. Ejemplos de Uso (Correcto vs Incorrecto)

### Uso Correcto
```tsx
// Encabezado de página
<PageHeader
  eyebrow="Inventario"
  title="Control de Existencias"
  description="Administra existencias y movimientos entre almacenes."
  actions={<button className="btn btn-primary">Nuevo ajuste</button>}
/>

// Botones con tokens semánticos
<button className="btn btn-secondary">Cancelar</button>
```

### Uso Incorrecto
```tsx
// EVITAR: Clases de color harcodeadas o arbitrarias
<div className="bg-purple-900 border-2 border-red-500 rounded-3xl p-9">

// EVITAR: Botones sin clases de tokens globales
<button className="px-4 py-2 bg-blue-600 rounded">Acción</button>
```

---

## 9. Informe de QA y Validaciones Técnicas

### Archivos Modificados
1. `src/app/globals.css` - Rediseño de variables, componentes base y aros de enfoque.
2. `src/components/layout/app-shell.tsx` - Reescritura del Shell adaptativo con agrupaciones lógicas y perfil integrado.
3. `src/components/ui/page-header.tsx` - Refactorización visual con divisoria y espaciado de Webpixels.
4. `src/components/ui/status-badge.tsx` - Medallas circulares con colores semánticos mezclados.
5. `src/components/landing/landing-page.tsx` - Migración a Tailwind CSS con diseño de tarjetas con borde e inicio tipográfico limpio.

### Resultado de Validaciones de Compilación
Se ejecutó la suite de validación completa del ERP obteniendo los siguientes resultados exitosos:
* **`npm run typecheck`:** `tsc --noEmit` completado exitosamente con **cero errores de compilación**.
* **`npm run lint`:** `eslint .` ejecutado sin errores, con advertencias menores y controladas de Next.js (optimización de imágenes nativas `LCP` y parámetros sin utilizar).
* **Pruebas de Suite:** Pruebas estables pasadas con éxito.
* **`npm run build`:** Compilación exitosa en producción.

---

## 10. Limitaciones y Mejoras Futuras
* **Búsqueda Global (Sidebar):** El esqueleto del App Shell cuenta con el espacio visual óptimo para la paleta de comandos o buscador en el sidebar. Se recomienda conectar un índice cliente/servidor para búsquedas rápidas (ej. productos o SKU) en una fase posterior.
* **Componentes de Carbon React:** En el futuro, si se requiere internacionalización estricta de componentes de grilla de datos editables, se puede integrar una tabla de datos virtualizada.

---

**CONFIRMACIÓN EXPLÍCITA:** Se hace constar que **no se modificó** ningún archivo correspondiente a la base de datos (esquemas de Prisma, configuración de Supabase, RLS), pasarelas externas (Stripe, webhooks, sandbox de pagos), variables de entorno en producción (`.env`), ni lógica interna de control de inventarios, permisos de usuario o autenticación.

---

REDISEÑO NEXO UI COMPLETADO — LÓGICA DE NEGOCIO Y SERVICIOS EXTERNOS NO MODIFICADOS
