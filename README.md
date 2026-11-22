# Cosland

Mercado de la comunidad cosplayer, otaku y geek. Cada vendedor tiene su vitrina y publica artículos (cosplays, pelucas, props, figuras, manga, merch) o servicios (costura, props por encargo, peinado, maquillaje, fotografía).

## Qué incluye

- Cuentas con correo y contraseña.
- Vitrinas con toldo de color, foto, portada, redes, WhatsApp y datos de tienda física.
- Publicaciones en venta, alquiler o por encargo, con fotos, talla, medidas, serie, personaje y opción de cambio.
- Explorar con búsqueda y filtros (categoría, condición, talla, precio, ciudad).
- Favoritos, seguir vitrinas, reseñas (solo de quien ya le escribió a la vitrina).
- Chat interno con ofertas de precio, además del botón de WhatsApp.
- "Se busca": tablero de pedidos que los vendedores responden.
- Denuncias y panel de administración (destacar, retirar, verificar vitrinas, suspender cuentas).
- Vista previa al compartir enlaces de publicaciones y vitrinas.

No hay pagos dentro de la plataforma: cada venta se acuerda entre comprador y vendedor.

## Stack

React + Vite + Tailwind 4, tRPC, Drizzle ORM, MySQL, Express. Imágenes en Cloudflare R2 (o en `./uploads` si no hay R2).

## Variables de entorno

Ver `.env.example`. Obligatorias: `DATABASE_URL` y `JWT_SECRET`. Recomendada: `ADMIN_EMAIL` (la cuenta con ese correo queda como administradora).

Sin las variables `R2_*`, las fotos se guardan en el disco del servidor y en Railway se pierden en cada despliegue. Para producción hay que configurar R2.

## Comandos

```bash
npm install
npm run dev          # desarrollo: servidor en :3000 y Vite en :5173
npm run build        # compila cliente y servidor a dist/
npm start            # producción (aplica las migraciones al arrancar)
npm run check        # revisión de tipos
npm run db:generate  # genera una migración después de cambiar server/schema.ts
npm run seed         # carga vitrinas y publicaciones de muestra
npm run seed -- clear  # borra todo lo de muestra
```

## App Android

El proyecto de la app para Play Store está en `android/` y se compila desde GitHub Actions. Los pasos están en `android/README.md`.

## Estructura

```
client/   interfaz (páginas en client/src/pages)
server/   API tRPC, esquema, subida de imágenes
shared/   catálogo de categorías, colores y textos compartidos
drizzle/  migraciones SQL
android/  app Android (abre la web a pantalla completa)
```
