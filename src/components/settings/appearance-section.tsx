"use client";

import { useCallback, useRef, useState } from "react";
import {
  Check,
  Upload,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  Square,
  Type,
  Rows3
} from "lucide-react";
import { useAppearance } from "@/components/layout/theme-context";

const ACCENT_PRESETS = [
  "#2563eb", "#4f46e5", "#7c3aed", "#9333ea",
  "#c026d3", "#db2777", "#e11d48", "#ea580c",
  "#d97706", "#16a34a", "#0d9488", "#0891b2"
];

const SIDEBAR_OPTIONS = [
  { value: "dark" as const, label: "Oscuro", icon: PanelLeftClose },
  { value: "light" as const, label: "Claro", icon: PanelLeft },
  { value: "brand" as const, label: "Color de marca", icon: Square }
];

const RADIUS_OPTIONS = [
  { value: "none" as const, label: "Sin radio", preview: "0px" },
  { value: "sm" as const, label: "Pequeño", preview: "6px" },
  { value: "md" as const, label: "Mediano", preview: "12px" },
  { value: "lg" as const, label: "Grande", preview: "18px" },
  { value: "xl" as const, label: "Extra", preview: "24px" }
];

const FONT_SIZE_OPTIONS = [
  { value: "xs" as const, label: "Pequeño", preview: "12px" },
  { value: "sm" as const, label: "Normal", preview: "14px" },
  { value: "md" as const, label: "Mediano", preview: "16px" },
  { value: "lg" as const, label: "Grande", preview: "18px" }
];

const FONT_FAMILY_OPTIONS = [
  { value: "poppins" as const, label: "Poppins", sample: "Aa Bb Cc" },
  { value: "inter" as const, label: "Inter", sample: "Aa Bb Cc" },
  { value: "roboto" as const, label: "Roboto", sample: "Aa Bb Cc" },
  { value: "nunito" as const, label: "Nunito", sample: "Aa Bb Cc" }
];

const DENSITY_OPTIONS = [
  { value: "compact" as const, label: "Compacta", desc: "Espaciado reducido" },
  { value: "normal" as const, label: "Normal", desc: "Equilibrado" },
  { value: "comfortable" as const, label: "Cómoda", desc: "Espaciado amplio" }
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-[var(--color-text)] mb-3">
      {children}
    </h3>
  );
}

