import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { audit } from "@/lib/audit";
import { writeFile, unlink, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  BRANDING_UPLOAD_DIR,
  detectBrandingImage,
  resolveStoredBrandingPath
} from "@/lib/branding";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_MULTIPART_SIZE = MAX_SIZE + 128 * 1024;

async function ensureDir() {
  await mkdir(BRANDING_UPLOAD_DIR, { recursive: true });
}

async function removeStoredBranding(url: string | null) {
  const filepath = resolveStoredBrandingPath(url);
  if (filepath) await unlink(filepath).catch(() => {});
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("settings.appearance");

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      throw new ApiError(400, "Se esperaba un formulario multipart.");
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_SIZE) {
      throw new ApiError(413, "El archivo supera 2MB.", "PAYLOAD_TOO_LARGE");
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = z.enum(["logo", "favicon"]).parse(formData.get("type"));

    if (!(file instanceof File)) {
      throw new ApiError(400, "No se proporcionó archivo.");
    }

    if (file.size > MAX_SIZE) {
      throw new ApiError(413, "El archivo supera 2MB.", "PAYLOAD_TOO_LARGE");
    }

    await ensureDir();

    const buffer = Buffer.from(await file.arrayBuffer());
    const image = detectBrandingImage(buffer);
    const filename = `${type}-${randomUUID()}.${image.extension}`;
    const filepath = resolveStoredBrandingPath(`/uploads/branding/${filename}`)!;
    const publicUrl = `/uploads/branding/${filename}`;

    await writeFile(filepath, buffer);

    // Delete old file if exists
    const field = type === "favicon" ? "faviconUrl" : "logoUrl";
    const settings = await db.businessSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {}
    });

    const oldUrl = type === "favicon" ? settings.faviconUrl : settings.logoUrl;
    try {
      await db.businessSettings.update({
        where: { id: 1 },
        data: { [field]: publicUrl }
      });
    } catch (error) {
      await unlink(filepath).catch(() => {});
      throw error;
    }
    await removeStoredBranding(oldUrl);

    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "BRANDING_UPDATED",
      entityType: "BusinessSettings",
      entityId: "1",
      ip: metadata.ip,
      metadata: { type, filename, mime: image.mime }
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
    const { type } = z
      .object({ type: z.enum(["logo", "favicon"]) })
      .parse(await readJson(request));

    const field = type === "favicon" ? "faviconUrl" : "logoUrl";
    const settings = await db.businessSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {}
    });

    const oldUrl = type === "favicon" ? settings.faviconUrl : settings.logoUrl;
    await db.businessSettings.update({
      where: { id: 1 },
      data: { [field]: null }
    });
    await removeStoredBranding(oldUrl);

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
