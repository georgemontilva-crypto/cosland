# Avisos del teléfono en la app Android

La app avisa con el sonido y la notificación del teléfono cuando llega un mensaje, un pedido, un seguidor o alguien guarda una publicación.

- **Con la app abierta:** funciona sin configurar nada.
- **Con la app cerrada o en segundo plano:** Android solo entrega avisos a través de Firebase Cloud Messaging (gratis). Hay que conectarlo una vez, con los pasos de abajo. Mientras no se haga, la app compila y funciona igual, pero no avisa estando cerrada.

## Conectar Firebase (una sola vez)

### 1. Crear el proyecto

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google.
2. **Crear un proyecto** → nombre `Cosland` → puedes desactivar Google Analytics → **Crear proyecto**.

### 2. Registrar la app Android y pasar el archivo a GitHub

1. En la portada del proyecto pulsa el icono de **Android**.
2. Nombre del paquete: `com.cosland.app` (exacto). Lo demás, vacío. **Registrar app**.
3. **Descargar google-services.json**. Los pasos siguientes del asistente se pueden saltar.
4. Abre el archivo con el Bloc de notas y copia todo su contenido.
5. En GitHub: repo `cosland` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Name: `GOOGLE_SERVICES_JSON`
   - Secret: pega el contenido del archivo.
   - **Add secret**.

### 3. Darle permiso al servidor para enviar

1. En Firebase: engranaje (arriba a la izquierda) → **Configuración del proyecto** → pestaña **Cuentas de servicio**.
2. **Generar nueva clave privada** → **Generar clave**. Se descarga un archivo `.json`. Es una llave: no la subas al repo ni la compartas.
3. Abre ese archivo con el Bloc de notas y copia todo su contenido.
4. En Railway: proyecto de Cosland → servicio de la web → **Variables** → **New Variable**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: pega el contenido del archivo.
   - Guarda. Railway vuelve a desplegar solo.

### 4. Compilar la app de nuevo

GitHub → **Actions** → **App Android nativa** → **Run workflow**. En el registro del paso «Preparar Firebase» debe decir `Firebase listo: proyecto …`.
Instala el APK nuevo, entra a tu cuenta y acepta el permiso de notificaciones.

## Cómo probar

Con dos cuentas en dos teléfonos (o una en la web): cierra la app en uno y envíale un mensaje desde el otro. Debe sonar y aparecer la notificación; al tocarla se abre ese chat.

Si no llega: en el teléfono, Ajustes → Apps → Cosland → Notificaciones (deben estar permitidas) y Batería → sin restricciones. Algunas marcas (Xiaomi, Huawei, Oppo) cortan los avisos de las apps que se cierran desde recientes.

## Bloqueo con huella

Cuenta → **Pedir huella al abrir**. Usa la huella, el rostro o el PIN del teléfono. Vuelve a pedirla al abrir la app o al regresar después de un minuto fuera.
