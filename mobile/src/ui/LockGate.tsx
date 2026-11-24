import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, Platform, Pressable, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { Fingerprint } from "lucide-react-native";
import { getFlag, hasSavedSession, setFlag } from "@/lib/api";
import { useSession } from "@/lib/session";
import { C } from "@/lib/theme";
import { Btn, T } from "./core";

// Bloqueo opcional de la app con huella (o el método del teléfono: rostro, PIN o patrón).
// Se enciende en Cuenta. Con él, al abrir Cosland o volver después de un rato hay que desbloquear.
const KEY = "cosland_huella";
const RELOCK_MS = 60_000; // tiempo fuera de la app tras el que vuelve a pedir la huella
const NATIVE = Platform.OS !== "web";
export const lockEnabled = () => NATIVE && getFlag(KEY) === "1";

async function ask(promptMessage: string) {
  try { return await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: "Cancelar" }); }
  catch { return { success: false as const, error: "unknown" as const }; }
}
// El teléfono ya no tiene con qué desbloquear: no se puede sostener el bloqueo
const noWay = (error: string) => ["not_enrolled", "passcode_not_set", "not_available"].includes(error);

// Encender o apagar el bloqueo desde Cuenta. Devuelve el mensaje para mostrar.
export async function setLock(on: boolean): Promise<{ ok: boolean; text: string }> {
  if (!NATIVE) return { ok: false, text: "El bloqueo con huella está en la app para Android." };
  try {
    if (on) {
      if (!(await LocalAuthentication.hasHardwareAsync())) return { ok: false, text: "Este teléfono no tiene lector de huella ni desbloqueo por rostro." };
      if (!(await LocalAuthentication.isEnrolledAsync())) return { ok: false, text: "Primero registra tu huella en los ajustes del teléfono." };
    }
    const r = await ask(on ? "Confirma para proteger Cosland" : "Confirma para quitar el bloqueo");
    if (!r.success) return { ok: false, text: "No se confirmó. No cambió nada." };
    setFlag(KEY, on ? "1" : "0");
    return { ok: true, text: on ? "Listo. Cosland pedirá tu huella al abrir." : "Bloqueo con huella desactivado" };
  } catch { return { ok: false, text: "No se pudo usar la huella en este teléfono." }; }
}

export default function LockGate() {
  const { signOut } = useSession();
  const [locked, setLocked] = useState(() => lockEnabled() && hasSavedSession());
  const leftAt = useRef(0), asking = useRef(false);

  const unlock = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    const r = await ask("Desbloquea Cosland");
    asking.current = false;
    if (r.success) return setLocked(false);
    if (noWay(r.error)) { setFlag(KEY, "0"); setLocked(false); }
  }, []);

  useEffect(() => {
    if (!NATIVE) return;
    const sub = AppState.addEventListener("change", (st) => {
      if (st !== "active") { if (!leftAt.current) leftAt.current = Date.now(); return; }
      const away = leftAt.current ? Date.now() - leftAt.current : 0;
      leftAt.current = 0;
      // (el propio diálogo de la huella puede sacar la app de primer plano un instante: eso no cuenta)
      if (!asking.current && away > RELOCK_MS && lockEnabled() && hasSavedSession()) setLocked(true);
    });
    return () => sub.remove();
  }, []);

  // Al quedar bloqueada, pide la huella de una vez
  useEffect(() => { if (locked) { const t = setTimeout(unlock, 350); return () => clearTimeout(t); } }, [locked, unlock]);

  if (!locked) return null;
  return (
    <View accessibilityViewIsModal style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, backgroundColor: C.cream, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
      <Image source={require("../../assets/icon.png")} style={{ width: 96, height: 96, borderRadius: 24 }} accessibilityIgnoresInvertColors />
      <T w="black" size={22} center>Cosland está bloqueada</T>
      <T color={C.cocoa} center>Usa tu huella o el desbloqueo de tu teléfono para entrar.</T>
      <Btn label="Desbloquear" kind="ink" icon={<Fingerprint size={18} color={C.cream} />} onPress={unlock} style={{ minWidth: 220, marginTop: 6 }} />
      <Pressable accessibilityRole="button" hitSlop={8} onPress={async () => { setFlag(KEY, "0"); await signOut(); setLocked(false); }} style={{ paddingVertical: 8 }}>
        <T color={C.cocoa} style={{ textDecorationLine: "underline" }}>Salir de la cuenta</T>
      </Pressable>
    </View>
  );
}
