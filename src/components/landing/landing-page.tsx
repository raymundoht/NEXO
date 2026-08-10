"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Play,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Timer,
  Truck,
  Users,
  Zap,
  ArrowRight,
  Moon,
  ClipboardCheck,
  CreditCard,
  FileBarChart,
  PackageSearch,
  BarChart3,
  LucideIcon,
  Lock,
  Menu,
  X,
  Eye,
  Activity,
  ChevronDown,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle
} from "lucide-react";

const navLinks = [
  { href: "#inicio", label: "Inicio" },
  { href: "#modulos", label: "Módulos" },
  { href: "#calculadora", label: "Impacto ROI" },
  { href: "#comparativa", label: "Comparativa" },
  { href: "#caracteristicas", label: "Características" },
  { href: "#faq", label: "Preguntas" }
];

const modules = [
  {
    id: "pos",
    icon: ShoppingCart,
    title: "Punto de Venta",
    subtitle: "POS & Facturación Instantánea",
    description: "Cobro ultrarrápido con soporte de lector de barras, descuentos autorizados, pagos mixtos y emisión de tickets PDF.",
    color: "var(--color-accent)",
    badge: "< 0.8s / ticket"
  },
  {
    id: "inventory",
    icon: PackageSearch,
    title: "Inventario Inteligente",
    subtitle: "Stock & Kardex Auditado",
    description: "Monitoreo en tiempo real con alertas de stock crítico, movimientos registrados y trazabilidad total de existencias.",
    color: "#10b981",
    badge: "Kardex 100% SQL"
  },
  {
    id: "purchases",
    icon: ReceiptText,
    title: "Compras Automatizadas",
    subtitle: "Abastecimiento Eficiente",
    description: "Generación de órdenes de compra desde faltantes con recepción parcial/total e historial de precios de proveedor.",
    color: "#f59e0b",
    badge: "Auto-reorden"
  },
  {
    id: "cash",
    icon: CreditCard,
    title: "Caja y Arqueos",
    subtitle: "Sesiones & Balance por Turno",
    description: "Apertura, arqueo ciego, entradas/salidas de efectivo y conciliación exacta de tarjetas por cajero.",
    color: "#06b6d4",
    badge: "Cero descuadres"
  },
  {
    id: "suppliers",
    icon: Truck,
    title: "Directorio Proveedores",
    subtitle: "Gestión Comercial",
    description: "Catálogo centralizado de proveedores, condiciones de pago, tiempos de entrega y productos asociados.",
    color: "#ec4899",
    badge: "Directorio activo"
  },
  {
    id: "reports",
    icon: FileBarChart,
    title: "Reportes & Analytics",
    subtitle: "Márgenes & Tendencias",
    description: "Dashboards analíticos de ventas por periodo, productos más vendidos y exportación directa en formato CSV/PDF.",
    color: "#8b5cf6",
    badge: "Exportación CSV/PDF"
  },
  {
    id: "rbac",
    icon: Users,
    title: "Seguridad por Roles",
    subtitle: "Permisos RBAC Avanzados",
    description: "Acceso segregado estricto para 4 roles operativos: Administrador, Almacenista, Comprador y Cajero.",
    color: "#14b8a6",
    badge: "4 Roles RBAC"
  },
  {
    id: "counts",
    icon: ClipboardCheck,
    title: "Conteos Físicos",
    subtitle: "Auditoría de Existencias",
    description: "Revisiones de inventario con congelamiento de stock y generación de ajustes contables automáticos.",
    color: "#f43f5e",
    badge: "Auditoría en vivo"
  }
];

const stats = [
  { icon: Eye, value: "100%", label: "Trazabilidad SQL" },
  { icon: Activity, value: "99.9%", label: "Disponibilidad" },
  { icon: ShieldCheck, value: "4 Roles", label: "RBAC Seguro" },
  { icon: Zap, value: "< 0.8s", label: "Respuesta POS" }
];

