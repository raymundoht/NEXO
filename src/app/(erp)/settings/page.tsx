import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const SettingsView = dynamic(
  () => import("@/components/settings/settings-view").then((m) => ({ default: m.SettingsView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="h-64 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" /></div> }
);

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  await requirePagePermission("settings.manage");
  return <SettingsView />;
}
