# Spec: public-catalog-arch

Scope: repo

# Public Catalog Architecture

Arquitectura para servir un catalogo publico a la landing page **sin duplicar la base de datos** de optikt. Guia reusable para cualquier trabajo futuro sobre el catalogo publico, el public-api o el almacen de imagenes.

## Servicios

- **optikt-app** (este repo, SvelteKit): gestion interna + seccion "Publicacion Web" (reusa auth/usuarios/audit) + subida de imagenes a RustFS.
- **public-api** (repo aparte, **Go**, binario unico): servicio de **solo lectura** que se conecta a la misma DB de optikt con un rol PostgreSQL de solo lectura y expone REST/JSON para la landing. Es el unico componente que se vuelve publico a internet.
- **RustFS** (infraestructura docker, no codigo custom): almacen S3-compatible **privado** escrito en Rust, licencia Apache 2.0, optimizado para single-node (sucesor directo de MinIO tras su archivado en abr-2026). Corre en el servidor local de optikt usando **uno de los 2 discos de 2TB dedicado a media** (el otro disco queda spare/DB/backup). Solo accesible desde la red local/Tailscale. Compartido por optikt-app (escritura/subida de imagenes) y public-api (proxya imagenes en lectura hacia internet). Nunca se expone directamente a internet.

## Principios inviolables

1. **Cero duplicacion de datos**: una sola base de datos (la de optikt). La data de publicacion vive en la misma DB, no en una DB de la landing.
2. **La DB y RustFS nunca se exponen a internet**. Solo el public-api sale via tunnel; Postgres y RustFS quedan en la red local/Tailscale. El public-api proxya las imagenes desde RustFS (mismo host = hop localhost gratis).
3. **El contrato compartido son vistas SQL** (`public_catalog_products`, `public_brands`) definidas en una migracion Drizzle dentro de optikt-app. El public-api lee las vistas; optikt-app escribe las tablas subyacentes. Esto resuelve el compartir schema entre lenguajes distintos (TS Drizzle vs Go) sin duplicar la fuente de verdad del contrato.
4. **Minima superficie publica**: el borde publico es un binario Go chico y auditable de solo lectura, no la app Node/SvelteKit completa. Un rol PG de solo lectura limita el impacto de un compromiso.
5. **La gestion de "que mostrar" vive en optikt-app**, no en la landing. La landing es un consumidor publico de solo lectura, sin panel admin.

## Modelo de datos de publicacion (migracion Drizzle en optikt-app)

- `product_publications` (productId PK/FK -> products, isPublished bool, isFeatured bool, webSortOrder int, webDescription text nullable, webPrice numeric nullable, publishedAt timestamptz, updatedAt timestamptz). 1:1 con products.
- `brand_publications` (brandId PK/FK -> brands, isPublished bool, isFeatured bool, webSortOrder int, webDescription text nullable, publishedAt timestamptz, updatedAt timestamptz). 1:1 con brands.
- Vistas `public_catalog_products` y `public_brands`: proyeccion publica = JOIN de products/brands con sus publicaciones WHERE isPublished = true, exponiendo solo columnas publicas (sku, nombre, marca, tipo, descripcion-web, precio-web, imagen-url, featured, sort). **Nunca** exponer precios de compra, stock interno, datos de clientes, proveedores ni columnas operativas.
- Rol PostgreSQL `optikt_public_reader`: GRANT SELECT unicamente sobre las vistas; revocar todo lo demas. Credencial en `PUBLIC_DB_URL` (`.env.example`).

## Imagenes (RustFS privado + sharp + proxy Go)

