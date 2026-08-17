import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { audit } from "@/lib/audit";

const ACCENT_PRESETS = [
  "#2563eb", "#4f46e5", "#7c3aed", "#9333ea",
  "#c026d3", "#db2777", "#e11d48", "#ea580c",
  "#d97706", "#16a34a", "#0d9488", "#0891b2"
];

const accentColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .refine((value) => {
    const channels = [1, 3, 5].map((index) => {
      const channel = parseInt(value.slice(index, index + 2), 16) / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance =
      0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return 1.05 / (luminance + 0.05) >= 3;
  }, "El color debe tener contraste suficiente con texto blanco.");

const appearanceSchema = z.object({
  accentColor: accentColor.optional(),
  accentColorDark: accentColor.optional(),
  sidebarStyle: z.enum(["dark", "light", "brand"]).optional(),
  borderRadius: z.enum(["none", "sm", "md", "lg", "xl"]).optional(),
  fontSize: z.enum(["xs", "sm", "md", "lg"]).optional(),
  fontFamily: z.enum(["poppins", "inter", "roboto", "nunito"]).optional(),
  density: z.enum(["compact", "normal", "comfortable"]).optional()
});

export async function GET() {
  try {
    await requirePermission("settings.appearance");
    const settings = await db.businessSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {}
    });
    return jsonOk({
      accentColor: settings.accentColor,
      accentColorDark: settings.accentColorDark,
      sidebarStyle: settings.sidebarStyle,
      borderRadius: settings.borderRadius,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      density: settings.density,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      presets: ACCENT_PRESETS
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("settings.appearance");
    const input = appearanceSchema.parse(await readJson(request));

    if (Object.keys(input).length === 0) {
      return jsonOk({});
    }

    const settings = await db.businessSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...input },
      update: input
    });

    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "APPEARANCE_UPDATED",
      entityType: "BusinessSettings",
      entityId: "1",
      ip: metadata.ip,
      metadata: { changes: Object.keys(input) }
    });

    return jsonOk({
      accentColor: settings.accentColor,
      accentColorDark: settings.accentColorDark,
      sidebarStyle: settings.sidebarStyle,
      borderRadius: settings.borderRadius,
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      density: settings.density,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl
    });
  } catch (error) {
    return jsonError(error);
  }
}
