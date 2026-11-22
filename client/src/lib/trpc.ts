import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();
export type Out = inferRouterOutputs<AppRouter>;
export type Card = Out["listing"]["search"]["items"][number];
export type ShopCardData = Out["shop"]["list"][number];

export const trpcClient = trpc.createClient({
  links: [
    splitLink({
      // Entrar y registrarse van solos para que el límite de intentos del servidor los vea
      condition: (op) => op.path.startsWith("auth."),
      true: httpLink({ url: "/api/trpc" }),
      false: httpBatchLink({ url: "/api/trpc" }),
    }),
  ],
});

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo subir la foto.");
  return data.url as string;
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

export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;
}
