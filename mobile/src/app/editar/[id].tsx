import { useLocalSearchParams } from "expo-router";
import { Screen } from "@/ui/core";
import { ListingForm } from "@/ui/forms";
export default function Edit() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  return <Screen title="Editar publicación"><ListingForm id={id} /></Screen>;
}
