import { useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { errText, trpc } from "@/lib/api";
import { openWebPage } from "@/lib/actions";
import { useSession } from "@/lib/session";
import { C } from "@/lib/theme";
import { Awning, Btn, Field, Input, Screen, T, panel } from "@/ui/core";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { volver } = useLocalSearchParams<{ volver?: string }>();
  const { signIn } = useSession();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const done = async (r: { token: string | null }) => {
    if (!r.token) { setError("No se pudo iniciar la sesión. Actualiza la app."); return; }
    await signIn(r.token);
    const dest = volver && volver.startsWith("/") ? volver : mode === "register" ? "/cuenta" : "/";
    if (router.canDismiss()) router.dismissAll();
    router.replace(dest as never);
  };
  const login = trpc.auth.login.useMutation({ onSuccess: done, onError: (e) => setError(errText(e)) });
  const register = trpc.auth.register.useMutation({ onSuccess: done, onError: (e) => setError(errText(e)) });
  const busy = login.isPending || register.isPending;
  const submit = () => {
    setError("");
    if (mode === "login") login.mutate({ email: form.email.trim(), password: form.password });
    else register.mutate({ name: form.name.trim(), email: form.email.trim(), password: form.password });
  };
  const other = () => router.replace({ pathname: mode === "login" ? "/registro" : "/entrar", params: volver ? { volver } : {} });

  return (
    <Screen title="">
      <View style={panel}>
        <Awning accent={mode === "login" ? "ramune" : "sakura"} size={32} />
        <View style={{ padding: 22, gap: 16 }}>
          <View>
            <T w="black" size={28} accessibilityRole="header">{mode === "login" ? "Entra a tu cuenta" : "Crea tu cuenta"}</T>
            <T color={C.cocoa} style={{ marginTop: 4 }}>{mode === "login" ? "Sigue donde lo dejaste." : "Con una cuenta puedes comprar, guardar favoritos y abrir tu vitrina."}</T>
          </View>
          {mode === "register" && <Field label="Tu nombre"><Input value={form.name} onChangeText={(name) => setForm({ ...form, name })} autoComplete="name" maxLength={80} accessibilityLabel="Tu nombre" /></Field>}
          <Field label="Correo"><Input value={form.email} onChangeText={(email) => setForm({ ...form, email })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" accessibilityLabel="Correo" /></Field>
          <Field label="Contraseña" hint={mode === "register" ? "Mínimo 8 caracteres." : undefined}>
            <Input value={form.password} onChangeText={(password) => setForm({ ...form, password })} secureTextEntry autoCapitalize="none" autoComplete={mode === "login" ? "current-password" : "new-password"} onSubmitEditing={submit} accessibilityLabel="Contraseña" />
          </Field>
          {error ? <View style={{ backgroundColor: "rgba(246,195,207,0.7)", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }} accessibilityRole="alert"><T w="bold" size={14}>{error}</T></View> : null}
          <Btn label={mode === "login" ? "Entrar" : "Crear cuenta"} kind="ink" busy={busy} disabled={!form.email || !form.password || (mode === "register" && !form.name)} onPress={submit} />
          {mode === "register" && (
            <T size={13.5} color={C.cocoa} center>
              Al crear tu cuenta aceptas los <T size={13.5} w="bold" style={{ textDecorationLine: "underline" }} onPress={() => openWebPage("/terminos")}>Términos de uso</T> y la <T size={13.5} w="bold" style={{ textDecorationLine: "underline" }} onPress={() => openWebPage("/privacidad")}>Política de privacidad</T>.
            </T>
          )}
          <Pressable accessibilityRole="link" onPress={other} hitSlop={8} style={{ alignSelf: "center" }}>
            <T center>{mode === "login" ? "¿Primera vez? " : "¿Ya tienes cuenta? "}<T w="bold" style={{ textDecorationLine: "underline" }}>{mode === "login" ? "Crea tu cuenta" : "Entra"}</T></T>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

export default function Login() { return <AuthForm mode="login" />; }
