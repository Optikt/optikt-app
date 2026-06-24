---
plan name: public-catalog-api
plan description: Catalog API and image storage
plan status: active
---

## Idea
Servir un catalogo publico para la landing page sin duplicar la base de datos de optikt. Arquitectura acordada con el usuario:

1) optikt-app (este repo) conserva toda la gestion interna y anade una seccion "Publicacion Web" (reusa auth/usuarios/audit existentes) para decidir que productos/marcas se muestran, featured, orden, descripcion y precio web. Tambien migra el manejo de imagenes de "URL pegada a mano" a subida real a MinIO.

2) public-api: NUEVO repositorio aparte en Go. Servicio pequeño de solo lectura que se conecta a la misma DB de optikt con un rol PostgreSQL de solo lectura (optikt_public_reader) que tiene GRANT SELECT unicamente sobre VISTAS SQL (public_catalog_products, public_brands). Las vistas son el contrato compartido entre ambos servicios y se definen en una migracion Drizzle dentro de optikt-app (unica fuente de verdad del contrato). El public-api expone REST/JSON (catalogo, producto por sku, marcas, featured) con URLs de imagen apuntando al base URL publico de MinIO, headers Cache-Control, y un spec OpenAPI para que la landing genere sus tipos TS. Despliega como binario/docker en el servidor local de optikt.

3) MinIO: infraestructura (no codigo custom). Servicio docker en el servidor local de optikt usando los 4TB, bucket optikt-media con prefijo publico de lectura. Tanto optikt-app (subidas via @aws-sdk/client-s3) como el public-api (sirve URLs) lo usan. Las claves/URL se guardan en las columnas existentes products.imageUrl / brands.logoUrl / settings.businessLogo (sin cambio de schema para imagenes).

4) Exteriorizacion: la DB NUNCA se expone a internet. Se expone el public-api y MinIO (lectura publica) mediante Tailscale Funnel (URL estable https://<host>.<tailnet>.ts.net, gratis, sin dominio). CORS habilitado para el origen de la landing. Migracion documentada a Cloudflare Tunnel + dominio cuando se compre, para obtener CDN/cache de imagenes y reducir el upload del local.

5) La landing (repo aparte) reemplaza su data hardcoded por fetches al public-api (SSR/ISR), genera tipos desde OpenAPI y renderiza imagenes desde MinIO. Queda como consumidor publico de solo lectura, sin panel admin (la gestion se hace en optikt-app).

Principios: cero duplicacion de datos (misma DB), contrato compartido via vistas SQL, minima superficie publica (binario Go de lectura), separacion de concerns entre gestion interna y borde publico.

## Implementation
- DB schema + contrato: anadir tablas product_publications (productId PK/FK, isPublished, isFeatured, webSortOrder, webDescription, webPrice nullable, publishedAt, updatedAt) y brand_publications (brandId PK/FK, isPublished, isFeatured, webSortOrder, webDescription, publishedAt, updatedAt) via migracion Drizzle. Crear vistas SQL public_catalog_products y public_brands que expongan la proyeccion publica (productos publicados JOIN marcas publicadas, con nombre/marca/sku/tipo/descripcion-web/precio-web/imagen-url/featured/sort). Crear rol PostgreSQL optikt_public_reader con GRANT SELECT solo sobre las vistas (revocar todo lo demas). Actualizar scripts/bootstrap.js y .env.example con PUBLIC_DB_URL y credenciales del rol.
- MinIO infra: anadir servicio minio a docker-compose-prod.yml con volumen de 4TB, consola opcional, bucket optikt-media con prefijo publico de lectura y claves de acceso. Anadir env vars MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_PUBLIC_BASE_URL a .env.example. Documentar politicas de lifecycle y backups del bucket.
- optikt-app imagenes: anadir dependencia @aws-sdk/client-s3. Reemplazar el input type=url en src/lib/components/products/ProductForm.svelte (y equivalentes de marca/settings) por un widget de subida que PUT el archivo a MinIO (presigned URL o subida server-side) y guarde el object key construyendo la URL publica en las columnas existentes imageUrl/logoUrl/businessLogo (sin nueva columna). Mantener preview. Generar thumbnails pospuesto (arrancar con original; anadir sharp/imgproxy solo si se necesita).
- optikt-app seccion Publicacion Web: crear rutas (app)/web (o tabs en el detalle de producto/marca) para toggle isPublished/isFeatured, editar webSortOrder/webDescription/webPrice, con operaciones masivas (publicar/despublicar, reordenar featured) y logging de auditoria siguiendo el patron existente (audit fuera de transaccion). Remote functions + schemas Zod siguiendo src/lib/remote y src/lib/schemas. Pasar pnpm lint, pnpm test:unit, pnpm check.
- public-api (nuevo repo Go): inicializar repositorio optikt-public-api. Conectar a la DB con rol optikt_public_reader leyendo solo las vistas. Endpoints REST/JSON: GET /catalog/products (paginado, solo isPublished), GET /catalog/products/:sku, GET /brands, GET /featured, GET /health. Respuestas incluyen imageUrl apuntando a MINIO_PUBLIC_BASE_URL. Headers Cache-Control. Generar spec OpenAPI. Dockerfile multi-stage + healthcheck. README con variables de entorno y contrato de vistas.
- Despliegue + exteriorizacion: desplegar public-api y MinIO en el servidor local de optikt (docker, junto al stack existente). Configurar Tailscale Funnel para el puerto del public-api y para MinIO (lectura publica) obteniendo URLs estables .ts.net. Configurar CORS en el public-api para el origen de la landing. Documentar la migracion a Cloudflare Tunnel + dominio (CDN/cache de imagenes) como paso posterior cuando se compre el dominio.
- Landing (repo aparte): reemplazar data hardcoded por fetches al public-api (SSR o ISR/SSG con revalidacion). Generar tipos TS desde el OpenAPI del public-api. Renderizar imagenes desde las URLs de MinIO. Esto vive en el repo de la landing; el alcance de este plan es definir y publicar el contrato + endpoints que la landing consume.
- Hardening y observabilidad del borde publico: rate limiting y logging de requests en public-api; error tracking (Sentry u otro) en public-api; Cache-Control fuerte en objetos de MinIO + validacion de que el rol optikt_public_reader no pueda escribir (prueba SQL); healthchecks para docker; verificar que las vistas no filtran columnas sensibles (precios de compra, stock interno, datos de clientes/proveedores).

## Required Specs
<!-- SPECS_START -->
- public-catalog-arch
<!-- SPECS_END -->