import { router } from "expo-router";
import { Btn, Empty, Screen } from "@/ui/core";
export default function NotFound() {
  return <Screen title=""><Empty title="Esta pantalla no existe" text="Puede que el enlace esté mal escrito o que la publicación ya no esté." action={<Btn label="Volver al inicio" kind="ink" onPress={() => router.replace("/")} />} /></Screen>;
}
