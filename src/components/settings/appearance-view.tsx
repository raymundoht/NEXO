"use client";

import { PageHeader } from "@/components/ui/page-header";
import { AppearanceSection } from "@/components/settings/appearance-section";

export function AppearanceView() {
  return (
    <div>
      <PageHeader
        eyebrow="Personalización"
        title="Apariencia"
        description="Adapta los colores, tipografía y estilo del sistema a tu gusto."
      />
      <AppearanceSection />
    </div>
  );
}