const carouselItems: Array<{ icon: LucideIcon; title: string; description: string; color: string }> = [
  {
    icon: ShieldCheck,
    title: "Seguridad Estricta RBAC",
    description: "Sesiones cifradas con tokens de alta seguridad y control estricto de permisos por rol.",
    color: "var(--color-accent)"
  },
  {
    icon: BarChart3,
    title: "Métricas en Tiempo Real",
    description: "Visualización instantánea de ventas, ganancias netas y volumen de tickets por hora.",
    color: "#10b981"
  },
  {
    icon: Lock,
    title: "Protección Antifraude",
    description: "Bloqueo automático tras intentos fallidos y hash de claves Argon2id de grado bancario.",
    color: "#f59e0b"
  },
  {
    icon: Timer,
    title: "Carga Ultrarrápida",
    description: "Pila Next.js impulsada con transacciones SQL atómicas de subsegundo.",
    color: "#06b6d4"
  },
  {
    icon: ReceiptText,
    title: "Tickets & Comprobantes PDF",
    description: "Emisión e impresión instantánea de tickets de venta con pie personalizable.",
    color: "#8b5cf6"
  },
  {
    icon: ShoppingCart,
    title: "Cobro Multimetodo",
    description: "Soporte para pago en efectivo, tarjeta de crédito/débito y pagos combinados.",
    color: "#ec4899"
  }
];

const comparisonData = [
  {
    feature: "Control de Inventario",
    excel: "Hojas desactualizadas, registros duplicados y sin historial de quién modificó el stock.",
    nexo: "Kardex en tiempo real con trazabilidad total por usuario y transacción atómica."
  },
  {
    feature: "Velocidad de Cobro",
    excel: "Cálculos manuales en calculadora, lentitud y filas largas en caja.",
    nexo: "Punto de Venta optimizado con respuesta de subsegundo (<0.8s) y atajos de teclado."
  },
  {
    feature: "Control de Caja",
    excel: "Descuadres de dinero al final del día sin saber en qué turno ocurrió.",
    nexo: "Arqueos ciegos por cajero, registro de entradas/salidas y conciliación inmediata."
  },
  {
    feature: "Seguridad y Accesos",
    excel: "Cualquier persona puede ver o borrar archivos completos sin restricciones.",
    nexo: "4 roles definidos (Admin, Almacén, Compras, Cajero) con permisos segregados por pantalla."
  }
];

const faqItems = [
  {
    question: "¿Necesito instalar algún software especial en mis computadoras?",
    answer: "No. NEXO ERP es una plataforma web de última generación. Puedes acceder desde cualquier navegador moderno en tu laptop, computadora de escritorio o tablet sin necesidad de instalaciones complejas."
  },
  {
    question: "¿Cómo funciona el control de caja y arqueo por turno?",
    answer: "Cada cajero abre su turno con un fondo inicial. Durante el día, el sistema registra cada venta, entrada o retiro de efectivo. Al cerrar el turno, se realiza un arqueo ciego donde el cajero ingresa el conteo real y el sistema reporta automáticamente cualquier diferencia."
  },
  {
    question: "¿Puedo exportar los datos para mi contabilidad?",
    answer: "Sí. Toda la información de ventas, inventarios, compras y movimientos de caja se puede exportar en formato CSV y reportes formateados para su fácil integración contable."
  },
  {
    question: "¿Es seguro mantener los datos de mi negocio en NEXO?",
    answer: "Totalmente. NEXO utiliza contraseñas cifradas con Argon2id, tokens de sesión seguros, transacciones atómicas PostgreSQL y un sistema de control de acceso basado en roles (RBAC) que protege cada pantalla e información sensible."
  }
];

const testimonials = [
  {
    quote: "NEXO redujo el tiempo de cobro en nuestras sucursales a menos de un segundo por ticket. Los descuadres de caja bajaron a cero desde la primera semana.",
    author: "Carlos Mendoza",
    role: "Director de Operaciones",
    company: "Grupo Comercial Altiplano",
    avatar: "avatar-012"
  },
  {
    quote: "El kardex automático y las alertas de stock crítico nos evitaron quedarnos sin insumos clave. Tener visibilidad real de compras e inventario cambió nuestro negocio.",
    author: "Elena Rostova",
    role: "Gerente de Cadena de Suministros",
    company: "Distribuidora Norte",
    avatar: "avatar-045"
  },
  {
    quote: "La separación de roles nos da paz mental. Los cajeros solo cobran, almacén gestiona entradas y yo veo el dashboard de margen en tiempo real desde mi tablet.",
    author: "Ricardo Garza",
    role: "Fundador & CEO",
    company: "Tiendas TecnoExpress",
    avatar: "avatar-088"
  }
];

