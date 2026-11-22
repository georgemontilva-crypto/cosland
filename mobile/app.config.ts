import type { ExpoConfig } from "expo/config";

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
    "./plugins/withReleaseSigning",
  ],
};

export default config;
