import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { audit } from "@/lib/audit";
import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "branding");
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

async function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    await requirePermission("settings.appearance");

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonError({ statusCode: 400, message: "Se esperaba un formulario multipart." });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string; // "logo" or "favicon"

    if (!file) {
      return jsonError({ statusCode: 400, message: "No se proporcionó archivo." });
    }

    if (file.size > MAX_SIZE) {
      return jsonError({ statusCode: 400, message: "El archivo supera 2MB." });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return jsonError({ statusCode: 400, message: "Tipo de archivo no permitido." });
    }

    await ensureDir();

    const ext = file.name.split(".").pop() || "png";
    const filename = `${type === "favicon" ? "favicon" : "logo"}-${Date.now()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    const publicUrl = `/uploads/branding/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Delete old file if exists
    const field = type === "favicon" ? "faviconUrl" : "logoUrl";
    const settings = await db.businessSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {}
    });

    const oldUrl = type === "favicon" ? settings.faviconUrl : settings.logoUrl;
    if (oldUrl) {
      const oldPath = path.join(process.cwd(), "public", oldUrl);
      if (existsSync(oldPath)) {
        await unlink(oldPath).catch(() => {});
      }
    }

    await db.businessSettings.update({
      where: { id: 1 },
      data: { [field]: publicUrl }
    });

    const metadata = await requestMetadata();
    const user = await requirePermission("settings.appearance");
    await audit({
      userId: user.id,
      action: "BRANDING_UPDATED",
      entityType: "BusinessSettings",
      entityId: "1",
      ip: metadata.ip,
      metadata: { type, filename }
    });

    return jsonOk({ url: publicUrl });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("settings.appearance");
    const { type } = (await request.json()) as { type: "logo" | "favicon" };

    const field = type === "favicon" ? "faviconUrl" : "logoUrl";
    const settings = await db.businessSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {}
    });

    const oldUrl = type === "favicon" ? settings.faviconUrl : settings.logoUrl;
    if (oldUrl) {
      const oldPath = path.join(process.cwd(), "public", oldUrl);
      if (existsSync(oldPath)) {
        await unlink(oldPath).catch(() => {});
      }
    }

    await db.businessSettings.update({
      where: { id: 1 },
      data: { [field]: null }
    });

    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "BRANDING_UPDATED",
      entityType: "BusinessSettings",
      entityId: "1",
      ip: metadata.ip,
      metadata: { type, action: "delete" }
    });

    return jsonOk({ url: null });
  } catch (error) {
    return jsonError(error);
  }
}
