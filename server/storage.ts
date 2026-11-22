import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = process.env;
const useR2 = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && R2_PUBLIC_URL);

const s3 = useR2
  ? new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
    })
  : null;

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
export const storageMode = useR2 ? "r2" : "local";

// Normaliza cualquier foto a WebP (máx. 1600 px) y la guarda en R2 o en disco
export async function saveImage(buffer: Buffer): Promise<string> {
  const webp = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const key = `img/${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}.webp`;

  if (s3) {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET, Key: key, Body: webp, ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return `${R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
  }
  const file = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, webp);
  return `/uploads/${key}`;
}

// Borra fotos subidas (al eliminar una cuenta). Las de muestra y las externas se ignoran.
export async function deleteImages(urls: (string | null | undefined)[]) {
  const base = R2_PUBLIC_URL?.replace(/\/$/, "");
  await Promise.allSettled(urls.filter((u): u is string => Boolean(u)).map(async (url) => {
    if (s3 && base && url.startsWith(base + "/")) {
      await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: url.slice(base.length + 1) }));
    } else if (url.startsWith("/uploads/img/") && !url.includes("..")) {
      await fs.unlink(path.join(UPLOAD_DIR, url.slice("/uploads/".length)));
    }
  }));
}
