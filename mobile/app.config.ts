import fs from "node:fs";
import path from "node:path";
import type { ExpoConfig } from "expo/config";

// Avisos con la app cerrada: se activan si al compilar existe mobile/google-services.json (el archivo del proyecto de Firebase).
// Sin él la app compila igual y solo avisa mientras está abierta.
const googleServices = fs.existsSync(path.join(__dirname, "google-services.json")) ? "./google-services.json" : undefined;

// La dirección del servidor de Cosland se fija al compilar:
//   EXPO_PUBLIC_API_URL=https://tu-dominio.com
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
const host = apiUrl.replace(/^https?:\/\//, "");

const config: ExpoConfig = {
  name: "Cosland",
  slug: "cosland",
  scheme: "cosland",
  version: process.env.APP_VERSION_NAME ?? "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  backgroundColor: "#fbf1dc",
  android: {
    package: "com.cosland.app",
    ...(googleServices ? { googleServicesFile: googleServices } : {}),
    versionCode: Number(process.env.APP_VERSION_CODE ?? 1),
    adaptiveIcon: {
      backgroundColor: "#2a211c",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    softwareKeyboardLayoutMode: "resize",
    blockedPermissions: ["android.permission.SYSTEM_ALERT_WINDOW", "android.permission.RECORD_AUDIO"],
    // Los enlaces compartidos de publicaciones y vitrinas abren directo en la app
    intentFilters: host
      ? [{
          action: "VIEW",
          autoVerify: true,
          data: [
            { scheme: "https", host, pathPrefix: "/p/" },
            { scheme: "https", host, pathPrefix: "/v/" },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        }]
      : [],
  },
  ios: { bundleIdentifier: "com.cosland.app", supportsTablet: false },
  web: { favicon: "./assets/favicon.png", bundler: "metro", output: "single" },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { backgroundColor: "#fbf1dc", image: "./assets/splash-icon.png", imageWidth: 200 }],
    "expo-secure-store",
    ["expo-image-picker", {
      photosPermission: "Cosland usa tus fotos para que las subas a tus publicaciones y a tu vitrina.",
      cameraPermission: "Cosland usa la cámara para que tomes fotos de lo que publicas.",
      microphonePermission: false,
    }],
    // Solo se reproduce la voz de bienvenida: sin micrófono ni reproducción en segundo plano
    ["expo-audio", { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false, enableBackgroundRecording: false }],
    // APK más liviano: solo los procesadores de teléfonos reales (sin los de emuladores) y librerías comprimidas
    ["expo-build-properties", { android: { buildArchs: ["arm64-v8a", "armeabi-v7a"], useLegacyPackaging: true } }],
    // Notificaciones del teléfono: icono blanco de la carita y color de la marca
    ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#2a211c", defaultChannel: "avisos" }],
    ["expo-local-authentication", { faceIDPermission: "Cosland usa Face ID para desbloquear la app." }],
    "./plugins/withReleaseSigning",
    // Para que la web sepa que la app ya está instalada y no siga ofreciendo descargarla
    ["./plugins/withWebLink", { site: apiUrl }],
  ],
};

export default config;
