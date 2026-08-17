import path from "path";
import { ApiError } from "@/lib/api";

export const BRANDING_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "branding"
);

export function detectBrandingImage(buffer: Buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return { extension: "png", mime: "image/png" };
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { extension: "jpg", mime: "image/jpeg" };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", mime: "image/webp" };
  }
  throw new ApiError(400, "El archivo no es una imagen PNG, JPEG o WebP válida.");
}

export function resolveStoredBrandingPath(url: string | null) {
  if (!url || !url.startsWith("/uploads/branding/")) return null;
  const filename = path.basename(url);
  if (url !== `/uploads/branding/${filename}`) return null;
  const resolved = path.resolve(BRANDING_UPLOAD_DIR, filename);
  const root = `${path.resolve(BRANDING_UPLOAD_DIR)}${path.sep}`;
  return resolved.startsWith(root) ? resolved : null;
}
