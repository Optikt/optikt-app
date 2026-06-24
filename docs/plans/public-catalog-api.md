---
plan name: public-catalog-api
plan description: Catalog snapshots and images on R2
plan status: active
---

## Idea

Servir un catalogo publico a la landing page sin duplicar la base de datos de optikt, y **resiliente a cortes de luz** del servidor local (Venezuela). Arquitectura acordada con el usuario tras pivotar desde un API Go local + Funnel + RustFS hacia Cloudflare R2 como superficie publica de lectura:

1. optikt-app (este repo) conserva toda la gestion interna y anade una seccion "Publicacion Web" (reusa auth/usuarios/audit existentes) para decidir que productos/marcas se publican, featured y orden. Tambien migra el manejo de imagenes de "URL pegada a mano" a subida real a Cloudflare R2 (sharp -> WEBP 3 anchos + original). El servidor local queda **100% privado**: sin puertos publicos inbound, solo outbound HTTPS a R2.

2. Cloudflare R2 (cloud, siempre-up, egress gratuito, 10GB free tier): un bucket con dos prefijos. `/media/*` (imagenes WEBP) y `/catalog/*.json` (snapshots del catalogo: products.json, brands.json, featured.json, catalog/products/<sku>.json). Es la superficie publica de lectura que consume la landing. URL publica `https://pub-<hash>.r2.dev` (gratis, sin dominio); al comprar dominio se activa custom domain + CDN cache de Cloudflare.

3. Snapshot generator dentro de optikt-app: lee la vista SQL public_catalog_products, arma el JSON con URLs de imagen completas (images.srcset), y sube a R2. Sync **on-change** (post-commit, despues de cada cambio de publicacion) + **re-push horario** de seguridad. Durante un corte de luz, la landing muestra el ultimo snapshot (catalogo ligeramente stale, imagenes siempre frescas).

4. La landing (repo aparte) lee 100% de R2 (SSG/ISR), filtrado/paginacion client-side sobre ~2000 productos, imagenes via `<img srcset>` desde R2. Sin panel admin. Resiliente a cortes de luz del servidor local.

Principios: cero duplicacion de datos (misma DB; el JSON en R2 es cache derivado auto-syncado, no segunda fuente de verdad), contrato compartido via vista SQL (definicion canonica de la proyeccion publica), minima superficie publica (objetos estaticos en R2, no codigo ejecutable en el borde), servidor local 100% privado (solo outbound), resiliente a cortes de luz.

## Que se dropea del diseno anterior

- Servicio Go (repo optikt-public-api): fuera. No hay API dinamico en el borde.
- Tailscale Funnel: fuera. El servidor local no se expone a internet.
- RustFS: fuera. Las imagenes van directo a R2 (cloud).
- Rol PostgreSQL optikt_public_reader: fuera. No hay lector externo de la DB.
- Endpoint proxy `/media/{key}`: fuera. Las imagenes las sirve R2 directamente.

## Que se mantiene

- Tablas `product_publications` / `brand_publications` (fuente de verdad de flags de publicacion).
- Vista SQL `public_catalog_products` / `public_brands` (definicion canonica de la proyeccion, usada por el snapshot generator).
- `@aws-sdk/client-s3` + sharp (API S3 estandar contra R2; future-proof para migrar a otro S3-compatible si hace falta).
- Base key en columnas existentes (imageUrl/logoUrl/businessLogo).

## Implementation

- DB schema + vista: anadir tablas `product_publications` (productId PK/FK, isPublished bool, isFeatured bool, webSortOrder int, publishedAt timestamptz, updatedAt timestamptz) y `brand_publications` (brandId PK/FK, isPublished, isFeatured, webSortOrder, publishedAt, updatedAt) via migracion Drizzle. **Solo flags de control web — sin webDescription/webPrice** (cero duplicacion de contenido; el snapshot lee description/price/etc directo de products/brands via JOIN). Crear vistas SQL `public_catalog_products` y `public_brands` que expongan la proyeccion publica (productos publicados JOIN marcas publicadas, con sku/nombre/marca/tipo/descripcion/precio/imagenBaseKey/featured/sort), filtrando `WHERE isPublished = true` y sin exponer columnas sensibles (precios de compra, stock, clientes, proveedores). Actualizar scripts/bootstrap.js si hace falta. .env.example con R2 creds (ver paso de R2).
- R2 infra + env: crear bucket `optikt-media` en Cloudflare R2, prefijo `/media/` para imagenes y `/catalog/` para snapshots. Anadir env vars a .env.example: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (optikt-media), `R2_ENDPOINT` (https://<accountid>.r2.cloudflarestorage.com), `R2_PUBLIC_BASE_URL` (https://pub-<hash>.r2.dev). Documentar politicas de lifecycle y backups del bucket.
- optikt-app imagenes: anadir dependencias `@aws-sdk/client-s3` y `sharp`. Reemplazar el input `type=url` en `src/lib/components/products/ProductForm.svelte` (y equivalentes de marca/settings) por un widget de subida que: recibe el archivo -> sharp genera WEBP en 3 anchos (400w, 800w, 1200w) + guarda original en `_original/` -> sube las variantes a R2 via `@aws-sdk/client-s3` -> guarda unicamente el **base key** (products/<uuid>, sin dominio ni sufijo) en las columnas existentes imageUrl/logoUrl/businessLogo (sin nueva columna). Mantener preview (resuelta desde R2 con la URL publica + base key + variante). Sin backfill de URLs viejas. Pasar pnpm lint, pnpm test:unit, pnpm check.
- optikt-app seccion Publicacion Web: crear rutas `(app)/web` (o tabs en el detalle de producto/marca) para toggle isPublished/isFeatured, editar webSortOrder, con operaciones masivas (publicar/despublicar, reordenar featured) y logging de auditoria siguiendo el patron existente (audit fuera de transaccion). Remote functions + schemas Zod siguiendo src/lib/remote y src/lib/schemas. Pasar pnpm lint, pnpm test:unit, pnpm check.
- Snapshot generator + sync: modulo en optikt-app (src/lib/server/) que lee la vista `public_catalog_products`, arma los JSON (products.json, brands.json, featured.json, catalog/products/<sku>.json) con URLs de imagen completas (images.srcset apuntando a R2_PUBLIC_BASE_URL/media/<base>-<variant>.webp), y sube a R2 via `@aws-sdk/client-s3`. Trigger **on-change**: despues de cada comando de publicacion (post-commit, fuera de transaccion), invocar el generator. Trigger **horario**: cron/scheduled task que re-genera y re-sube por si un push on-change fallo. Healthcheck: alertar si el ultimo push exitoso tiene mas de N horas.
- Landing (repo aparte): reemplazar data hardcoded por fetches a R2 (SSG o ISR/SSG con revalidacion). Filtrado/paginacion client-side sobre el JSON (~2000 productos). Renderizar imagenes desde las URLs completas del snapshot (`images.srcset`) para `<img srcset>` responsive. Esto vive en el repo de la landing; el alcance de este plan es definir y publicar el contrato (shape del JSON en R2) que la landing consume.
- Hardening y observabilidad: validar que la vista SQL no filtre columnas sensibles (precios de compra, stock interno, datos de clientes/proveedores) — revisar el SELECT; auditoria de publicacion (log fuera de transaccion, best-effort); healthcheck del snapshot generator (alertar si ultimo push > N horas); backups existentes de la DB cubren la data de publicacion (flags); los snapshots en R2 son derivados y re-generables desde la DB.

## Required Specs

<!-- SPECS_START -->

- public-catalog-arch
<!-- SPECS_END -->
