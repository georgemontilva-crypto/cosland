import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { errText, trpc } from "@/lib/api";
import { requireLogin, useSession } from "@/lib/session";
import { C } from "@/lib/theme";
import { Btn, Check2, Empty, Field, H2, Input, Loading, Screen, T, panel, useToast } from "@/ui/core";

export default function DeleteAccount() {
  const { me, loading, signOut } = useSession();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [sure, setSure] = useState(false);
  const del = trpc.auth.deleteAccount.useMutation({
    onSuccess: async () => { await signOut(); toast("Tu cuenta fue eliminada"); router.replace("/"); },
    onError: (e) => toast(errText(e), true),
  });
  return (
    <Screen title="Eliminar mi cuenta">
      {loading ? <Loading /> : !me ? <Empty title="Entra a tu cuenta para eliminarla" action={<Btn label="Entrar" kind="ink" onPress={() => requireLogin("/eliminar-cuenta")} />} /> : (
        <View style={{ gap: 18 }}>
          <View>
            <H2>Qué se borra</H2>
            {["Tu cuenta: nombre, correo y contraseña.", "Tu vitrina, todas tus publicaciones y sus fotos.", "Tus conversaciones, favoritos, reseñas, pedidos de “Se busca” y denuncias."].map((line) => (
              <View key={line} style={{ flexDirection: "row", gap: 10, marginTop: 8 }}><T>•</T><T style={{ flex: 1 }}>{line}</T></View>
            ))}
            <T color={C.cocoa} style={{ marginTop: 12 }}>El borrado es inmediato y no se puede deshacer.</T>
          </View>
          <View style={[panel, { padding: 18, gap: 16 }]}>
            <T>Vas a eliminar la cuenta de <T w="black">{me.email}</T>.</T>
            <Field label="Confirma con tu contraseña"><Input value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" accessibilityLabel="Confirma con tu contraseña" /></Field>
            <Check2 value={sure} onChange={setSure} label="Entiendo que se borra todo y no se puede recuperar" />
            <Btn label="Eliminar mi cuenta" kind="danger" busy={del.isPending} disabled={!sure || !password} onPress={() => del.mutate({ password })} />
          </View>
        </View>
      )}
    </Screen>
  );
}
