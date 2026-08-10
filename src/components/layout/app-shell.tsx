"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeftRight,
  ClipboardCheck,
  FileBarChart,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageSearch,
  PanelLeftClose,
  Palette,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Truck,
  Users,
  WalletCards,
  X
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { apiFetch } from "@/lib/client-api";
import { UserProvider } from "@/components/layout/user-context";
import { AppearanceProvider } from "@/components/layout/theme-context";
import { UserAvatar } from "@/components/ui/user-avatar";

const ChangePasswordModal = dynamic(
  () => import("@/components/auth/change-password-modal").then((m) => ({ default: m.ChangePasswordModal })),
  { ssr: false }
);
const AvatarPickerModal = dynamic(
  () => import("@/components/auth/avatar-picker-modal").then((m) => ({ default: m.AvatarPickerModal })),
  { ssr: false }
);

// Grouped navigation layout following Carbon/Fiori principles
const navigationGroups = [
  {
    title: "Operación",
    items: [
      { href: "/pos", label: "Punto de venta", icon: ShoppingCart, permission: "pos.sell" },
      { href: "/cash", label: "Caja", icon: WalletCards, permission: "cash.manage" },
      { href: "/sales", label: "Historial de ventas", icon: History, permission: "sales.read" }
    ]
  },
  {
    title: "Logística",
    items: [
      { href: "/inventory", label: "Inventario", icon: PackageSearch, permission: "inventory.read" },
      { href: "/inventory-movements", label: "Kardex y ajustes", icon: ArrowLeftRight, permission: "inventory.read" },
      { href: "/inventory-counts", label: "Conteos físicos", icon: ClipboardCheck, permission: "inventory.audit" },
      { href: "/purchases", label: "Compras", icon: ReceiptText, permission: "purchases.read" },
      { href: "/suppliers", label: "Proveedores", icon: Truck, permission: "suppliers.manage" }
    ]
  },
  {
    title: "Gestión y Control",
    items: [
      { href: "/dashboard", label: "Resumen", icon: LayoutDashboard, permission: "dashboard.read" },
      { href: "/reports", label: "Reportes", icon: FileBarChart, permission: "purchases.export" },
      { href: "/users", label: "Usuarios", icon: Users, permission: "users.manage" },
      { href: "/audit", label: "Auditoría", icon: ShieldCheck, permission: "audit.read" },
      { href: "/settings", label: "Configuración", icon: Settings, permission: "settings.manage" },
      { href: "/settings/appearance", label: "Apariencia", icon: Palette, permission: "settings.appearance" }
    ]
  }
];

