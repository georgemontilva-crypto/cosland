import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

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
// Dónde viven las fotos, para que el navegador vaya abriendo la conexión antes de pedir la primera
export const imageOrigin = (() => { try { return useR2 ? new URL(R2_PUBLIC_URL!).origin : null; } catch { return null; } })();

const THUMB_PX = 600;
const thumbKey = (key: string) => key.replace(/\.webp$/, ".t.webp");
const OWN_KEY = /^img\/[a-z0-9]+-[0-9a-f]{16}\.webp$/;
const makeThumb = (source: Buffer) => sharp(source).rotate().resize({ width: THUMB_PX, height: THUMB_PX, fit: "inside", withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();

async function put(key: string, body: Buffer) {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
    return;
  }
  const file = path.join(UPLOAD_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
}

// Normaliza cualquier foto a WebP y la guarda en R2 o en disco en dos tamaños:
// la grande (máx. 1600 px) para verla en detalle y una miniatura liviana para tarjetas, listas y avatares.
export async function saveImage(buffer: Buffer): Promise<string> {
  const webp = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const key = `img/${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}.webp`;
  await Promise.all([put(key, webp), put(thumbKey(key), await makeThumb(webp))]);
  return s3 ? `${R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}` : `/uploads/${key}`;
}

// De la dirección pública a la clave del archivo, solo si es una foto subida a Cosland
function keyOf(url: string) {
  const base = R2_PUBLIC_URL?.replace(/\/$/, "");
  const key = s3 && base && url.startsWith(base + "/") ? url.slice(base.length + 1) : !s3 && url.startsWith("/uploads/") ? url.slice("/uploads/".length) : null;
  return key && OWN_KEY.test(key) ? key : null;
}

// Fotos subidas antes de que existieran las miniaturas: se les crea la suya. Devuelve cuántas hizo y cuántas fallaron.
export async function backfillThumbs(urls: string[]) {
  let made = 0, failed = 0;
  const keys = [...new Set(urls.map(keyOf).filter((k): k is string => Boolean(k)))];
  const one = async (key: string) => {
    try {
      if (s3) {
        const exists = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: thumbKey(key) })).then(() => true, () => false);
        if (exists) return;
        const got = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        await put(thumbKey(key), await makeThumb(Buffer.from(await got.Body!.transformToByteArray())));
      } else {
        const exists = await fs.access(path.join(UPLOAD_DIR, thumbKey(key))).then(() => true, () => false);
        if (exists) return;
        await put(thumbKey(key), await makeThumb(await fs.readFile(path.join(UPLOAD_DIR, key))));
      }
      made++;
    } catch { failed++; }
  };
  // De a pocas, para no cargar el servidor mientras atiende visitas
  const queue = [...keys];
  await Promise.all(Array.from({ length: 3 }, async () => { for (let k = queue.shift(); k; k = queue.shift()) await one(k); }));
  return { total: keys.length, made, failed };
}

// Borra fotos subidas (al eliminar una cuenta), con su miniatura. Las de muestra y las externas se ignoran.
export async function deleteImages(urls: (string | null | undefined)[]) {
  await Promise.allSettled(urls.filter((u): u is string => Boolean(u)).flatMap((url) => {
    const key = keyOf(url);
    if (!key) return [];
    return [key, thumbKey(key)].map((k) => (s3 ? s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: k })) : fs.unlink(path.join(UPLOAD_DIR, k))));
  }));
}
