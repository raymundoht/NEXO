"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { apiFetch } from "@/lib/client-api";

export type Appearance = {
  accentColor: string;
  accentColorDark: string;
  sidebarStyle: "dark" | "light" | "brand";
  borderRadius: "none" | "sm" | "md" | "lg" | "xl";
  fontSize: "xs" | "sm" | "md" | "lg";
  fontFamily: "poppins" | "inter" | "roboto" | "nunito";
  density: "compact" | "normal" | "comfortable";
  logoUrl: string | null;
  faviconUrl: string | null;
  presets: string[];
};

type AppearanceContextValue = {
  appearance: Appearance;
  loading: boolean;
  updateAppearance: (patch: Partial<Appearance>) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  deleteLogo: (type: "logo" | "favicon") => Promise<void>;
};

const DEFAULTS: Appearance = {
  accentColor: "#2563eb",
  accentColorDark: "#3b82f6",
  sidebarStyle: "dark",
  borderRadius: "md",
  fontSize: "sm",
  fontFamily: "poppins",
  density: "normal",
  logoUrl: null,
  faviconUrl: null,
  presets: []
};

const AppearanceContext = createContext<AppearanceContextValue>({
  appearance: DEFAULTS,
  loading: true,
  updateAppearance: async () => {},
  uploadLogo: async () => "",
  deleteLogo: async () => {}
});

const STORAGE_KEY = "nexo-appearance";

/* ── Helpers to compute CSS values from appearance ── */

function accentHover(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (c: number) => Math.max(0, Math.round(c * 0.85));
  return `#${f(r).toString(16).padStart(2, "0")}${f(g).toString(16).padStart(2, "0")}${f(b).toString(16).padStart(2, "0")}`;
}

function accentActive(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (c: number) => Math.max(0, Math.round(c * 0.7));
  return `#${f(r).toString(16).padStart(2, "0")}${f(g).toString(16).padStart(2, "0")}${f(b).toString(16).padStart(2, "0")}`;
}

