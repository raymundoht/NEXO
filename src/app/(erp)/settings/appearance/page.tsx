import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { requirePagePermission } from "@/lib/page-auth";

const AppearanceView = dynamic(
  () => import("@/components/settings/appearance-view").then((m) => ({ default: m.AppearanceView })),
  { loading: () => <div className="space-y-4"><div className="h-8 w-48 bg-[var(--color-surface-subtle)] rounded animate-pulse" /><div className="h-64 bg-[var(--color-surface-subtle)] rounded-xl animate-pulse" /></div> }
);

export const metadata: Metadata = { title: "Apariencia" };

export default async function AppearancePage() {
  await requirePagePermission("settings.appearance");
  return <AppearanceView />;
}
