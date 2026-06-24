# Spec: public-catalog-arch

Scope: repo

# Public Catalog Architecture

Arquitectura para servir un catalogo publico a la landing page **sin duplicar la base de datos** de optikt, y **resiliente a cortes de luz** del servidor local (Venezuela). Guia reusable para cualquier trabajo futuro sobre el catalogo publico, las imagenes o los snapshots.

## Servicios

- **optikt-app** (este repo, SvelteKit): gestion interna + seccion "Publicacion Web" (reusa auth/usuarios/audit) + subida de imagenes a Cloudflare R2 + generacion y push de snapshots JSON del catalogo a R2. El servidor local es **100% privado**: sin puertos publicos inbound, solo outbound HTTPS a R2.
- **Cloudflare R2** (cloud, siempre-up, egress gratuito): un bucket con dos prefijos. `/media/*` (imagenes WEBP) y `/catalog/*.json` (snapshots del catalogo). Es la **superficie publica de lectura** que consume la landing. URL publica `https://pub-<hash>.r2.dev` (gratis, sin dominio); al comprar dominio se activa custom domain + CDN cache de Cloudflare automaticamente.
- **Landing** (repo aparte): lee 100% de R2 (SSG/ISR), filtrado/paginacion client-side, imagenes via `<img srcset>` desde R2. Sin panel admin.

## Por que R2 y no un API local

El servidor local de optikt esta en Venezuela: la electricidad se corta ~30min cada cierto tiempo, y un UPS no sostiene un servidor. Si la superficie publica de lectura corriera en el local (API Go + Funnel + RustFS, como se diseño inicialmente), un corte tumbaria tanto el listado de productos **como** las imagenes. R2 es cloud siempre-up: durante un corte, la landing sigue sirviendo el ultimo snapshot + todas las imagenes (catalogo ligeramente stale, imagenes frescas). Adicionalmente, R2 tiene **egress gratuito** (su diferenciador vs S3) y 10GB de storage free tier (suficiente: ~6000 WEBP de una optica ≈ <1GB).

## Principios inviolables

1. **Cero duplicacion de datos**: una sola base de datos (la de optikt). La data de publicacion (flags) vive en la misma DB. El JSON en R2 es un **cache derivado auto-syncado**, no una segunda fuente de verdad — los edits solo ocurren en la DB de optikt.
2. **El servidor local nunca se expone a internet**. Cero inbound publico; solo outbound HTTPS a R2. Aislamiento mas fuerte que un binario Go en el borde.
3. **El contrato compartido es una vista SQL** (`public_catalog_products`, `public_brands`) definida en una migracion Drizzle dentro de optikt-app. Es la definicion canonica de la proyeccion publica, usada por el snapshot generator. Resuelve el "que columnas se exponen" en un solo lugar.
4. **Minima superficie publica**: la superficie de lectura es R2 (objetos estaticos), no una app con logica/codigo en el borde. Cero superficie de ataque ejecutable publica.
5. **La gestion de "que mostrar" vive en optikt-app**, no en la landing. La landing es un consumidor publico de solo lectura, sin panel admin.
6. **Resiliente a cortes de luz**: la landing funciona con el ultimo snapshot + imagenes frescas aunque el servidor local este caido.

## Modelo de datos de publicacion (migracion Drizzle en optikt-app)

Tablas **nuevas**, solo metadata de control web — **cero duplicacion de contenido** del producto/marca (sku, name, price, description, imageUrl se leen via JOIN desde products/brands, no se copian):

- `product_publications` (productId PK/FK -> products, isPublished bool, isFeatured bool, webSortOrder int, publishedAt timestamptz, updatedAt timestamptz). 1:1 con products. Solo flags de "mostrar/no mostrar + orden".
- `brand_publications` (brandId PK/FK -> brands, isPublished bool, isFeatured bool, webSortOrder int, publishedAt timestamptz, updatedAt timestamptz). 1:1 con brands. Igual.
- Vistas `public_catalog_products` y `public_brands`: JOIN de products/brands con sus publicaciones WHERE isPublished = true, exponiendo solo columnas publicas (sku, name, brand, type, description, salePrice, imageBaseKey, featured, sort). **Nunca** exponer precios de compra, stock interno, datos de clientes, proveedores ni columnas operativas. El snapshot generator hace `SELECT * FROM public_catalog_products` — no reescribe el JOIN en JS.
- Sin override web de descripcion/precio por ahora (YAGNI / happy path). Si el dia de manana se quiere override, se anaden `webDescription`/`webPrice` nullable a product_publications (migracion trivial, no rompe nada).