function accentSoft(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

function accentFocus(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.18)`;
}

const RADIUS_MAP = {
  none: { xs: "0px", sm: "0px", md: "0px", lg: "0px", xl: "0px" },
  sm: { xs: "4px", sm: "6px", md: "8px", lg: "10px", xl: "14px" },
  md: { xs: "6px", sm: "8px", md: "12px", lg: "16px", xl: "24px" },
  lg: { xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px" },
  xl: { xs: "12px", sm: "16px", md: "24px", lg: "32px", xl: "48px" }
};

const FONT_SIZE_MAP = {
  xs: { xs: "11px", sm: "13px", md: "15px", lg: "17px" },
  sm: { xs: "12px", sm: "14px", md: "16px", lg: "20px" },
  md: { xs: "13px", sm: "15px", md: "17px", lg: "22px" },
  lg: { xs: "14px", sm: "16px", md: "18px", lg: "24px" }
};

const FONT_FAMILY_MAP = {
  poppins: '"Poppins", "Inter", ui-sans-serif, system-ui, sans-serif',
  inter: '"Inter", "Poppins", ui-sans-serif, system-ui, sans-serif',
  roboto: '"Roboto", "Inter", ui-sans-serif, system-ui, sans-serif',
  nunito: '"Nunito", "Inter", ui-sans-serif, system-ui, sans-serif'
};

const DENSITY_MAP = {
  compact: { gap: "10px", padding: "12px", minH: "34px" },
  normal: { gap: "16px", padding: "16px", minH: "38px" },
  comfortable: { gap: "22px", padding: "20px", minH: "44px" }
};

const SIDEBAR_BG = {
  dark: "#0f172a",
  light: "#ffffff",
  brand: "" // uses accentColor
};

function applyAppearance(a: Appearance, theme: "light" | "dark") {
  const root = document.documentElement;
  const isDark = theme === "dark";
  const accent = isDark ? a.accentColorDark : a.accentColor;

  root.style.setProperty("--color-accent", accent);
  root.style.setProperty("--color-accent-hover", accentHover(accent));
  root.style.setProperty("--color-accent-active", accentActive(accent));
  root.style.setProperty("--color-primary-soft", accentSoft(accent));
  root.style.setProperty("--color-focus", accentFocus(accent));
  root.style.setProperty("--color-info", accent);

  const r = RADIUS_MAP[a.borderRadius];
  root.style.setProperty("--radius-xs", r.xs);
  root.style.setProperty("--radius-sm", r.sm);
  root.style.setProperty("--radius-md", r.md);
  root.style.setProperty("--radius-lg", r.lg);
  root.style.setProperty("--radius-xl", r.xl);

  const fs = FONT_SIZE_MAP[a.fontSize];
  root.style.setProperty("--text-xs", fs.xs);
  root.style.setProperty("--text-sm", fs.sm);
  root.style.setProperty("--text-md", fs.md);
  root.style.setProperty("--text-lg", fs.lg);

  root.style.setProperty("--font-sans", FONT_FAMILY_MAP[a.fontFamily]);

  const d = DENSITY_MAP[a.density];
  root.style.setProperty("--density-gap", d.gap);
  root.style.setProperty("--density-padding", d.padding);

  const sidebarBg = a.sidebarStyle === "brand" ? accent : SIDEBAR_BG[a.sidebarStyle];
  root.style.setProperty("--sidebar", sidebarBg);
}

function loadFromStorage(): Appearance | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function saveToStorage(a: Appearance) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {}
}

export function AppearanceProvider({
  children,
  initialTheme
}: {
  children: React.ReactNode;
  initialTheme: "light" | "dark";
}) {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    return loadFromStorage() || DEFAULTS;
  });
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  const [loading, setLoading] = useState(true);

  // Sync theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("nexo-theme");
    const next =
      saved === "dark" ||
      (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    setTheme(next);
  }, []);

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const t = document.documentElement.dataset.theme as "light" | "dark";
      if (t) setTheme(t);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
    return () => observer.disconnect();
  }, []);

  // Apply CSS variables when appearance or theme changes
  useEffect(() => {
    applyAppearance(appearance, theme);
    saveToStorage(appearance);
  }, [appearance, theme]);

  // Load from API on mount
  useEffect(() => {
    apiFetch<Appearance>("/api/settings/appearance")
      .then((data) => {
        setAppearance(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const updateAppearance = useCallback(
    async (patch: Partial<Appearance>) => {
      const updated = { ...appearance, ...patch };
      setAppearance(updated);
      saveToStorage(updated);

      try {
        const data = await apiFetch<Partial<Appearance>>("/api/settings/appearance", {
          method: "PATCH",
          body: JSON.stringify(patch)
        });
        if (data && typeof data === "object") {
          setAppearance((prev) => {
            const merged = { ...prev, ...data };
            saveToStorage(merged);
            return merged;
          });
        }
      } catch {
        // Revert on error - reload from server
        const data = await apiFetch<Appearance>("/api/settings/appearance");
        setAppearance(data);
        saveToStorage(data);
      }
    },
    [appearance]
  );

  const uploadLogo = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "logo");

    const response = await fetch("/api/settings/logo", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error.message);

    const url = payload.data.url as string;
    setAppearance((prev) => {
      const updated = { ...prev, logoUrl: url };
      saveToStorage(updated);
      return updated;
    });
    return url;
  }, []);

  const deleteLogo = useCallback(async (type: "logo" | "favicon") => {
    await apiFetch<{ url: null }>("/api/settings/logo", {
      method: "DELETE",
      body: JSON.stringify({ type })
    });
    setAppearance((prev) => {
      const field = type === "favicon" ? "faviconUrl" : "logoUrl";
      const updated = { ...prev, [field]: null };
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({ appearance, loading, updateAppearance, uploadLogo, deleteLogo }),
    [appearance, loading, updateAppearance, uploadLogo, deleteLogo]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