export function AppShell({
  user,
  children
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState<string | null>(user.avatarSeed);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Monitor viewport size to implement 3-phase adaptivity (Desktop, Laptop Rail, Mobile)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setCollapsed(false); // Wide desktop: Expanded
        setMobileOpen(false);
      } else if (window.innerWidth >= 1024) {
        setCollapsed(true);  // Laptop: Compact rail
        setMobileOpen(false);
      } else {
        setCollapsed(false); // Mobile/Tablet: Hidden drawer
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock scroll of main document on mobile when drawer is active
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Handle drawer close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        triggerRef.current?.focus();
      }
    };
    if (mobileOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    const saved = localStorage.getItem("nexo-theme");
    const nextTheme =
      saved === "dark" ||
      (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("nexo-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  // Filter groups by allowed user permissions
  const filteredGroups = useMemo(() => {
    return navigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => (user.permissions as string[]).includes(item.permission))
      }))
      .filter((group) => group.items.length > 0);
  }, [user.permissions]);

  // Is the POS screen active?
  const isPos = pathname === "/pos";

  return (
    <UserProvider value={user}>
      <AppearanceProvider initialTheme={theme}>
      <div className="min-h-screen bg-[var(--color-app)] text-[var(--color-text)] transition-colors duration-150 flex">
        
        {/* Skip to Main Content link (Accessibility) */}
        <a href="#main-content" className="skip-link sr-only focus:not-sr-only">
          Saltar al contenido principal
        </a>

        {/* Mobile Drawer Backdrop */}
        {mobileOpen && (
          <button
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden w-full h-full border-0 cursor-default"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ── Sidebar (Persistent on Desktop, Compact on Laptop, Drawer on Mobile) ── */}
        <aside
          ref={sidebarRef}
          id="app-sidebar"
          role="navigation"
          aria-label="Navegación principal"
          className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--sidebar)] text-white transition-all duration-200 
            ${mobileOpen ? "translate-x-0 w-[288px]" : "-translate-x-full lg:translate-x-0"} 
            ${collapsed ? "lg:w-[76px]" : "lg:w-[258px]"}`}
        >
          {/* Sidebar Header */}
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
            <img
              src="/logo-white.png"
              alt=""
              className="h-8 w-auto shrink-0 object-contain"
            />
            {(!collapsed || mobileOpen) && (
              <div className="min-w-0">
                <p className="text-base font-bold tracking-tight leading-none">NEXO</p>
                <p className="mt-1 truncate text-[9px] uppercase tracking-[0.2em] text-white/40">
                  Supply ERP
                </p>
              </div>
            )}
            
            {/* Close button for mobile drawer */}
            {mobileOpen && (
              <button
                aria-label="Cerrar menú de navegación"
                className="ml-auto p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 lg:hidden"
                onClick={() => setMobileOpen(false)}
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
            {filteredGroups.map((group) => (
              <div key={group.title} className="space-y-1.5">
                {(!collapsed || mobileOpen) ? (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-white/30">
                    {group.title}
                  </p>
                ) : (
                  <div className="h-px bg-white/10 mx-2 my-4" />
                )}
                
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                    const Icon = item.icon;
                    return (
                      <Link
                        href={item.href}
                        key={item.href}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed && !mobileOpen ? item.label : undefined}
                        className={`group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-150 ${
                          active
                            ? "bg-[var(--color-accent)] text-white shadow-sm"
                            : "text-white/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon className="shrink-0" size={18} />
                        {(!collapsed || mobileOpen) && <span>{item.label}</span>}
                        
                        {/* Visual indicator line for active items in collapsed view */}
                        {active && collapsed && !mobileOpen && (
                          <span className="absolute left-0 top-1/4 bottom-1/4 w-1 rounded-r bg-white" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar Footer / User Profile & Settings */}
          {(!collapsed || mobileOpen) ? (
            <div className="mt-auto border-t border-white/10 p-4 space-y-3 bg-black/10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAvatarModalOpen(true)}
                  className="shrink-0 rounded-full transition hover:ring-2 hover:ring-white/30 focus-visible:ring-2 focus-visible:ring-white/50 outline-none"
                  title="Cambiar avatar"
                  type="button"
                >
                  <UserAvatar seed={avatarSeed} userId={user.id} name={user.name} size="md" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{user.name}</p>
                  <p className="truncate text-[9px] uppercase tracking-wider text-white/40">
                    {roleLabel(user.role)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setAvatarModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-md bg-white/5 py-2 text-[11px] font-medium text-white/75 hover:bg-white/10 hover:text-white transition"
                  title="Cambiar avatar"
                >
                  <span className="text-[10px]">😊</span>
                  <span>Avatar</span>
                </button>
                <button
                  onClick={() => setPasswordModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-md bg-white/5 py-2 text-[11px] font-medium text-white/75 hover:bg-white/10 hover:text-white transition"
                  title="Cambiar contraseña"
                >
                  <KeyRound size={13} />
                  <span>Clave</span>
                </button>
                <button
                  onClick={logout}
                  className="flex items-center justify-center gap-1.5 rounded-md bg-white/5 py-2 text-[11px] font-medium text-white/75 hover:bg-red-500/20 hover:text-red-300 transition"
                  title="Cerrar sesión"
                >
                  <LogOut size={13} />
                  <span>Salir</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-auto border-t border-white/10 p-3 flex flex-col items-center gap-2 bg-black/10">
              <button
                onClick={() => setAvatarModalOpen(true)}
                className="shrink-0 rounded-full transition hover:ring-2 hover:ring-white/30 outline-none"
                title="Cambiar avatar"
                type="button"
              >
                <UserAvatar seed={avatarSeed} userId={user.id} name={user.name} size="md" />
              </button>
              <button
                onClick={() => setPasswordModalOpen(true)}
                className="p-2 text-white/60 hover:bg-white/5 hover:text-white rounded-md transition"
                title="Cambiar contraseña"
              >
                <KeyRound size={15} />
              </button>
              <button
                onClick={logout}
                className="p-2 text-white/60 hover:bg-red-500/20 hover:text-red-300 rounded-md transition"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </aside>

        {/* ── Main Workspace Area ── */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-200 
            ${collapsed ? "lg:ml-[76px]" : "lg:ml-[258px]"}`}
        >
          {/* Header Bar */}
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur-md px-6">
            <div className="flex items-center gap-3">
              <button
                ref={triggerRef}
                aria-label="Abrir menú de navegación"
                aria-controls="app-sidebar"
                aria-expanded={mobileOpen}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--color-surface-hover)] lg:hidden border-0"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={18} />
              </button>
              
              <button
                aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
                className="hidden h-9 w-9 place-items-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] lg:grid border-0"
                onClick={() => setCollapsed((v) => !v)}
              >
                <PanelLeftClose
                  className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
                  size={17}
                />
              </button>
              
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-[var(--color-text)]">
                  Centro de operaciones
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] hidden sm:block">
                  Información consolidada de tu cadena de suministro
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                aria-label="Cambiar tema de color"
                className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                onClick={toggleTheme}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {/* User Avatar badge (Desktop only) */}
              <div className="hidden items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 pl-2 pr-3 sm:flex">
                <UserAvatar seed={avatarSeed} userId={user.id} name={user.name} size="sm" />
                <div className="max-w-28 text-left">
                  <p className="truncate text-[11px] font-semibold text-[var(--color-text)] leading-none">{user.name}</p>
                  <p className="text-[9px] uppercase tracking-wide text-[var(--color-text-muted)] mt-0.5 leading-none">
                    {roleLabel(user.role)}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Body */}
          <main id="main-content" tabIndex={-1} className="flex-1 p-5 md:p-6 lg:p-8 outline-none">
            {isPos ? (
              children
            ) : (
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm p-6 md:p-8 min-h-[calc(100vh-112px)]">
                {children}
              </div>
            )}
          </main>
        </div>
      </div>

      <ChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />

      <AvatarPickerModal
        open={avatarModalOpen}
        currentSeed={avatarSeed}
        onSave={(seed) => setAvatarSeed(seed)}
        onClose={() => setAvatarModalOpen(false)}
      />
      </AppearanceProvider>
    </UserProvider>
  );
}

function roleLabel(role: string) {
  return (
    {
      ADMIN: "Administrador",
      WAREHOUSE: "Almacenista",
      BUYER: "Comprador",
      CASHIER: "Cajero"
    }[role] || role
  );
}
