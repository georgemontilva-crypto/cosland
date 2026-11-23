import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Camera, ImagePlus, X } from "lucide-react-native";
import { img, uploadImage } from "@/lib/api";
import { BORDER, C } from "@/lib/theme";
import { Btn, T, Tag, useToast } from "./core";

async function pick(source: "camera" | "library", limit: number) {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Activa el permiso de cámara en los ajustes del teléfono para tomar fotos.");
    return ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
  }
  return ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: limit > 1, selectionLimit: limit });
}

function usePicker(onAdd: (urls: string[]) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(0);
  const run = async (source: "camera" | "library", limit: number) => {
    try {
      const res = await pick(source, limit);
      if (res.canceled) return;
      const assets = res.assets.slice(0, limit);
      setBusy(assets.length);
      const urls: string[] = [];
      for (const a of assets) {
        try { urls.push(await uploadImage(a.uri, a.mimeType)); } catch (e) { toast((e as Error).message, true); }
        setBusy((b) => Math.max(0, b - 1));
      }
      if (urls.length) onAdd(urls);
    } catch (e) { toast((e as Error).message, true); setBusy(0); }
  };
  return { busy, run };
}

// Varias fotos; la primera es la portada
export function PhotosInput({ value, onChange, max = 8 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const { busy, run } = usePicker((urls) => onChange([...value, ...urls].slice(0, max)));
  const left = max - value.length - busy;
  const cover = (i: number) => { const v = [...value]; const [x] = v.splice(i, 1); v.unshift(x); onChange(v); };
  const tile = { width: "31%" as const, aspectRatio: 1, borderRadius: 18, overflow: "hidden" as const };
  return (
    <View style={{ gap: 10 }}>
      {(value.length > 0 || busy > 0) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {value.map((src, i) => (
            <View key={src} style={[tile, { borderWidth: BORDER, borderColor: C.ink, backgroundColor: C.oat }]}>
              <Image source={{ uri: img(src)! }} style={{ width: "100%", height: "100%" }} contentFit="contain" accessibilityLabel={`Foto ${i + 1}`} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Quitar foto ${i + 1}`} onPress={() => onChange(value.filter((_, j) => j !== i))} hitSlop={6}
                style={{ position: "absolute", top: 4, right: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: C.paper, borderWidth: BORDER, borderColor: C.ink, alignItems: "center", justifyContent: "center" }}>
                <X size={15} color={C.ink} />
              </Pressable>
              <Pressable disabled={i === 0} accessibilityRole="button" accessibilityLabel={i === 0 ? "Portada" : `Usar la foto ${i + 1} de portada`} onPress={() => cover(i)} style={{ position: "absolute", left: 4, bottom: 4 }}>
                <Tag label={i === 0 ? "Portada" : "De portada"} />
              </Pressable>
            </View>
          ))}
          {Array.from({ length: busy }).map((_, i) => <View key={`b${i}`} style={[tile, { backgroundColor: C.oat, alignItems: "center", justifyContent: "center" }]}><T size={12} color={C.cocoa}>Subiendo…</T></View>)}
        </View>
      )}
      {left > 0 && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Btn label="Elegir de la galería" grow icon={<ImagePlus size={18} color={C.ink} />} onPress={() => run("library", left)} />
          {Platform.OS !== "web" && <Btn label="Cámara" icon={<Camera size={18} color={C.ink} />} onPress={() => run("camera", 1)} />}
        </View>
      )}
      <T size={13} color={C.cocoa}>Hasta {max} fotos. Muestra el artículo completo, los detalles y cualquier desgaste.</T>
    </View>
  );
}

export function SinglePhoto({ value, onChange, label, round }: { value: string | null; onChange: (v: string | null) => void; label: string; round?: boolean }) {
  const { busy, run } = usePicker((urls) => onChange(urls[0]));
  const uri = img(value);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => run("library", 1)}
        style={[{ borderWidth: BORDER, borderColor: C.ink, borderStyle: uri ? "solid" : "dashed", backgroundColor: C.paper, alignItems: "center", justifyContent: "center", overflow: "hidden" }, round ? { width: 88, height: 88, borderRadius: 44 } : { width: 150, height: 74, borderRadius: 18 }]}>
        {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : busy ? <T size={12} color={C.cocoa}>Subiendo…</T> : <ImagePlus size={22} color={C.ink} />}
      </Pressable>
      <View style={{ gap: 6, alignItems: "flex-start" }}>
        <Btn small label={value ? "Cambiar" : label} busy={busy > 0} onPress={() => run("library", 1)} />
        {value ? <Pressable accessibilityRole="button" onPress={() => onChange(null)} hitSlop={6}><T size={13.5} color={C.cocoa} style={{ textDecorationLine: "underline" }}>Quitar</T></Pressable> : null}
      </View>
    </View>
  );
}
