// Firma de la versión para Play Store: si al compilar existe ANDROID_KEYSTORE_PATH, la versión
// "release" se firma con esa llave; si no, usa la llave de prueba (sirve para instalar y probar).
const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE = `signingConfigs {
        release {
            if (System.getenv("ANDROID_KEYSTORE_PATH")) {
                storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS") ?: "cosland"
                keyPassword System.getenv("ANDROID_KEY_PASSWORD") ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes("ANDROID_KEYSTORE_PATH")) return cfg;
    const withConfig = gradle.replace(/signingConfigs\s*\{/, RELEASE);
    const withRelease = withConfig.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig System.getenv("ANDROID_KEYSTORE_PATH") ? signingConfigs.release : signingConfigs.debug',
    );
    if (withConfig === gradle || withRelease === withConfig) {
      throw new Error("withReleaseSigning: no se encontró el bloque de firma en build.gradle; revisa la plantilla de Expo.");
    }
    cfg.modResults.contents = withRelease;
    return cfg;
  });
};