## Imagenes (R2 + sharp)

- Bucket R2 `optikt-media` con prefijo `/media/`. Las URLs publicas usan `https://pub-<hash>.r2.dev/media/...`.
- En la DB (columnas **existentes** `products.imageUrl`, `brands.logoUrl`, `settings.businessLogo`, varchar) se guarda unicamente el **base key** tipo `products/<uuid>` (sin dominio, sin sufijo de ancho, sin extension). **No se anaden columnas** para imagenes. Sin backfill de URLs viejas (no hay produccion real aun).
- **Subida en optikt-app** (Node + sharp, libvips nativo): recibe el archivo -> sharp genera WEBP en 3 anchos (`400w`, `800w`, `1200w`) + guarda el original en `_original/`. Convencion de keys: `<base>-400w.webp`, `<base>-800w.webp`, `<base>-1200w.webp`, `_original/<base>.<ext-original>`. Sube a R2 via `@aws-sdk/client-s3` (API S3 estandar). Reemplaza el input `type=url` actual en `ProductForm.svelte` (y equivalentes de marca/settings) por un widget de subida; mantiene la preview.
- **URLs completas en el snapshot**: el snapshot generator resuelve el base key a `images: { default: "https://pub-<hash>.r2.dev/media/<base>-800w.webp", srcset: [{w:400,url:".../media/<base>-400w.webp"},{w:800,...},{w:1200,...}] }`. La landing solo renderiza, no conoce la convencion de variantes. Si se migra de base URL (custom domain), un re-push del snapshot lo resuelve y la landing no se entera.

## Snapshots del catalogo (R2 + sync desde optikt-app)

- R2 prefijo `/catalog/`: `products.json` (listado completo de productos publicados), `brands.json`, `featured.json`, `catalog/products/<sku>.json` (uno por producto, detalle). Formato JSON derivado de la vista SQL.
- **Snapshot generator** dentro de optikt-app: lee la vista `public_catalog_products`, arma el JSON con URLs de imagen completas, y sube a R2 via `@aws-sdk/client-s3`.
- **Sync**: push **on-change** (post-commit, despues de cada cambio de publicacion: publicar/despublicar, reordenar featured, editar producto publicado) + **re-push horario** de seguridad por si un push on-change falla. Durante un corte de luz, la landing muestra el ultimo snapshot (catalogo ligeramente stale, imagenes siempre frescas). Aceptable para un sitio de catalogo.
- **Path a Worker si crece**: si el catalogo pasa de ~10k productos o se necesita busqueda server-side compleja, se inserta un Cloudflare Worker que lee el mismo JSON en R2 y sirve endpoints paginados. Migracion trivial: el JSON en R2 no cambia, solo se anade el intermediario. No es decision irreversible.

## Exteriorizacion

- **Ahora**: R2 sirve via `https://pub-<hash>.r2.dev` (gratis, sin dominio, HTTPS automatico). El servidor local de optikt queda 100% privado (sin Funnel, sin inbound publico); solo hace outbound HTTPS a R2 para subir imagenes y snapshots.
- **Despues (cuando se compre dominio)**: activar custom domain en R2 → CDN cache de Cloudflare automatico para imagenes y snapshots. La base URL publica (`R2_PUBLIC_BASE_URL`) es configuracion (env var), no codigo; un re-push de snapshots la propaga.

## Landing (repo aparte)

- Reemplaza data hardcoded por fetches a R2 (SSG o ISR/SSG con revalidacion).
- Filtrado/paginacion client-side sobre el JSON (~2000 productos, instantaneo en memoria).
- Renderiza imagenes desde las URLs completas del snapshot (`images.srcset`) para `<img srcset>` responsive. No conoce la convencion de variantes ni el base key.
- Sin panel admin. Resiliente a cortes de luz del servidor local.

## Hardening

- Auditoria de publicacion en optikt-app sigue el patron existente (log fuera de transaccion, best-effort).
- Validar que la vista SQL no filtre columnas sensibles (precios de compra, stock interno, datos de clientes/proveedores) — revisar el SELECT de la vista.
- Backups existentes de la DB cubren la data de publicacion (flags). Los snapshots en R2 son derivados y re-generables desde la DB.
- Healthcheck del snapshot generator: alertar si el ultimo push exitoso tiene mas de N horas (ej. 2h, considerando el re-push horario).