function OptionGroup({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>{children}</div>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
  className = ""
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-150
        ${
          selected
            ? "border-[var(--color-accent)] bg-[var(--color-primary-soft)] text-[var(--color-accent)]"
            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]"
        }
        ${className}`}
    >
      {children}
      {selected && <Check size={14} className="shrink-0" />}
    </button>
  );
}

export function AppearanceSection() {
  const { appearance, updateAppearance, uploadLogo, deleteLogo } =
    useAppearance();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleLogoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        await uploadLogo(file);
      } catch {
        // Error handled by context
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [uploadLogo]
  );

  const handleDeleteLogo = useCallback(async () => {
    await deleteLogo("logo");
  }, [deleteLogo]);

  return (
    <div className="space-y-8">
      {/* ── Color de Marca ── */}
      <section>
        <SectionTitle>Color de marca</SectionTitle>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Este color se usará en botones, enlaces, iconos y acentos de toda la
          aplicación.
        </p>
        <OptionGroup>
          {ACCENT_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              onClick={() =>
                updateAppearance({
                  accentColor: hex,
                  accentColorDark: hex
                })
              }
              className={`relative w-10 h-10 rounded-full border-2 transition-all duration-150 shrink-0
                ${
                  appearance.accentColor === hex
                    ? "border-[var(--color-text)] scale-110 shadow-md"
                    : "border-transparent hover:scale-105 hover:shadow"
                }`}
              style={{ backgroundColor: hex }}
            >
              {appearance.accentColor === hex && (
                <span className="absolute inset-0 flex items-center justify-center text-white">
                  <Check size={16} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </OptionGroup>
      </section>

      {/* ── Logo de Empresa ── */}
      <section>
        <SectionTitle>Logo de empresa</SectionTitle>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Se mostrará en el sidebar y encabezados. Formato recomendado: PNG
          transparente, max 2MB.
        </p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
            {appearance.logoUrl ? (
              <img
                src={appearance.logoUrl}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            ) : (
              <Upload size={20} className="text-[var(--color-text-disabled)]" />
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn btn-secondary text-xs"
            >
              {uploading ? "Subiendo…" : appearance.logoUrl ? "Cambiar" : "Subir logo"}
            </button>
            {appearance.logoUrl && (
              <button
                type="button"
                onClick={handleDeleteLogo}
                className="btn btn-danger text-xs"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoUpload}
            className="hidden"
          />
        </div>
      </section>

      {/* ── Estilo del Sidebar ── */}
      <section>
        <SectionTitle>Estilo del sidebar</SectionTitle>
        <OptionGroup>
          {SIDEBAR_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <OptionButton
                key={opt.value}
                selected={appearance.sidebarStyle === opt.value}
                onClick={() => updateAppearance({ sidebarStyle: opt.value })}
              >
                <Icon size={15} />
                {opt.label}
              </OptionButton>
            );
          })}
        </OptionGroup>
      </section>

      {/* ── Forma de Bordes ── */}
      <section>
        <SectionTitle>Forma de bordes</SectionTitle>
        <OptionGroup>
          {RADIUS_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={appearance.borderRadius === opt.value}
              onClick={() => updateAppearance({ borderRadius: opt.value })}
            >
              <span
                className="w-5 h-5 border-2 border-current shrink-0"
                style={{ borderRadius: opt.preview }}
              />
              {opt.label}
            </OptionButton>
          ))}
        </OptionGroup>
      </section>

      {/* ── Tamaño de Fuente ── */}
      <section>
        <SectionTitle>Tamaño de fuente</SectionTitle>
        <OptionGroup>
          {FONT_SIZE_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={appearance.fontSize === opt.value}
              onClick={() => updateAppearance({ fontSize: opt.value })}
            >
              <Type size={14} />
              {opt.label}
            </OptionButton>
          ))}
        </OptionGroup>
      </section>

      {/* ── Fuente ── */}
      <section>
        <SectionTitle>Fuente</SectionTitle>
        <OptionGroup className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FONT_FAMILY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateAppearance({ fontFamily: opt.value })}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-150
                ${
                  appearance.fontFamily === opt.value
                    ? "border-[var(--color-accent)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
                }`}
            >
              <span
                className="text-lg font-bold text-[var(--color-text)]"
                style={{ fontFamily: FONT_MAP[opt.value] }}
              >
                {opt.sample}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {opt.label}
              </span>
            </button>
          ))}
        </OptionGroup>
      </section>

      {/* ── Densidad ── */}
      <section>
        <SectionTitle>Densidad de información</SectionTitle>
        <OptionGroup>
          {DENSITY_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.value}
              selected={appearance.density === opt.value}
              onClick={() => updateAppearance({ density: opt.value })}
            >
              <Rows3 size={14} />
              {opt.label}
            </OptionButton>
          ))}
        </OptionGroup>
      </section>

      {/* ── Preview ── */}
      <section>
        <SectionTitle>Vista previa</SectionTitle>
        <div className="border border-[var(--color-border)] rounded-xl p-5 bg-[var(--color-surface-subtle)]">
          <div className="flex gap-4">
            {/* Mini sidebar */}
            <div
              className="w-16 h-32 rounded-lg flex flex-col items-center gap-2 pt-3"
              style={{
                backgroundColor:
                  appearance.sidebarStyle === "brand"
                    ? appearance.accentColor
                    : appearance.sidebarStyle === "light"
                    ? "#ffffff"
                    : "#0f172a"
              }}
            >
              <div className="w-8 h-8 rounded-md bg-white/20" />
              <div className="w-10 h-1.5 rounded bg-white/30" />
              <div className="w-8 h-1 rounded bg-white/20" />
              <div className="w-8 h-1 rounded bg-white/20" />
            </div>
            {/* Mini content */}
            <div className="flex-1 space-y-3">
              <div className="h-4 w-32 rounded bg-[var(--color-border)]" />
              <div
                className="h-8 w-24 rounded-lg"
                style={{ backgroundColor: appearance.accentColor }}
              />
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded bg-[var(--color-border)]" />
                <div className="h-6 w-16 rounded bg-[var(--color-border)]" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const FONT_MAP: Record<string, string> = {
  poppins: '"Poppins", sans-serif',
  inter: '"Inter", sans-serif',
  roboto: '"Roboto", sans-serif',
  nunito: '"Nunito", sans-serif'
};
