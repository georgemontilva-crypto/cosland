import { initTRPC, TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";

export const COOKIE = "cosland_session";
const SECRET = process.env.JWT_SECRET ?? "";
if (!SECRET && process.env.NODE_ENV === "production") {
  console.error("Falta JWT_SECRET.");
  process.exit(1);
}
const secret = SECRET || "solo-desarrollo-cambia-esto";

export type SessionUser = { id: number; email: string; name: string; role: "user" | "admin" };

// La web guarda la sesión en una cookie que el navegador no deja leer a los scripts.
// La app nativa no usa cookies: recibe el token y lo manda en la cabecera Authorization.
export const wantsToken = (req: Request) => req.get("x-cosland-client") === "app";

export function signSession(res: Response, userId: number) {
  const token = jwt.sign({ uid: userId }, secret, { expiresIn: "30d" });
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 3600 * 1000, path: "/",
  });
  return token;
}

export async function userFromRequest(req: Request): Promise<SessionUser | null> {
  const bearer = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const token = bearer ?? req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const { uid } = jwt.verify(token, secret) as { uid: number };
    const [u] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (!u || u.banned) return null;
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  } catch {
    return null;
  }
}

export async function createContext({ req, res }: { req: Request; res: Response }) {
  return { req, res, user: await userFromRequest(req) };
}
type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Entra a tu cuenta para continuar." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const adminProcedure = authedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Solo para administradores." });
  return next();
});
