// Descarga de la app para Android desde la web.
// Mientras no esté en Play Store, el botón baja el APK que publica el build de GitHub (siempre en la misma dirección).
// Cuando esté publicada, basta poner PLAY_STORE_URL en Railway y el botón lleva a la tienda.
const APK_URL = process.env.ANDROID_APK_URL?.trim() || "https://github.com/georgemontilva-crypto/cosland/releases/download/android/cosland.apk";
const STORE_URL = process.env.PLAY_STORE_URL?.trim() || null;

let apk: { sizeMb: number | null } | null = null;
// La descarga solo se ofrece al público cuando el administrador la enciende (Admin → Resumen). Nace apagada.
let on = false;
export const setAppDownloadOn = (v: boolean) => { on = v; };

// El botón solo se muestra si el archivo existe de verdad; de paso se toma su peso
async function check() {
  try {
    const r = await fetch(APK_URL, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15_000) });
    // Una página en vez del archivo cuenta como "no existe"
    if (r.status === 404 || (r.ok && (r.headers.get("content-type") ?? "").startsWith("text/html"))) { apk = null; return; }
    if (!r.ok) return;
    const bytes = Number(r.headers.get("content-length") ?? 0);
    apk = { sizeMb: bytes > 0 ? Math.max(1, Math.round(bytes / 1048576)) : null };
  } catch { /* sin red por un momento: se conserva lo último que se supo */ }
}

export function watchAppDownload() {
  if (STORE_URL) return;
  const loop = async () => { await check(); setTimeout(loop, apk ? 30 * 60_000 : 5 * 60_000).unref(); };
  void loop();
}

export const appDownloadInfo = () => (!on ? null : STORE_URL ? { store: true, sizeMb: null } : apk ? { store: false, sizeMb: apk.sizeMb } : null);
export const appDownloadTarget = () => (!on ? null : STORE_URL ?? (apk ? APK_URL : null));
// Para el panel de administración: lo que hay publicado, esté o no a la vista del público
export const appDownloadAdmin = () => ({ on, store: Boolean(STORE_URL), available: Boolean(STORE_URL || apk), sizeMb: apk?.sizeMb ?? null, url: STORE_URL ?? APK_URL });
