# Spec: public-catalog-arch

Scope: repo

# Public Catalog Architecture

Arquitectura para servir un catalogo publico a la landing page **sin duplicar la base de datos** de optikt. Guia reusable para cualquier trabajo futuro sobre el catalogo publico, el public-api o el almacen de imagenes.

## Servicios

- **optikt-app** (este repo, SvelteKit): gestion interna + seccion "Publicacion Web" (reusa auth/usuarios/audit) + subida de imagenes a MinIO.
- **public-api** (repo aparte, **Go**, binario unico): servicio de **solo lectura** que se conecta a la misma DB de optikt con un rol PostgreSQL de solo lectura y expone REST/JSON para la landing. Es el unico componente que se vuelve publico a internet.
- **MinIO** (infraestructura docker, no codigo custom): almacen S3-compatible en el servidor local de optikt (4TB). Compartido por optikt-app (escritura/subida) y public-api (sirve URLs de lectura).

## Principios inviolables

1. **Cero duplicacion de datos**: una sola base de datos (la de optikt). La data de publicacion vive en la misma DB, no en una DB de la landing.
2. **La DB nunca se expone a internet**. Se expone el public-api y MinIO (lectura publica) via tunnel; Postgres queda solo en la red local/Tailscale.
3. **El contrato compartido son vistas SQL** (`public_catalog_products`, `public_brands`) definidas en una migracion Drizzle dentro de optikt-app. El public-api lee las vistas; optikt-app escribe las tablas subyacentes. Esto resuelve el compartir schema entre lenguajes distintos (TS Drizzle vs Go) sin duplicar la fuente de verdad del contrato.
4. **Minima superficie publica**: el borde publico es un binario Go chico y auditable de solo lectura, no la app Node/SvelteKit completa. Un rol PG de solo lectura limita el impacto de un compromiso.
5. **La gestion de "que mostrar" vive en optikt-app**, no en la landing. La landing es un consumidor publico de solo lectura, sin panel admin.

## Modelo de datos de publicacion (migracion Drizzle en optikt-app)

- `product_publications` (productId PK/FK -> products, isPublished bool, isFeatured bool, webSortOrder int, webDescription text nullable, webPrice numeric nullable, publishedAt timestamptz, updatedAt timestamptz). 1:1 con products.
- `brand_publications` (brandId PK/FK -> brands, isPublished bool, isFeatured bool, webSortOrder int, webDescription text nullable, publishedAt timestamptz, updatedAt timestamptz). 1:1 con brands.
- Vistas `public_catalog_products` y `public_brands`: proyeccion publica = JOIN de products/brands con sus publicaciones WHERE isPublished = true, exponiendo solo columnas publicas (sku, nombre, marca, tipo, descripcion-web, precio-web, imagen-url, featured, sort). **Nunca** exponer precios de compra, stock interno, datos de clientes, proveedores ni columnas operativas.
- Rol PostgreSQL `optikt_public_reader`: GRANT SELECT unicamente sobre las vistas; revocar todo lo demas. Credencial en `PUBLIC_DB_URL` (`.env.example`).

## Imagenes (MinIO)

- Bucket `optikt-media` con prefijo publico de lectura. Las URLs publicas usan `MINIO_PUBLIC_BASE_URL`.
- Las claves/URL se guardan en las columnas **existentes** `products.imageUrl`, `brands.logoUrl`, `settings.businessLogo` (varchar). **No se anaden columnas** para imagenes.
- optikt-app sube via `@aws-sdk/client-s3` (presigned PUT o subida server-side). Reemplaza el input `type=url` actual en `ProductForm.svelte` (y equivalentes) por un widget de subida.
- El public-api devuelve la URL publica (base MinIO + key) en el JSON; la landing renderiza directamente desde MinIO, sin proxy por el API.
- Thumbnails/transformaciones: pospuesto. Arrancar con la imagen original; anadir `sharp`/imgproxy solo si se requiere.

## Exteriorizacion

- **Ahora**: Tailscale Funnel para el public-api y para MinIO (lectura publica). URLs estables `https://<host>.<tailnet>.ts.net`, gratis, sin dominio, HTTPS automatico. CORS en el public-api para el origen de la landing.
- **Despues (cuando se compre dominio)**: migrar a Cloudflare Tunnel + dominio para obtener CDN/cache de imagenes y reducir el upload del local. Las URLs publicas (`MINIO_PUBLIC_BASE_URL` y la base del public-api) se vuelven configuracion, no codigo.
- Cache-Control fuerte en objetos de MinIO + cache de navegador para mitigar la ausencia de CDN mientras se usa Funnel.

## public-api (Go) — contrato

- Conecta con rol `optikt_public_reader`, lee solo las vistas.
- Endpoints REST/JSON: `GET /catalog/products` (paginado, solo `isPublished`), `GET /catalog/products/:sku`, `GET /brands`, `GET /featured`, `GET /health`.
- Headers `Cache-Control` en respuestas. Spec **OpenAPI** publicado para que la landing genere tipos TS.
- Auth de lectura: API key para la landing (o publico sin key segun decision de producto); sin escritura.
- Docker multi-stage + healthcheck; despliega en el servidor local de optikt junto al stack existente.

## Landing (repo aparte)

- Reemplaza data hardcoded por fetches al public-api (SSR o ISR/SSG con revalidacion).
- Genera tipos TS desde el OpenAPI del public-api.
- Renderiza imagenes desde MinIO. Sin panel admin.

## Hardening

- Rate limiting + request logging + error tracking en public-api.
- Prueba SQL de que `optikt_public_reader` no pueda escribir ni acceder a tablas fuera de las vistas.
- Auditoria de publicacion en optikt-app sigue el patron existente (log fuera de transaccion, best-effort).
- Healthchecks para docker; backups existentes de la DB cubren la data de publicacion.
