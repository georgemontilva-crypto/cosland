import { Linking, Platform } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

// Avisos del teléfono (notificación, sonido y vibración) en la app Android.
// - Con la app abierta: suena el tono de aviso y el mensajito sale dentro de la app.
// - Con la app en segundo plano o cerrada: llega la notificación normal de Android.
const NATIVE = Platform.OS !== "web";
const CHANNEL = "avisos";
let ready = false;

export function setupAlerts() {
  if (!NATIVE || ready) return;
  ready = true;
  // Con la app a la vista no se muestra la notificación (ya sale el mensajito adentro): solo suena
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: true, shouldSetBadge: false }),
  });
  Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Mensajes y ventas", importance: Notifications.AndroidImportance.HIGH, sound: "default",
    vibrationPattern: [0, 220, 120, 220], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  }).catch(() => {});
}

// Android 13 o más nuevo pide permiso para mostrar notificaciones. Devuelve si quedaron permitidas.
export async function alertsAllowed(ask = false): Promise<boolean> {
  if (!NATIVE) return false;
  try {
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted && ask && p.canAskAgain) p = await Notifications.requestPermissionsAsync();
    return p.granted;
  } catch { return false; }
}

// Aviso inmediato desde la propia app (por ejemplo, al llegar un mensaje por el canal en vivo)
export function showAlert(a: { title: string; body: string; url?: string; tag?: string }) {
  if (!NATIVE) return;
  Notifications.scheduleNotificationAsync({
    identifier: a.tag, // el mismo tema reemplaza al anterior en vez de apilarse
    content: { title: a.title, body: a.body, sound: "default", data: a.url ? { url: a.url } : {} },
    trigger: { channelId: CHANNEL },
  }).catch(() => {});
}

// Token de Firebase de este teléfono, para que el servidor le mande avisos con la app cerrada.
// Si la app se compiló sin Firebase, no hay token y devuelve null.
export async function deviceToken(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  try {
    const t = await Notifications.getDevicePushTokenAsync();
    return typeof t.data === "string" && t.data.length > 20 ? t.data : null;
  } catch { return null; }
}

// Al entrar a la app se limpian las notificaciones ya vistas y el número del icono
export const clearAlerts = () => {
  if (!NATIVE) return;
  Notifications.dismissAllNotificationsAsync().catch(() => {});
  Notifications.setBadgeCountAsync(0).catch(() => {});
};

// Para el ajuste de Cuenta: si el teléfono ya no deja volver a preguntar, se abre la pantalla de ajustes de la app
export async function turnOnAlerts(): Promise<boolean> {
  if (!NATIVE) return false;
  if (await alertsAllowed(true)) return true;
  Linking.openSettings().catch(() => {});
  return false;
}
export const openAlertSettings = () => { if (NATIVE) Linking.openSettings().catch(() => {}); };

// Al tocar una notificación se abre la pantalla que corresponde (el chat, Pedidos, la publicación)
function open(r: Notifications.NotificationResponse | null) {
  if (!r) return;
  const req = r.notification.request;
  const remote = (req.trigger as { remoteMessage?: { data?: Record<string, string> } } | null)?.remoteMessage?.data;
  const url = (req.content.data as { url?: unknown } | null)?.url ?? remote?.url;
  if (typeof url === "string" && url.startsWith("/")) setTimeout(() => router.push(url as never), 0);
}
export function listenAlertTaps() {
  if (!NATIVE) return () => {};
  try { open(Notifications.getLastNotificationResponse()); } catch { /* sin aviso pendiente */ }
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