- Bucket `optikt-media` **privado** (sin prefijo publico, sin Funnel) en RustFS. Solo accesible desde la red local/Tailscale. Las URLs publicas **no** apuntan a RustFS; apuntan al public-api, que proxya.
- En la DB (columnas **existentes** `products.imageUrl`, `brands.logoUrl`, `settings.businessLogo`, varchar) se guarda unicamente el **base key** tipo `products/<uuid>` (sin dominio, sin sufijo de ancho, sin extension). **No se anaden columnas** para imagenes. Sin backfill de URLs viejas (no hay produccion real aun).
- **Subida en optikt-app** (Node + sharp, libvips nativo): recibe el archivo -> sharp genera WEBP en 3 anchos (`400w`, `800w`, `1200w`) + guarda el original en `_original/`. Convencion de keys: `<base>-400w.webp`, `<base>-800w.webp`, `<base>-1200w.webp`, `_original/<base>.<ext-original>`. Sube a RustFS via `@aws-sdk/client-s3` (API S3 estandar). Reemplaza el input `type=url` actual en `ProductForm.svelte` (y equivalentes de marca/settings) por un widget de subida; mantiene la preview.
- **Proxy en public-api (Go)**: endpoint `GET /media/{key}` lee el objeto de RustFS via cliente S3 estandar (mismo host = hop localhost gratis) y hace `io.Copy` streaming al cliente con `Cache-Control: public, max-age=31536000, immutable`. El ancho de banda hacia internet es identico a servir RustFS directo (los bytes salen una sola vez por el pipe del Funnel); el proxy solo suma el trivial overhead de stream, a cambio de una unica superficie publica auditable y RustFS nunca expuesto.
- **Resolucion en el JSON del catalogo**: el public-api toma el base key de la vista y devuelve `images: { default: "/media/<base>-800w.webp", srcset: [{w:400,url:"/media/<base>-400w.webp"},{w:800,url:"/media/<base>-800w.webp"},{w:1200,url:"/media/<base>-1200w.webp"}] }` apuntando a sus propias URLs. La landing lo mete directo en `<img srcset>`. La landing no sabe nada de RustFS.
- Cache-Control `immutable` + cache de navegador mitigan la ausencia de CDN mientras se usa Funnel.

## Exteriorizacion y futuro S3 (future-proof)

- **Ahora**: Tailscale Funnel **solo para el public-api**. URL estable `https://<host>.<tailnet>.ts.net`, gratis, sin dominio, HTTPS automatico. RustFS queda interno (sin Funnel); solo el public-api habla con el. CORS en el public-api para el origen de la landing.
- **Future-proof S3**: optikt-app y public-api hablan API S3 estandar contra RustFS (`STORAGE_ENDPOINT` + credenciales en env vars). La migracion futura a Cloudflare R2 u otro S3-compatible es **trivial**: cambiar `STORAGE_ENDPOINT` y credenciales en ambos servicios. El write-path de optikt-app no cambia; el proxy del public-api no cambia. Esta es la razon de usar un server S3-compatible (RustFS) en vez de archivos planos: future-proofear la capa de storage desde el dia 1.
- **Despues (cuando se compre dominio)**: migrar a Cloudflare Tunnel + dominio para obtener CDN/cache de imagenes y reducir el upload del local. La base URL del public-api se vuelve configuracion, no codigo; servir imagenes via CDN es trivial (Cloudflare cachea el endpoint `/media`, o se resuelve a un host CDN).

## public-api (Go) — contrato

- Conecta con rol `optikt_public_reader`, lee solo las vistas.
- Endpoints REST/JSON: `GET /catalog/products` (paginado, solo `isPublished`), `GET /catalog/products/:sku`, `GET /brands`, `GET /featured`, `GET /media/{key}` (proxy stream desde RustFS + Cache-Control immutable), `GET /health`.
- En el JSON del catalogo, las imagenes se devuelven como objeto `images: { default, srcset: [...] }` con URLs relativas al public-api (`/media/<base>-<variant>.webp`), que la landing resuelve con la base URL publica. Spec **OpenAPI** publicado para que la landing genere tipos TS.
- Headers `Cache-Control` en respuestas de datos; `immutable` en respuestas de `/media`.
- Auth de lectura: API key para la landing (o publico sin key segun decision de producto); sin escritura.
- Docker multi-stage + healthcheck; despliega en el servidor local de optikt junto al stack existente.

## Landing (repo aparte)

- Reemplaza data hardcoded por fetches al public-api (SSR o ISR/SSG con revalidacion).
- Genera tipos TS desde el OpenAPI del public-api.
- Renderiza imagenes desde las URLs del public-api (`/media/...`), no de RustFS directamente (RustFS es privado). Usa `images.srcset` para `<img srcset>` responsive. Sin panel admin.

## Hardening

- Rate limiting + request logging + error tracking en public-api.
- Prueba SQL de que `optikt_public_reader` no pueda escribir ni acceder a tablas fuera de las vistas.
- Auditoria de publicacion en optikt-app sigue el patron existente (log fuera de transaccion, best-effort).
- Healthchecks para docker; backups existentes de la DB cubren la data de publicacion.
