import { useState } from "react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Awning, Field } from "@/components/ui";

export default function Auth({ mode }: { mode: "login" | "register" }) {
  const back = new URLSearchParams(useSearch()).get("volver");
  const dest = back && back.startsWith("/") && !back.startsWith("//") ? back : mode === "register" ? "/mi-vitrina" : "/";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const done = () => { location.href = dest; };
  const fieldError = (e: { message: string }) => {
    try { const issues = JSON.parse(e.message); if (Array.isArray(issues) && issues[0]?.message) return issues[0].message as string; } catch { /* mensaje normal */ }
    return e.message;
  };
  const login = trpc.auth.login.useMutation({ onSuccess: done, onError: (e) => setError(fieldError(e)) });
  const register = trpc.auth.register.useMutation({ onSuccess: done, onError: (e) => setError(fieldError(e)) });
  const busy = login.isPending || register.isPending;
  const up = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const suffix = back ? `?volver=${encodeURIComponent(back)}` : "";

  return (
    <div className="wrap py-8 md:py-14 grid place-items-center">
      <div className="panel overflow-hidden w-full max-w-md">
        <Awning accent={mode === "login" ? "ramune" : "sakura"} size={34} />
        <div className="p-6 md:p-8">
          <h1 className="text-3xl">{mode === "login" ? "Entra a tu cuenta" : "Crea tu cuenta"}</h1>
          <p className="text-cocoa mt-1.5">{mode === "login" ? "Sigue donde lo dejaste." : "Con una cuenta puedes comprar, guardar favoritos y abrir tu vitrina."}</p>
          <form
            className="grid gap-4 mt-6"
            onSubmit={(e) => {
              e.preventDefault(); setError("");
              if (mode === "login") login.mutate({ email: form.email, password: form.password });
              else register.mutate(form);
            }}
          >
            {mode === "register" && <Field label="Tu nombre"><input className="input" required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={up("name")} /></Field>}
            <Field label="Correo"><input className="input" type="email" required autoComplete="email" value={form.email} onChange={up("email")} /></Field>
            <Field label="Contraseña" hint={mode === "register" ? "Mínimo 8 caracteres." : undefined}>
              <input className="input" type="password" required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={up("password")} />
            </Field>
            {error && <p role="alert" className="rounded-2xl bg-sakura/60 px-4 py-2.5 font-bold text-sm">{error}</p>}
            <button className="btn btn-ink" disabled={busy}>{busy ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}</button>
          </form>
          <p className="mt-5 text-center">
            {mode === "login"
              ? <>¿Primera vez? <Link href={`/registro${suffix}`} className="font-bold underline underline-offset-4">Crea tu cuenta</Link></>
              : <>¿Ya tienes cuenta? <Link href={`/entrar${suffix}`} className="font-bold underline underline-offset-4">Entra</Link></>}
          </p>
        </div>
      </div>
    </div>
  );
}