export function LandingPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pos" | "inventory" | "purchases" | "cash">("pos");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Interactive ROI Calculator State
  const [dailySales, setDailySales] = useState<number>(85);
  const [productCount, setProductCount] = useState<number>(450);

  useEffect(() => {
    const saved = localStorage.getItem("nexo-theme");
    const nextTheme =
      saved === "dark" ||
      (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("nexo-theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }

  // Calculated ROI Metrics
  const calculatedSavings = useMemo(() => {
    const hoursSaved = Math.round((dailySales * 0.45) + (productCount * 0.05));
    const accuracy = Math.min(99.9, 98.2 + (productCount * 0.0005)).toFixed(1);
    const marginBoost = (12 + (dailySales * 0.04)).toFixed(1);
    return { hoursSaved, accuracy, marginBoost };
  }, [dailySales, productCount]);

  const contrastText = "#ffffff";

  return (
    <div className="min-h-screen bg-[var(--color-app)] text-[var(--color-text)] selection:bg-[var(--color-accent)] selection:text-white transition-colors duration-300">
      
      {/* ══════════════════════════════════════════════
          NAVBAR
         ══════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 bg-[var(--color-surface)]/85 backdrop-blur-md border-b border-[var(--color-border)] transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <img
                src={theme === "dark" ? "/logo-white.png" : "/logo-blue.png"}
                alt="NEXO ERP"
                className="h-7 w-auto object-contain transition-transform hover:scale-105"
              />
              <span className="text-xl font-bold tracking-tight text-[var(--color-text)]">NEXO</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors rounded-full hover:bg-[var(--color-surface-hover)] border-0 cursor-pointer"
              aria-label="Cambiar tema"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              href="/login"
              className="hidden sm:inline-flex text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2 bg-[var(--color-accent)] text-sm font-semibold rounded-full hover:brightness-110 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
              style={{ color: contrastText }}
            >
              Empezar <ArrowRight size={14} />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-hover)] rounded-lg md:hidden border-0 cursor-pointer"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="absolute top-16 left-0 right-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] shadow-lg p-6 flex flex-col gap-4 z-50 md:hidden">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="h-px bg-[var(--color-border)]" />
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="text-base font-semibold hover:text-[var(--color-accent)] transition-colors">
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[var(--color-accent)] text-sm font-semibold rounded-full"
              style={{ color: contrastText }}
            >
              Empezar <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════════
          HERO SECTION (Theme-Adaptive Mesh & Atmosphere)
         ══════════════════════════════════════════════ */}
      <header id="inicio" className="hero-mesh-bg relative pt-6 pb-12 md:pt-10 md:pb-16 px-6 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="hero-grid-pattern absolute inset-0 pointer-events-none opacity-30" />
        <div className="absolute top-[-80px] left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[var(--color-accent)]/15 rounded-full blur-[120px] pointer-events-none animate-pulse-glow" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-14 items-center">
            
            {/* Left Column: Hero Text */}
            <div className="text-center lg:text-left">
              
              {/* Interactive Live Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-accent)] text-xs font-bold uppercase tracking-wider mb-5 border border-[var(--color-accent)]/20 shadow-sm animate-float">
                <Sparkles size={14} className="text-[var(--color-accent)]" />
                <span>NEXO ERP v2.0 • Trazabilidad Total en Tiempo Real</span>
              </div>

              <h1 className="landing-fade-in landing-fade-in-delay-1 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.12] text-[var(--color-text)] mb-4">
                Tu empresa conectada,{" "}
                <span className="bg-gradient-to-r from-[var(--color-accent)] via-blue-500 to-indigo-600 bg-clip-text text-transparent">
                  de punta a punta
                </span>
              </h1>

              <p className="landing-fade-in landing-fade-in-delay-2 text-base md:text-lg text-[var(--color-text-muted)] mb-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Punto de Venta ultrarrápido, Inventarios auditados en tiempo real, Compras automatizadas y Arqueos de Caja exactos en un solo sistema.
              </p>

              {/* Call to Actions */}
              <div className="landing-fade-in landing-fade-in-delay-3 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 mb-8">
                <Link
                  href="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[var(--color-accent)] font-bold rounded-full hover:brightness-110 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                  style={{ color: contrastText }}
                >
                  Empieza gratis ahora <ArrowRight size={16} />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[var(--color-surface)] text-[var(--color-text)] font-semibold rounded-full border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all duration-200 shadow-sm"
                >
                  <Play size={15} className="fill-current text-[var(--color-accent)]" /> Ver demo interactiva
                </Link>
              </div>

              {/* Responsive Stats */}
              <div className="landing-fade-in landing-fade-in-delay-4 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pt-6 border-t border-[var(--color-border)]">
                {stats.map((st) => {
                  const Icon = st.icon;
                  return (
                    <div key={st.label} className="flex flex-col items-center lg:items-start justify-center min-w-0">
                      <div className="flex items-center gap-1.5 justify-center lg:justify-start mb-1 max-w-full">
                        <Icon size={16} className="text-[var(--color-accent)] shrink-0" />
                        <p className="text-lg md:text-xl font-bold tracking-tight text-[var(--color-text)] whitespace-nowrap">{st.value}</p>
                      </div>
                      <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap">{st.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Interactive Live Mockup & Module Selector */}
            <div className="landing-fade-in landing-fade-in-delay-3 mockup-perspective">
              <div className="mockup-card relative rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl overflow-hidden">
                
                {/* Mockup Top Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-subtle)] border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-red-400/80 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-amber-400/80 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-green-400/80 inline-block" />
                    </div>
                    <span className="text-[11px] font-mono text-[var(--color-text-muted)] ml-2">nexo-erp.app/demo</span>
                  </div>

                  {/* Interactive Demo Tabs */}
                  <div className="flex items-center gap-1 bg-[var(--color-app)] p-1 rounded-lg border border-[var(--color-border)] text-xs">
                    <button
                      onClick={() => setActiveTab("pos")}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        activeTab === "pos"
                          ? "bg-[var(--color-accent)] text-white shadow-sm"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      POS
                    </button>
                    <button
                      onClick={() => setActiveTab("inventory")}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        activeTab === "inventory"
                          ? "bg-[var(--color-accent)] text-white shadow-sm"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      Kardex
                    </button>
                    <button
                      onClick={() => setActiveTab("purchases")}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        activeTab === "purchases"
                          ? "bg-[var(--color-accent)] text-white shadow-sm"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      Compras
                    </button>
                    <button
                      onClick={() => setActiveTab("cash")}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        activeTab === "cash"
                          ? "bg-[var(--color-accent)] text-white shadow-sm"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      Caja
                    </button>
                  </div>
                </div>

                {/* Mockup Interactive Content Body */}
                <div className="p-5 md:p-6 min-h-[360px] flex flex-col justify-between">
                  {activeTab === "pos" && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                        <div>
                          <p className="text-xs text-[var(--color-text-muted)]">Punto de Venta Activo</p>
                          <h4 className="text-base font-bold text-[var(--color-text)]">Terminal CAJA-01 • Turno Matutino</h4>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-bold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> OPERATIVO
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs">
                          <span className="font-semibold">Scanner CB-9012 • Laptop Pro X</span>
                          <span className="font-mono font-bold">$18,450.00 MXN</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs">
                          <span className="font-semibold">Monitor Gamer 27&quot; 144Hz</span>
                          <span className="font-mono font-bold">$6,200.00 MXN</span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-subtle)] border border-[var(--color-border)] text-xs">
                          <span className="font-semibold">Teclado Mecánico RGB</span>
                          <span className="font-mono font-bold">$1,450.00 MXN</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold">Total a Cobrar</p>
                          <p className="text-2xl font-extrabold text-[var(--color-accent)]">$26,100.00 MXN</p>
                        </div>
                        <button className="px-5 py-2.5 bg-[var(--color-accent)] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2">
                          <CreditCard size={15} /> Cobrar Ticket (PDF)
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === "inventory" && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                        <div>
                          <p className="text-xs text-[var(--color-text-muted)]">Kardex Auditado</p>
                          <h4 className="text-base font-bold text-[var(--color-text)]">Monitoreo de Stock en Tiempo Real</h4>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 text-xs font-bold">
                          SQL Atómico
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span>Laptop Pro X (SKU: LAP-01)</span>
                            <span className="text-emerald-600">42 pzas (Óptimo)</span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: "85%" }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span>Monitor Gamer 27&quot; (SKU: MON-27)</span>
                            <span className="text-amber-600">5 pzas (Reordenar)</span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: "20%" }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span>Teclado Mecánico RGB (SKU: TEC-RGB)</span>
                            <span className="text-emerald-600">68 pzas (Óptimo)</span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: "92%" }} />
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                        <span className="font-semibold text-amber-700 dark:text-amber-400">⚠️ 1 Producto requiere reorden inmediato</span>
                        <span className="font-bold underline cursor-pointer">Crear Orden →</span>
                      </div>
                    </div>
                  )}

                  {activeTab === "purchases" && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                        <div>
                          <p className="text-xs text-[var(--color-text-muted)]">Abastecimiento</p>
                          <h4 className="text-base font-bold text-[var(--color-text)]">Orden de Compra OC-2026-089</h4>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 text-xs font-bold">
                          EN TRÁNSITO
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between p-2 rounded-lg bg-[var(--color-surface-subtle)]">
                          <span className="text-[var(--color-text-muted)]">Proveedor:</span>
                          <span className="font-bold">TechSupplier Global S.A.</span>
                        </div>
                        <div className="flex justify-between p-2 rounded-lg bg-[var(--color-surface-subtle)]">
                          <span className="text-[var(--color-text-muted)]">Recepción:</span>
                          <span className="font-bold text-emerald-600">Parcial (15 de 20 unidades)</span>
                        </div>
                        <div className="flex justify-between p-2 rounded-lg bg-[var(--color-surface-subtle)]">
                          <span className="text-[var(--color-text-muted)]">Total Facturado:</span>
                          <span className="font-bold font-mono">$112,500.00 MXN</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-accent)] text-xs font-medium">
                        ✓ Los ítems recibidos incrementaron el Kardex en tiempo real con costo promedio ponderado.
                      </div>
                    </div>
                  )}

                  {activeTab === "cash" && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                        <div>
                          <p className="text-xs text-[var(--color-text-muted)]">Caja y Arqueos</p>
                          <h4 className="text-base font-bold text-[var(--color-text)]">Balance de Turno Activo</h4>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-bold">
                          CONCILIADO
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                          <p className="text-[var(--color-text-muted)]">Fondo Inicial</p>
                          <p className="text-lg font-bold font-mono mt-0.5">$2,000.00</p>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                          <p className="text-[var(--color-text-muted)]">Ventas Efectivo</p>
                          <p className="text-lg font-bold font-mono text-emerald-600 mt-0.5">$14,850.00</p>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                          <p className="text-[var(--color-text-muted)]">Ventas Tarjeta</p>
                          <p className="text-lg font-bold font-mono text-blue-600 mt-0.5">$11,250.00</p>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)]">
                          <p className="text-[var(--color-text-muted)]">Diferencia Arqueo</p>
                          <p className="text-lg font-bold font-mono text-emerald-600 mt-0.5">$0.00 OK</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════
          MÓDULOS SECTION (Grid & Glassmorphism Cards)
         ══════════════════════════════════════════════ */}
      <section id="modulos" className="py-12 md:py-16 px-6 border-t border-[var(--color-border)] relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-accent)] text-xs font-bold uppercase tracking-wider mb-3">
              <PackageSearch size={14} /> Soluciones Integradas
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              Todo lo que tu negocio necesita
            </h2>
            <p className="text-[var(--color-text-muted)] text-base leading-relaxed">
              Herramientas diseñadas sin fricción para operar con velocidad, precisión contable y control absoluto.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.title}
                  className="group relative h-full p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 hover:border-[var(--color-accent)]/40 overflow-hidden flex flex-col justify-between"
                >
                  {/* Subtle Color Glow on Hover */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 20% 20%, color-mix(in srgb, ${mod.color} 10%, transparent), transparent 70%)`
                    }}
                  />

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                        style={{
                          color: mod.color,
                          background: `color-mix(in srgb, ${mod.color} 14%, transparent)`
                        }}
                      >
                        <Icon size={24} />
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                        {mod.badge}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold mb-1 text-[var(--color-text)]">{mod.title}</h3>
                    <p className="text-xs font-semibold text-[var(--color-accent)] mb-2.5">{mod.subtitle}</p>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                      {mod.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[var(--color-border)] flex items-center text-xs font-bold text-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Ver funcionalidad</span>
                    <ArrowRight size={13} className="ml-1 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          INTERACTIVE ROI CALCULATOR SECTION
         ══════════════════════════════════════════════ */}
      <section id="calculadora" className="py-14 md:py-20 px-6 bg-[var(--color-surface-subtle)] border-t border-[var(--color-border)] relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-3">
              <TrendingUp size={14} /> Simulador de Impacto
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              Calcula el ahorro de tu empresa
            </h2>
            <p className="text-[var(--color-text-muted)] text-base">
              Ajusta el volumen de ventas e inventario para proyectar las horas y dinero recuperado con NEXO.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-10 shadow-xl">
            
            {/* Sliders Area */}
            <div className="lg:col-span-7 space-y-8">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                    <Clock size={16} className="text-[var(--color-accent)]" /> Ventas Diarias Aproximadas
                  </label>
                  <span className="text-lg font-extrabold text-[var(--color-accent)] font-mono">{dailySales} tickets/día</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={dailySales}
                  onChange={(e) => setDailySales(Number(e.target.value))}
                  className="nexo-slider"
                />
                <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mt-1 font-semibold">
                  <span>10 ops</span>
                  <span>150 ops</span>
                  <span>300+ ops</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                    <PackageSearch size={16} className="text-[var(--color-accent)]" /> Productos en Inventario (SKUs)
                  </label>
                  <span className="text-lg font-extrabold text-[var(--color-accent)] font-mono">{productCount} SKUs</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="2000"
                  step="50"
                  value={productCount}
                  onChange={(e) => setProductCount(Number(e.target.value))}
                  className="nexo-slider"
                />
                <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mt-1 font-semibold">
                  <span>50 SKUs</span>
                  <span>1,000 SKUs</span>
                  <span>2,000+ SKUs</span>
                </div>
              </div>
            </div>

            {/* Calculated Metrics Display */}
            <div className="lg:col-span-5 bg-[var(--color-app)] border border-[var(--color-border)] rounded-2xl p-6 space-y-5">
              <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Resultados Estimados</h4>
              
              <div>
                <p className="text-3xl font-extrabold text-emerald-600 font-mono">~{calculatedSavings.hoursSaved} hrs/mes</p>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">Tiempo ahorrado en arqueos, compras e inventarios</p>
              </div>

              <div className="h-px bg-[var(--color-border)]" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xl font-bold text-[var(--color-text)] font-mono">{calculatedSavings.accuracy}%</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Precisión en Kardex</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-600 font-mono">+{calculatedSavings.marginBoost}%</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">Margen de Ganancia</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          COMPARATIVE SECTION (Excel vs NEXO)
         ══════════════════════════════════════════════ */}
      <section id="comparativa" className="py-14 md:py-20 px-6 border-t border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              ¿Por qué dejar el control manual o Excel?
            </h2>
            <p className="text-[var(--color-text-muted)] text-base">
              Compara la diferencia entre la operación tradicional y una plataforma estructurada.
            </p>
          </div>

          <div className="space-y-4">
            {comparisonData.map((item) => (
              <div
                key={item.feature}
                className="grid md:grid-cols-12 gap-4 p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow items-center"
              >
                <div className="md:col-span-3">
                  <h4 className="text-base font-bold text-[var(--color-text)]">{item.feature}</h4>
                </div>

                <div className="md:col-span-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs flex gap-2.5 items-start">
                  <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-red-700 dark:text-red-400 block mb-0.5">Control Tradicional / Excel</span>
                    <span className="text-[var(--color-text-muted)]">{item.excel}</span>
                  </div>
                </div>

                <div className="md:col-span-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex gap-2.5 items-start">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">Plataforma NEXO ERP</span>
                    <span className="text-[var(--color-text-muted)]">{item.nexo}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          CARACTERÍSTICAS SECTION — Carousel
         ══════════════════════════════════════════════ */}
      <section id="caracteristicas" className="py-12 md:py-16 bg-[var(--color-canvas)] border-t border-[var(--color-border)] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 mb-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              Construido para alta velocidad
            </h2>
            <p className="text-[var(--color-text-muted)] text-base">
              Arquitectura pensada para soportar miles de transacciones con cero caídas.
            </p>
          </div>
        </div>

        {/* Carousel Track */}
        <div className="relative group/carousel">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--color-canvas)] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--color-canvas)] to-transparent z-10 pointer-events-none" />

          <div className="carousel-track flex gap-5 px-6 w-max">
            {carouselItems.concat(carouselItems).map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div key={`${feat.title}-${i}`} className="w-[340px] shrink-0 p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ color: feat.color, background: `color-mix(in srgb, ${feat.color} 12%, transparent)` }}
                    >
                      <Icon size={20} />
                    </div>
                    <h4 className="text-base font-bold text-[var(--color-text)]">{feat.title}</h4>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{feat.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TESTIMONIALS SECTION
         ══════════════════════════════════════════════ */}
      <section className="py-14 md:py-20 px-6 border-t border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              Confianza de empresas en crecimiento
            </h2>
            <p className="text-[var(--color-text-muted)] text-base">
              Lo que opinan los líderes de operaciones que ya utilizan NEXO ERP.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((item) => (
              <div key={item.author} className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm flex flex-col justify-between">
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed italic mb-6">
                  &quot;{item.quote}&quot;
                </p>

                <div className="flex items-center gap-3 pt-4 border-t border-[var(--color-border)]">
                  <img
                    src={`https://tapback.co/api/avatar/${item.avatar}.webp`}
                    alt={item.author}
                    className="w-10 h-10 rounded-full object-cover border border-[var(--color-border)]"
                  />
                  <div>
                    <h5 className="text-xs font-bold text-[var(--color-text)]">{item.author}</h5>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-medium">{item.role} • {item.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FAQ ACCORDION SECTION
         ══════════════════════════════════════════════ */}
      <section id="faq" className="py-14 md:py-20 px-6 bg-[var(--color-surface-subtle)] border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-accent)] text-xs font-bold uppercase tracking-wider mb-3">
              <HelpCircle size={14} /> Respuestas Claras
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3">
              Preguntas Frecuentes
            </h2>
            <p className="text-[var(--color-text-muted)] text-base">
              Todo lo que necesitas saber antes de empezar a operar con NEXO.
            </p>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={item.question}
                  className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors border-0 cursor-pointer"
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-[var(--color-accent)]" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border)]/50 pt-3">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          FOOTER
         ══════════════════════════════════════════════ */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand Column */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <img
                  src={theme === "dark" ? "/logo-white.png" : "/logo-blue.png"}
                  alt="NEXO ERP"
                  className="h-6 w-auto object-contain"
                />
                <span className="text-lg font-bold text-[var(--color-text)]">NEXO</span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed max-w-xs mb-3">
                Sistema de Gestión Integral con Trazabilidad SQL de subsegundo.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Servicios Operando 100%
              </div>
            </div>

            {/* Links Column */}
            <div>
              <h4 className="text-xs font-bold text-[var(--color-text)] mb-3 uppercase tracking-wider">Navegación Rápida</h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#modulos" className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">Módulos del Sistema</a></li>
                <li><a href="#calculadora" className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">Simulador de ROI</a></li>
                <li><a href="#comparativa" className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">Comparativa Excel vs NEXO</a></li>
                <li><a href="#faq" className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors">Preguntas Frecuentes</a></li>
              </ul>
            </div>

            {/* Legal Column */}
            <div>
              <h4 className="text-xs font-bold text-[var(--color-text)] mb-3 uppercase tracking-wider">Plataforma & Seguridad</h4>
              <ul className="space-y-2 text-xs text-[var(--color-text-muted)]">
                <li><span>Cifrado Argon2id & Tokens Seguros</span></li>
                <li><span>Control de Acceso basado en Roles (RBAC)</span></li>
                <li><span>Transacciones PostgreSQL Atómicas</span></li>
                <li><span>Contacto: soporte@nexo-erp.com</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-[var(--color-border)] flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              © {new Date().getFullYear()} NEXO ERP. Todos los derechos reservados.
            </p>
            <p className="text-xs text-[var(--color-text-disabled)] font-mono">
              v2.0 — Enterprise Supply Chain System
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
