import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export const API = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const trpc = createTRPCReact<AppRouter>();
export type Out = inferRouterOutputs<AppRouter>;
export type Card = Out["listing"]["search"]["items"][number];
export type ShopSummary = Out["shop"]["list"][number];

/* ── Sesión: el token vive en el almacén cifrado del teléfono ── */
const KEY = "cosland_token";
let token: string | null = null;
export const getToken = () => token;

export async function loadToken() {
  try {
    token = Platform.OS === "web" ? globalThis.localStorage?.getItem(KEY) ?? null : await SecureStore.getItemAsync(KEY);
  } catch { token = null; }
  return token;
}

/* ── Ajustes sencillos que el teléfono recuerda (por ejemplo, que ya se cerró la bienvenida) ── */
export function getFlag(key: string): string | null {
  try { return Platform.OS === "web" ? globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItem(key); } catch { return null; }
}
export function setFlag(key: string, value: string) {
  try { if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value); else SecureStore.setItem(key, value); } catch { /* vale solo para esta sesión */ }
}

// ¿Hay una sesión guardada en este teléfono? Se lee al instante, sin esperar a que cargue la cuenta
// (sirve para el bloqueo con huella, que debe decidir antes de mostrar nada).
export const hasSavedSession = () => Boolean(token ?? getFlag(KEY));

export async function saveToken(value: string | null) {
  token = value;
  try {
    if (Platform.OS === "web") {
      if (value) globalThis.localStorage?.setItem(KEY, value); else globalThis.localStorage?.removeItem(KEY);
    } else if (value) await SecureStore.setItemAsync(KEY, value);
    else await SecureStore.deleteItemAsync(KEY);
  } catch { /* la sesión sigue en memoria */ }
}

export const authHeaders = (): Record<string, string> => ({
  "x-cosland-client": "app",
  ...(token ? { authorization: `Bearer ${token}` } : {}),
});

export const trpcClient = trpc.createClient({
  links: [
    splitLink({
      // Entrar y registrarse van solos para que el límite de intentos del servidor los vea
      condition: (op) => op.path.startsWith("auth."),
      true: httpLink({ url: `${API}/api/trpc`, headers: authHeaders }),
      false: httpBatchLink({ url: `${API}/api/trpc`, headers: authHeaders }),
    }),
  ],
});

/* ── Utilidades ── */
// Las fotos subidas al servidor llegan como rutas relativas
export const img = (url?: string | null) => (!url ? null : url.startsWith("http") ? url : `${API}${url}`);
export const webUrl = (path: string) => `${API}${path}`;

export function errText(e: { message: string }) {
  try { const issues = JSON.parse(e.message); if (Array.isArray(issues) && issues[0]?.message) return String(issues[0].message); } catch { /* mensaje normal */ }
  return /network|fetch/i.test(e.message) ? "No hay conexión con Cosland. Revisa tu internet." : e.message;
}

export async function uploadImage(uri: string, mime?: string | null): Promise<string> {
  const read = (status: number, text: string) => {
    let data: { url?: string; error?: string } = {};
    try { data = JSON.parse(text); } catch { /* respuesta sin JSON */ }
    if (status < 200 || status >= 300 || !data.url) throw new Error(data.error ?? "No se pudo subir la foto.");
    return data.url;
  };
  if (Platform.OS === "web") {
    const fd = new FormData();
    fd.append("file", await (await fetch(uri)).blob(), "foto.jpg");
    const res = await fetch(`${API}/api/upload`, { method: "POST", body: fd, headers: authHeaders() });
    return read(res.status, await res.text());
  }
  // En el teléfono la foto se envía directo desde su archivo, con la petición nativa de React Native.
  // (El fetch de Expo no acepta archivos por su ruta: fallaba con "Unsupported FormDataPart implementation".)
  return new Promise<string>((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", { uri, name: "foto.jpg", type: mime || "image/jpeg" } as unknown as Blob);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/upload`);
    for (const [k, v] of Object.entries(authHeaders())) xhr.setRequestHeader(k, v);
    xhr.timeout = 90_000;
    xhr.onload = () => { try { resolve(read(xhr.status, xhr.responseText)); } catch (e) { reject(e); } };
    xhr.onerror = () => reject(new Error("No hay conexión con Cosland. Revisa tu internet."));
    xhr.ontimeout = () => reject(new Error("La foto tardó demasiado en subir. Inténtalo de nuevo con mejor señal."));
    xhr.send(fd);
  });
}

export function timeAgo(d: Date | string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  return new Date(d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

export const whatsappLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;
