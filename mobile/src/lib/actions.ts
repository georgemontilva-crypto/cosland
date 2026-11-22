import { Linking, Platform, Share } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { webUrl } from "./api";

// Compartir un enlace de Cosland con la hoja del sistema
export async function shareLink(title: string, path: string, toast: (t: string, bad?: boolean) => void) {
  const url = webUrl(path);
  try {
    if (Platform.OS === "web") {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) await nav.share({ title, url });
      else { await nav?.clipboard?.writeText(url); toast("Enlace copiado"); }
    } else {
      await Share.share(Platform.OS === "ios" ? { url, title } : { message: `${title}\n${url}`, title });
    }
  } catch { /* la persona canceló */ }
}

export const openExternal = (url: string) => Linking.openURL(url).catch(() => {});
// Páginas de la web (términos, privacidad) dentro de un navegador de la app
export const openWebPage = (path: string) => WebBrowser.openBrowserAsync(webUrl(path), { toolbarColor: "#fbf1dc", controlsColor: "#2a211c" }).catch(() => {});
