import { router } from "expo-router";
import { requireLogin, useSession } from "@/lib/session";
import { Btn, Empty, Loading, Screen } from "@/ui/core";
import { ShopForm } from "@/ui/forms";

export default function EditShop() {
  const { me, loading } = useSession();
  return (
    <Screen title={me?.shop ? "Editar vitrina" : "Abre tu vitrina"}>
      {loading ? <Loading /> : !me
        ? <Empty title="Entra para abrir tu vitrina" text="Solo necesitas un correo y una contraseña." action={<Btn label="Entrar" kind="ink" onPress={() => requireLogin("/vitrina-editar")} />} />
        : <ShopForm onDone={() => (router.canGoBack() ? router.back() : router.replace("/cuenta"))} />}
    </Screen>
  );
}
