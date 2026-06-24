---
plan name: public-catalog-api
plan description: Catalog API and image storage
plan status: active
---

## Idea

Servir un catalogo publico para la landing page sin duplicar la base de datos de optikt. Arquitectura acordada con el usuario:

1. optikt-app (este repo) conserva toda la gestion interna y anade una seccion "Publicacion Web" (reusa auth/usuarios/audit existentes) para decidir que productos/marcas se muestran, featured, orden, descripcion y precio web. Tambien migra el manejo de imagenes de "URL pegada a mano" a subida real a MinIO.

2. public-api: NUEVO repositorio aparte en Go. Servicio pequeño de solo lectura que se conecta a la misma DB de optikt con un rol PostgreSQL de solo lectura (optikt_public_reader) que tiene GRANT SELECT unicamente sobre VISTAS SQL (public_catalog_products, public_brands). Las vistas son el contrato compartido entre ambos servicios y se definen en una migracion Drizzle dentro de optikt-app (unica fuente de verdad del contrato). El public-api expone REST/JSON (catalogo, producto por sku, marcas, featured) + un endpoint GET /media/{key} que proxya imagenes desde MinIO privado con stream y Cache-Control immutable. En el JSON devuelve las imagenes como objeto images.srcset con URLs relativas al propio API. Spec OpenAPI para que la landing genere tipos TS. Despliega como binario/docker en el servidor local de optikt.

3. MinIO: infraestructura (no codigo custom), **privado** (sin prefijo publico, sin Funnel). Servicio docker en el servidor local de optikt usando los 4TB, bucket optikt-media accesible solo desde la red local. optikt-app sube via @aws-sdk/client-s3 + sharp (WEBP 400w/800w/1200w + original en _original/); el public-api proxya en lectura. En la DB se guarda unicamente el **base key** (products/<uuid>) en las columnas existentes products.imageUrl / brands.logoUrl / settings.businessLogo (sin cambio de schema, sin backfill).

4. Exteriorizacion: la DB y MinIO NUNCA se exponen a internet. Solo el public-api sale mediante Tailscale Funnel (URL estable https://<host>.<tailnet>.ts.net, gratis, sin dominio). MinIO queda interno; el public-api habla con el por localhost. CORS habilitado en el public-api para el origen de la landing. Migracion documentada a Cloudflare Tunnel + dominio cuando se compre, para obtener CDN/cache de imagenes (Cloudflare cachea /media) y reducir el upload del local.

5. La landing (repo aparte) reemplaza su data hardcoded por fetches al public-api (SSR/ISR), genera tipos desde OpenAPI y renderiza imagenes desde las URLs /media del public-api (no de MinIO, que es privado) usando images.srcset para responsive. Queda como consumidor publico de solo lectura, sin panel admin (la gestion se hace en optikt-app).

Principios: cero duplicacion de datos (misma DB), contrato compartido via vistas SQL, minima superficie publica (binario Go de lectura), separacion de concerns entre gestion interna y borde publico.

## Implementation

- DB schema + contrato: anadir tablas product_publications (productId PK/FK, isPublished, isFeatured, webSortOrder, webDescription, webPrice nullable, publishedAt, updatedAt) y brand_publications (brandId PK/FK, isPublished, isFeatured, webSortOrder, webDescription, publishedAt, updatedAt) via migracion Drizzle. Crear vistas SQL public_catalog_products y public_brands que expongan la proyeccion publica (productos publicados JOIN marcas publicadas, con nombre/marca/sku/tipo/descripcion-web/precio-web/imagen-url/featured/sort). Crear rol PostgreSQL optikt_public_reader con GRANT SELECT solo sobre las vistas (revocar todo lo demas). Actualizar scripts/bootstrap.js y .env.example con PUBLIC_DB_URL y credenciales del rol.
- MinIO infra: anadir servicio minio a docker-compose-prod.yml con volumen de 4TB, consola opcional, bucket optikt-media **privado** (sin prefijo publico, sin Funnel). Anadir env vars MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET a .env.example (sin MINIO_PUBLIC_BASE_URL: MinIO no es publico). Documentar politicas de lifecycle y backups del bucket.
- optikt-app imagenes: anadir dependencias @aws-sdk/client-s3 y sharp. Reemplazar el input type=url en src/lib/components/products/ProductForm.svelte (y equivalentes de marca/settings) por un widget de subida que: recibe el archivo -> sharp genera WEBP en 3 anchos (400w, 800w, 1200w) + guarda original en _original/ -> sube las variantes a MinIO -> guarda unicamente el **base key** (products/<uuid>, sin dominio ni sufijo) en las columnas existentes imageUrl/logoUrl/businessLogo (sin nueva columna). Mantener preview (resuelta via endpoint local o URL interna de MinIO). Sin backfill de URLs viejas.
- optikt-app seccion Publicacion Web: crear rutas (app)/web (o tabs en el detalle de producto/marca) para toggle isPublished/isFeatured, editar webSortOrder/webDescription/webPrice, con operaciones masivas (publicar/despublicar, reordenar featured) y logging de auditoria siguiendo el patron existente (audit fuera de transaccion). Remote functions + schemas Zod siguiendo src/lib/remote y src/lib/schemas. Pasar pnpm lint, pnpm test:unit, pnpm check.
- public-api (nuevo repo Go): inicializar repositorio optikt-public-api. Conectar a la DB con rol optikt_public_reader leyendo solo las vistas. Endpoints REST/JSON: GET /catalog/products (paginado, solo isPublished), GET /catalog/products/:sku, GET /brands, GET /featured, GET /media/{key} (proxy stream desde MinIO privado con Cache-Control immutable), GET /health. Respuestas incluyen el base key resuelto a objeto images: { default, srcset: [{w,url}...] } con URLs relativas /media/<base>-<variant>.webp. Headers Cache-Control (immutable en /media). Generar spec OpenAPI. Dockerfile multi-stage + healthcheck. README con variables de entorno y contrato de vistas.
- Despliegue + exteriorizacion: desplegar public-api y MinIO en el servidor local de optikt (docker, junto al stack existente). Configurar Tailscale Funnel **solo para el public-api** (MinIO queda interno, accesible por localhost desde el public-api). Configurar CORS en el public-api para el origen de la landing. Documentar la migracion a Cloudflare Tunnel + dominio (CDN/cache de imagenes cacheando /media) como paso posterior cuando se compre el dominio.
- Landing (repo aparte): reemplazar data hardcoded por fetches al public-api (SSR o ISR/SSG con revalidacion). Generar tipos TS desde el OpenAPI del public-api. Renderizar imagenes desde las URLs /media del public-api (no de MinIO, privado) usando images.srcset para responsive. Esto vive en el repo de la landing; el alcance de este plan es definir y publicar el contrato + endpoints que la landing consume.
- Hardening y observabilidad del borde publico: rate limiting y logging de requests en public-api; error tracking (Sentry u otro) en public-api; Cache-Control immutable en el endpoint /media del public-api + validacion de que el rol optikt_public_reader no pueda escribir ni acceder a tablas fuera de las vistas (prueba SQL); healthchecks para docker; verificar que las vistas no filtran columnas sensibles (precios de compra, stock interno, datos de clientes/proveedores).

## Required Specs

<!-- SPECS_START -->

- public-catalog-arch
<!-- SPECS_END -->
