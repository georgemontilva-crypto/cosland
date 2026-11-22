# Cosland para Android, versión web empaquetada (respaldo)

La app principal es la nativa, en `../mobile`. Esta carpeta queda como respaldo: una app Android que abre la web de Cosland a pantalla completa (Trusted Web Activity).

Las dos usan el mismo paquete, así que a Play Store se sube una sola.

- Paquete: `com.cosland.app`
- Apunta a Android 16 (API 36), mínimo Android 5.0
- Basado en la plantilla de Bubblewrap (GoogleChromeLabs), licencia Apache 2.0

## Compilar en GitHub

1. Repo → pestaña **Actions** → **App Android web, de respaldo (APK y AAB)** → **Run workflow**.
2. Escribe la dirección de la web sin `https://` y pulsa **Run workflow**.
3. Al terminar, abre la ejecución y descarga el archivo de **Artifacts**.

Sin llave de firma sale `app-debug.apk`, que sirve para probar en un teléfono.
Con la llave salen `app-release.apk` y `app-release.aab`; el `.aab` es el que se sube a Play Store.

## Llave de firma (una sola vez)

En PowerShell:

```powershell
winget install EclipseAdoptium.Temurin.17.JDK
```

Cierra y vuelve a abrir PowerShell, y crea la llave (te pide una contraseña y unos datos):

```powershell
keytool -genkeypair -v -keystore "$HOME\cosland.keystore" -alias cosland -keyalg RSA -keysize 2048 -validity 10000 -storetype PKCS12
```

Copia la llave al portapapeles en formato de texto:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\cosland.keystore")) | Set-Clipboard
```

En GitHub: repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, y crea dos:

- `ANDROID_KEYSTORE_BASE64`: pega lo del portapapeles.
- `ANDROID_KEYSTORE_PASSWORD`: la contraseña que pusiste.

Guarda `cosland.keystore` y su contraseña en un lugar seguro: con esa llave se firman todas las actualizaciones.

## Quitar la barra de direcciones

La app solo abre a pantalla completa si la web confirma que la app es suya.

1. La ejecución de GitHub muestra la **huella SHA-256** de tu llave en su resumen.
2. En Railway crea la variable `ANDROID_SHA256` con esa huella.
3. Después de subir el AAB, Play Console muestra la huella de su propia llave de firma (sección de integridad de la app). Agrégala a la misma variable separada por una coma.

Comprobación: `https://TU-DOMINIO/.well-known/assetlinks.json` debe mostrar las huellas.

## Compilar en tu PC (opcional)

Con Android Studio instalado:

```powershell
cd android
.\gradlew.bat assembleDebug -PtwaHost=TU-DOMINIO
```

## Datos para la ficha de Play Store

- Política de privacidad: `https://TU-DOMINIO/privacidad`
- Eliminación de cuenta: `https://TU-DOMINIO/eliminar-cuenta`
- Ícono de 512 px: `android/store_icon.png`
