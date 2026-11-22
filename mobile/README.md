# Cosland, app nativa

App de Cosland para Android (y lista para iPhone) hecha con React Native y Expo. Habla con el mismo servidor que la web: mismas cuentas, vitrinas, publicaciones y chats.

- Paquete: `com.cosland.app`
- Apunta a Android 16 (API 36), mínimo Android 7
- Comparte el catálogo con la web desde `../shared`

## Pantallas

Inicio, explorar con filtros, publicación, vitrina con reseñas, directorio de vitrinas, Se busca, favoritos, entrar y crear cuenta, abrir y editar vitrina, publicar y editar con galería y cámara, panel del vendedor, bandeja y chat en vivo con ofertas, compra segura y eliminar cuenta. El panel de administración se abre en la web.

## Probarla en tu teléfono (sin compilar)

1. Instala **Expo Go** desde Play Store.
2. En PowerShell, dentro del repo:

```powershell
cd mobile
npm install
$env:EXPO_PUBLIC_API_URL="https://TU-DIRECCION"
npx expo start
```

3. Escanea el código QR con Expo Go. El teléfono y la PC deben estar en la misma red wifi.

## Compilar para Play Store

GitHub compila la app sola cada vez que cambia algo de `mobile/` en `main`. El resultado queda en repo → **Actions** → **App Android nativa (APK y AAB)** → la ejecución más reciente → **Artifacts**.

La dirección del servidor y la versión salen de `mobile/release.json`. Cada vez que subas una versión nueva a Play, aumenta `versionCode` en 1.

- Sin llave de firma: sale un APK de prueba para instalar en tu teléfono.
- Con los secretos `ANDROID_KEYSTORE_BASE64` y `ANDROID_KEYSTORE_PASSWORD`: salen el APK y el AAB firmados. El `.aab` es el que se sube a Play.

Cómo crear la llave está en `../android/README.md`, sección "Llave de firma".

## Comandos

```powershell
npm run check          # revisión de tipos
npm run export:android # empaqueta el código para Android (sin compilar la app)
npm run export:web     # versión para navegador, usada en las pruebas
```

## Dónde está cada cosa

```
src/app/   pantallas (cada archivo es una ruta)
src/ui/    componentes: toldo, tarjetas, formularios, fotos, animación de entrada
src/lib/   conexión con el servidor, sesión, chat en vivo, colores
assets/    íconos, tipografía y logo vectorial
plugins/   firma de la versión para Play Store
```

## Pendiente

Las notificaciones con la app cerrada (push) necesitan un proyecto de Firebase; el chat ya es en vivo con la app abierta.
