# Optikt App — Plan de Evolución

> Análisis de deuda técnica, features pendientes y features propuestas.
> Actualizado: 2026-08-10.

---

## Prioridades

| Símbolo | Significado               |
| ------- | ------------------------- |
| 🔴      | Crítico — atacar ya       |
| 🟡      | Alto — en este trimestre  |
| 🟢      | Medio — cuando haya banda |
| ⚪      | Bajo — nice to have       |

---

## 1. Deuda Técnica

### DT1 · Archivos gigantes sin descomponer 🔴

**Problema:** 39 archivos >500 líneas. Top 5: `LensCatalogForm.svelte` (1473), `EditSaleModal.svelte` (1381), `sales.remote.ts` (1273), `purchaseOrders.remote.ts` (1240), `inventory/count/[id]/+page.svelte` (1139). El plan `componentize-purchase-detail` ya bajó purchases/[id] de 2221→629 líneas como prueba de concepto.

**Riesgo de no hacerlo:** Mantenibilidad nula. Cada fix toca un monolito. Onboarding imposible. Regresiones frecuentes. El patrón de extracción ya está validado — solo falta aplicarlo al resto.

**Contras:** Refactor puro, cero feature nueva. Riesgo de introducir bugs si no hay tests. Las remote functions son más difíciles de split sin romper imports.

**Dificultad:** Media (3-5 días por archivo grande). **Solución:** Mismo patrón que `purchase-detail`: extraer sub-componentes y helpers puros. Priorizar los 5 más grandes.

---

### ✅ DT2 · Errores silenciados (COMPLETADO — 2026-08-10)

**Qué se hizo:** Auditar los 182 catch blocks del codebase. Resultado: solo **1** error era verdaderamente silencioso — `exchangeRates/service.ts:170` (fallo de API absorbido en `cache.lastError` sin señal visible). Todo lo demás ya tenía toast, `return {success:false}` o supresión intencional de cleanup.

**Cambios:**

- `logger.error('Error obteniendo tasas de cambio de la API', error)` agregado en el catch de `refreshExchangeRates`.
- Bonus: el error se propaga al UI — `refreshExchangeRatesCommand` ahora lanza si `snapshot.lastError` está seteado (antes el UI mostraba "Tasas actualizadas" con la API caída). Mensaje amigable al usuario ("No se pudo conectar con el proveedor de tasas"), detalle técnico en logs.

**Verificación:** `pnpm check` 0 errores, `pnpm lint` pasa, 741/741 tests ✓.

---

### DT3 · Validación Zod subutilizada 🔴

**Problema:** 25 schemas Zod existen en `src/lib/schemas/`. Solo 1 `.safeParse()` en todos los remote functions. Las validaciones de negocio se hacen con ifs inline, duplicando lógica entre front y back.

**Riesgo de no hacerlo:** Validación frágil e inconsistente. Cambios de reglas de negocio requieren cazar ifs dispersos. Los schemas existen pero son código muerto.

**Contras:** Puede romper flujos si los schemas son más estrictos que los ifs actuales. Requiere testear cada remote.

**Dificultad:** Baja. **Solución:** Agregar `schema.safeParse(input)` al inicio de cada handler en `*.remote.ts`. Si falla, retornar error descriptivo con los issues de Zod. ~2h por archivo.

---

### ✅ DT4 · 162 console.log/error en producción (COMPLETADO — 2026-08-10)

**Qué se hizo:** Cero `console.*` en código de producción (solo dentro del logger). Se creó un wrapper compartido y se eliminó el ruido.

**Cambios:**

- Nuevo `src/lib/utils/logger.ts` — wrapper `debug/info/warn/error` con formato `[level] message`, contexto opcional. `debug` solo en dev (`import.meta.env?.DEV`). Cero dependencias.
- **139 `console.error`/`warn` redundantes eliminados** en 71 componentes/páginas + 20 en remote functions — catch blocks que ya mostraban toast o retornaban `{success:false}`.
- **16 intencionales → `logger.*`**: hooks.server (`handleError`), exchangeRates poller, notifications service, `reportClientError`, form unbound-issues (`warn`), defaults de PDF shutdown.
- **7 paths silenciosos → `logger.error`** (única señal del fallo, sin toast): refreshStats en products/sales/quotes, CommandSearch, NewQuoteForm, NewSaleForm, LensCatalogForm.
- DEBUG logs de `pdf.ts` eliminados.
- Nota: `pdf.ts` usa import relativo (`../utils/logger`) porque su fixture de test corre en node plano sin alias `$lib`; el logger evita `import.meta.env` directo por la misma razón.

**Pendiente (de la solución original):** regla ESLint `no-console: error` — con cero usos restantes ya es aplicable como guard rail.

**Verificación:** `pnpm check` 0 errores, `pnpm lint` pasa, 741/741 tests ✓. 83 archivos, −183/+50 líneas.

---

### DT5 · Patrón de error duplicado 🟡

**Problema:** `e instanceof Error ? e.message : 'Error...'` repetido 12+ veces en cada archivo remote. `getErrorMessage()` existe en `src/lib/utils/errors.ts` hace tiempo pero solo 3 archivos lo usan.

**Riesgo de no hacerlo:** Código ruidoso. Cambiar el formato de error requiere editar 100+ líneas idénticas.

**Contras:** Ninguno. Refactor mecánico.

**Dificultad:** Baja. **Solución:** Replace-all del patrón inline por `getErrorMessage(e, 'Mensaje fallback')` en todos los `*.remote.ts`. ~1 día.

---

### DT6 · Soft-delete inconsistente 🟡

**Problema:** 13 tablas con `deletedAt` timestamp, 2 con `voidedAt` (sale_payments, cash_expenses), 8+ sin ningún mecanismo (settings, inventory_lots, notifications, etc.). `lens_technologies` y `supplier_treatments` usan `isActive` boolean. Sin estándar.

**Riesgo de no hacerlo:** Comportamiento impredecible al "borrar". Un DELETE en una tabla sin soft-delete pierde datos para siempre. La semántica de `voidedAt` vs `deletedAt` es ambigua.

**Contras:** Migración DB necesaria. Posible breaking change si queries no filtran `deletedAt`.

**Dificultad:** Media. **Solución:** (a) Definir estándar: todo usa `deletedAt` timestamp (null = activo). (b) Migración para tablas sin él. (c) `voidedAt` → renombrar a `deletedAt` para consistencia (o mantener si la semántica es distinta). (d) Actualizar todos los queries afectados.

---

### DT7 · Dos stacks de PDF redundantes 🟢

**Problema:** `puppeteer-core` + `@sparticuz/chromium` + `@pdfslick/core` + `pdfjs-dist`. Cuatro dependencias de PDF. Probablemente `@pdfslick/core` y `pdfjs-dist` son para visualización client-side y `puppeteer` para generación server-side, pero no está documentado.

**Riesgo de no hacerlo:** Bundle más pesado. Dos fuentes de bugs. Actualizaciones de seguridad duplicadas.

**Contras:** Si ambos son necesarios (uno para generar, otro para mostrar), no hay nada que hacer.

**Dificultad:** Media. **Solución:** Auditar qué usa cada dependencia. Si hay solapamiento real, consolidar. Si no, documentar por qué ambas.

---

### DT8 · Dashboard sin gráficos 🟡

**Problema:** El dashboard (`/dashboard`) muestra 4 tarjetas numéricas (total clientes, ventas hoy, cotizaciones pendientes, stock bajo) + tablas. Sin tendencias visuales, sin comparativas temporales, sin breakdowns por producto/vendedor/marca.

**Riesgo de no hacerlo:** El dueño no ve la salud del negocio de un vistazo. Percepción de herramienta "básica" comparada con competidores. Decisiones sin datos.

**Contras:** Agregar librería de charts (`layercake`, `chart.js`) suma peso al bundle.

**Dificultad:** Baja. **Solución:** Agregar `layercake` (Svelte-native, más liviano) o `chart.js`. KPIs nuevos: revenue diario/semanal/mensual, top productos, top vendedores, profit margin trend, conversion rate quotes→sales. ~3 días.

---

### DT9 · Sin tests en remote functions 🟡

**Problema:** 58 archivos de test pero **cero** para `*.remote.ts`. La capa de lógica de negocio — donde viven comandos como `createSale`, `addSalePayment`, `confirmPurchaseOrder` — no tiene cobertura de tests unitarios. Los tests existentes cubren schemas, utils, helpers y queries, pero no la orquestación.

**Riesgo de no hacerlo:** Regresiones en comandos críticos (pagos, confirmaciones, ajustes de inventario) sin red de seguridad. Refactorizar remotes es peligroso.

**Contras:** Testear remotes requiere mock de DB (o testcontainers con PostgreSQL). Setup no trivial. Tiempo significativo.

**Dificultad:** Alta. **Solución:** (a) Setup de testcontainers con PostgreSQL + migraciones. (b) Tests de integración para los 10-15 comandos más críticos. (c) Incorporar al CI. ~1-2 semanas.

---

## 2. Features Pendientes (Planes Activos)

### ✅ FP2 · backup-ui (COMPLETADO — 2026-08-10)

**Qué se implementó:**

El approach final difiere del plan original. En vez de Docker API + socket-proxy, se migró a Dokploy cron (container efímero) + UI basada en notificaciones.

**Fase 1 — Infra:**

- `backup/Dockerfile` simplificado: sin `entrypoint.sh` ni `crond`, CMD directo a `backup.sh`. Container efímero — ejecuta, sube a Drive, notifica y muere.
- `backup/entrypoint.sh` eliminado.
- `backup/backup.sh` mejorado: captura `ERROR_MSG` en cada paso (pg_dump, upload), notifica webhook con status real (no mentía con `curl || true`), soporta `GOOGLE_DRIVE_BACKUP_FOLDER_ID` vía `--drive-root-folder-id` de rclone (para subir a carpeta específica, no al root).
- `docker-compose-prod.yml`: servicio `backup` eliminado (Dokploy lo gestiona como Schedule Job).
- **Bug resuelto:** DNS stale de Docker (`127.0.0.11:53` se corrompía tras días) → al ser container efímero, cada ejecución tiene DNS fresco. Los uploads dejaron de fallar.
- Schedule Job en Dokploy: nombre `optikt-backup`, cron `0 2 * * *`, comando `docker run --rm` con todas las env vars inline. Network `dokploy-network`, hosts `optikt-database-tbgscg` y `optikt-app-8w0vr1`.

**Fase 2 — UI:**

- Migración DB `0037`: nuevo valor `BACKUP_FAILED` en enum `notification_type`.
- `NotificationType.BACKUP_FAILED` + `notifyBackupFailed()` en el servicio de notificaciones.
- Webhook `backup-webhook` actualizado: crea `BACKUP_CREATED` o `BACKUP_FAILED` según `status`, guarda tamaño y error en metadata.
- Query `getRecentBackupNotifications()` — filtra por ambos tipos, devuelve fileName, sizeBytes, error, createdAt.
- `src/lib/remote/backups.remote.ts`: `listBackupHistory`, `getBackupStatus`, `runBackup` (vía Dokploy API `POST /api/schedule.runManually` con `x-api-key`).
- Página `/backups` (solo SUPERADMIN): `+page.server.ts` con SSR (computa status del último registro, sin fetch client-side en carga inicial), `+page.svelte` con badge de estado (verde/amarillo/rojo), botón "Ejecutar backup ahora" (dispara el Schedule Job vía Dokploy API), tabla de historial.
- Componentes: `BackupsStatusBadge.svelte`, `BackupsTable.svelte`.
- Sidebar: `/backups` en `SUPER_ADMIN_ITEMS` con icono `HardDrive` de Lucide.
- Env vars nuevas: `DOKPLOY_API_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_BACKUP_SCHEDULE_ID`.

**Verificación:** `pnpm check` 0 errores, `pnpm lint` pasa, `pnpm test:unit` 741 tests ✓. Probado en producción: backup automático funciona, webhook notifica correctamente, UI muestra historial y status, botón trigger dispara el job vía Dokploy API.

---

### FP1 · preserve-list-filters 🔴

**Problema:** Al navegar lista→detalle→volver en ventas, compras, lentes, productos, clientes y cotizaciones, los filtros se pierden porque el botón volver va a la URL base sin query params.

**Por qué importa:** Rompe el flujo de trabajo. Usuario filtra 50 ventas, abre una para ver detalle, vuelve y tiene que re-filtrar. Cada vez. 6 secciones afectadas.

**Contras:** SessionStorage implica que si el usuario abre dos tabs de la misma sección, los filtros se pisan. Edge case aceptable.

**Dificultad:** Baja. **Solución:** (a) Utilidad `saveReferrerParams`/`getBackUrl` en `src/lib/utils/urlState.ts` (ya existe parcialmente). (b) `beforeNavigate` en cada lista para guardar params. (c) `goBack()` modificado en cada detalle. ~1 día.

**Estado:** Plan activo. Sin empezar implementación.

---

### FP3 · public-catalog-api 🔴

**Problema:** La óptica no tiene presencia web. No hay landing page, no hay catálogo público. El plan anterior (API Go + Tailscale Funnel + RustFS) se descartó por fragilidad ante cortes de luz.

**Por qué importa:** Es el producto externo. Sin landing page, los clientes no descubren la óptica en internet. En Venezuela la competencia ya tiene presencia web.

**Contras:** Dependencia en Cloudflare R2 (aunque free tier generoso: 10GB, egress gratis). Sharp (libvips nativo) puede dar problemas de compilación en el droplet. Es la feature más grande del roadmap.

**Dificultad:** Alta. **Solución:** Arquitectura R2-first: (a) Migración DB con `product_publications` y `brand_publications` (flags de publicación, sin duplicar contenido). (b) Vistas SQL `public_catalog_products`/`public_brands` como contrato canónico. (c) Widget de upload de imágenes con sharp→WEBP multiresolución + subida a R2. (d) Snapshot generator que lee la vista y pushea JSON a R2 `/catalog/`. (e) Sync on-change + re-push horario. (f) La landing (repo aparte) consume de R2 vía HTTPS. ~2-3 semanas.

**Estado:** Plan activo. Arquitectura definida en `public-catalog-arch`. Sin empezar.

---

## 3. Features Propuestas

### NF1 · Órdenes de Laboratorio 🔴

**Problema:** El flujo de enviar una prescripción + frame a un laboratorio para fabricar lentes es completamente manual hoy. El sistema tiene suppliers tipo `LABORATORY` pero no se usan para tracking.

**Por qué importa:** Es el core workflow de una óptica. Sin tracking digital: pérdida de órdenes, demoras sin visibilidad, cliente llama y no se sabe dónde está su pedido.

**Contras:** Agrega complejidad al schema y UI. Los laboratorios reales no se integrarán vía API (estamos en Venezuela) — será tracking manual de estados.

**Impacto:** Crítico. **Dificultad:** Alta. **Overview:** (a) Nueva tabla `lab_orders`: supplier_id, sale_item_id, prescription_id, status (PENDING/SENT/IN_PRODUCTION/READY/RECEIVED/REJECTED), fechas, notas, costo. (b) UI: crear orden desde venta/prescripción, lista de órdenes activas, filtro por estado, cambio de estado con timestamp. (c) Dashboard widget: órdenes pendientes/atrasadas. (d) Auditoría de cambios de estado. ~2 semanas.

---

### NF2 · Citas / Agenda 🟡

**Problema:** Los exámenes de vista, ajustes de frames y entregas de pedidos se agendan en papel o WhatsApp. Sin visibilidad de quién viene cuándo.

**Por qué importa:** Proceso diario sin digitalizar. El dueño no sabe su carga de trabajo del día. Clientes sin recordatorio = no-shows.

**Contras:** Funcionalidad que requiere adopción del equipo. Si nadie la usa, es código muerto.

**Impacto:** Alto. **Dificultad:** Media. **Overview:** (a) Nueva tabla `appointments`: customer_id, user_id (quién atiende), type (EXAM/ADJUSTMENT/DELIVERY/OTHER), date + time, duration, status (SCHEDULED/CONFIRMED/COMPLETED/CANCELLED/NO_SHOW), notes. (b) Vista de calendario semanal/diario. (c) CRUD con modal rápido. (d) Dashboard widget: citas del día. (e) Opcional futuro: recordatorios WhatsApp. ~1 semana.

---

### NF3 · Venta Rápida (POS) 🟡

**Problema:** El wizard de venta actual (3 pasos: cliente → items → pago) es lento para ventas simples (gotas, estuches, accesorios, cliente walk-in sin registro previo).

**Por qué importa:** Agiliza el 40% de las transacciones (ventas pequeñas). El vendedor pierde tiempo en pasos innecesarios.

**Contras:** Dos flujos de venta que mantener. Si divergen en lógica, bugs dobles. Debe reusar los mismos remote commands.

**Impacto:** Alto. **Dificultad:** Media. **Overview:** (a) Nuevo modo "Venta rápida" accesible desde el dashboard. (b) Pantalla única con: búsqueda de producto (autocomplete), cantidad, búsqueda de cliente (o "consumidor final"), método de pago, monto. (c) Botón grande "Cobrar". (d) Internamente usa el mismo `createSale` + `addSalePayment` remote commands. (e) No reemplaza el wizard — son dos modos. ~1 semana.

---

### NF4 · Garantías 🟡

**Problema:** Frames y lentes tienen garantía de fabricante (6-24 meses). Hoy no se trackea fecha de compra, vencimiento ni reclamos. Si un cliente vuelve con un frame roto, no hay registro.

**Por qué importa:** Requisito legal (derecho a garantía) y operativo (relación con proveedores). Sin tracking, la óptica asume costo de garantías que debería cubrir el fabricante.

**Contras:** Agrega entidad nueva. Si el volumen de reclamos es bajo, puede ser overkill.

**Impacto:** Alto. **Dificultad:** Media. **Overview:** (a) Nueva tabla `warranties`: sale_item_id, product_id/lens_id, duration_months, warranty_start, warranty_end, manufacturer, terms. (b) Nueva tabla `warranty_claims`: warranty_id, claim_date, issue_description, status (PENDING/APPROVED/REJECTED/RESOLVED), resolution, cost_covered_by. (c) UI: ver garantías activas desde producto y cliente. (d) Alertas: garantías próximas a vencer. ~1 semana.

---

### NF5 · Dashboard con Gráficos 🟡

**Problema:** El dashboard actual son 4 números en tarjetas. Sin tendencias, sin comparativas, sin breakdowns. El dueño no puede ver si el negocio mejora o empeora.

**Por qué importa:** Toma de decisiones basada en datos. Un dashboard visual permite detectar caídas de ventas, productos estrella, vendedores top, estacionalidad.

**Contras:** Agregar librería de charts (peso). Los datos que se muestran requieren queries nuevos.

**Impacto:** Alto. **Dificultad:** Baja. **Overview:** (a) Agregar `layercake` o `chart.js`. (b) Nuevos KPIs con gráficos: revenue diario (últimos 30 días, bar chart), top 10 productos (bar horizontal), profit margin trend (línea), conversión quotes→ventas (porcentaje), ventas por vendedor (stacked bar). (c) Date range picker: hoy / esta semana / este mes / custom. (d) Los queries de agregación ya existen en `dashboard.ts` — extenderlos. ~3 días.

---

### NF6 · Carga de Imágenes de Productos 🟡

**Problema:** Los productos tienen `imageUrl` como campo de texto libre. Sin upload, sin preview, sin redimensionamiento. Cada imagen hay que hostearla en otro lado y pegar URL.

**Por qué importa:** Sin imágenes, los productos son invisibles. Solapa con `public-catalog-api` (que necesita imágenes para la landing). Es absurdo tener un catálogo de frames sin fotos.

**Contras:** Sharp (libvips) puede dar problemas de compilación nativa en el droplet. Si no se configura bien, puede llenar el disco de R2.

**Impacto:** Alto. **Dificultad:** Media. **Overview:** (a) Reutilizar la infraestructura sharp+R2 definida en `public-catalog-arch`. (b) `ImageUpload.svelte`: drag & drop, preview, progreso. (c) Al subir: sharp genera 400w/800w/1200w WEBP + original → R2 `/media/products/<uuid>-<size>.webp`. (d) Guardar solo el base key en `imageUrl`. (e) Aplicar en ProductForm, BrandForm, Settings (logo). ~1 semana (comparte infraestructura con FP3).

---

### NF7 · Visor Global de Auditoría 🟢

**Problema:** El `change_history` existe y se consulta en contexto (detalle de producto, lente, orden de compra). Pero no hay una página dedicada donde ver todos los cambios del sistema en un solo lugar.

**Por qué importa:** Transparencia operativa. Cuando algo falla, el admin necesita buscar "quién cambió qué y cuándo" sin adivinar en qué detalle de entidad buscar. Compliance básico.

**Contras:** Si la tabla `change_history` crece mucho, la página puede ser lenta sin paginación server-side.

**Impacto:** Medio. **Dificultad:** Baja. **Overview:** (a) Nueva ruta `/audit` (SUPERADMIN). (b) Componente `AuditLogViewer.svelte`: tabla filtrable por usuario, entidad, fecha (rango), acción. (c) El query `getEntityHistory()` ya existe y soporta filtros. (d) Paginación server-side. (e) Exportar CSV. ~2 días.

---

### NF8 · Comisiones por Vendedor 🟢

**Problema:** No hay forma de calcular cuánto vendió cada vendedor ni cuánto debería ganar en comisiones. Las ventas tienen `sellerId` pero no se explota.

**Por qué importa:** Motivación del equipo. Sin comisiones transparentes, no hay incentivo para vender más. En retail óptico, las comisiones son estándar.

**Contras:** Las reglas de comisión varían (¿% fijo? ¿por producto? ¿por marca? ¿escalonado?). El MVP debería ser simple y extensible. Puede generar conflictos si los números no cuadran.

**Impacto:** Medio. **Dificultad:** Media. **Overview:** (a) Nueva tabla `commission_rules`: user_id (opcional, global si null), product_type/brand_id (opcional), percentage, min_sale_amount, valid_from, valid_until. (b) Nueva tabla `commissions`: sale_id, sale_item_id, user_id, amount, percentage, rule_id, calculated_at. (c) Cálculo automático post-sale. (d) Reporte `/reports/commissions`: por vendedor, por período, total, detalle. (e) Dashboard widget: top vendedores del mes. ~1 semana.

---

### NF9 · Múltiples Sucursales ⚪

**Problema:** No existe `branch_id` en ninguna tabla. Si la óptica abre una segunda sucursal, no hay forma de separar inventario, ventas, clientes, usuarios por ubicación.

**Por qué importa:** Es la feature que define si el sistema escala con el negocio o se queda en la primera sucursal. Si no está desde el inicio, migrarlo después es extremadamente costoso.

**Contras:** **Muy costoso.** Requiere migración DB masiva (agregar `branch_id` a 15+ tablas), adaptar TODOS los queries (WHERE branch_id = $1), adaptar toda la UI, y crear UI de transferencias entre sucursales. Si la óptica nunca crece a 2+ sucursales, fue tiempo perdido.

**Impacto:** Alto (si hay crecimiento). **Dificultad:** Muy Alta. **Overview:** (a) Nueva tabla `branches`: name, address, phone, is_active. (b) Agregar `branch_id FK` a: users, customers, sales, quotes, purchase_orders, inventory_lots, inventory_movements, cash_expenses, settings (o hacer settings multibranch), inventory_count_sessions, products (stock por sucursal). (c) Session guarda branch_id del usuario. (d) Todos los queries filtran por branch_id del usuario autenticado. (e) SUPERADMIN ve todas las sucursales. (f) UI de transferencia de inventario entre sucursales. (g) Dashboard y reportes permiten filtrar por sucursal. ~3-4 semanas.

---

### NF10 · Exportación Excel (XLSX) 🟢

**Problema:** La exportación actual es solo CSV. Los contadores y administradores esperan Excel con formato, hojas múltiples y totals.

**Por qué importa:** Los reportes en CSV se ven mal al abrir en Excel (columnas desalineadas, tildes rotas, fechas como texto). Profesionalismo.

**Contras:** Agregar dependencia `xlsx` (o `exceljs`). Peso adicional.

**Impacto:** Bajo. **Dificultad:** Baja. **Overview:** (a) Agregar librería `xlsx` (~200KB). (b) Extender `downloadCsv()` → `downloadExcel()` en `src/lib/utils/csv.ts`. (c) Aplicar a los 6 reportes actuales. (d) Opcional: formatting (negritas, colores, auto-width). ~1 día.

---

### NF11 · Lector de Código de Barras 🟢

**Problema:** Sin campo `barcode` en productos. Sin soporte para scanner USB (que emula teclado + Enter). El conteo de inventario y la venta al mostrador requieren buscar productos por nombre/SKU manualmente.

**Por qué importa:** Velocidad. Un scanner USB cuesta $20 y acelera drásticamente el conteo de inventario (que hoy es manual con papel) y la venta rápida.

**Contras:** Ninguno significativo. El scanner USB es plug & play (emula teclado).

**Impacto:** Medio. **Dificultad:** Baja. **Overview:** (a) Agregar `barcode` varchar nullable a `products`. (b) Input con `autofocus` y handler de `Enter` en POS y en inventory count para búsqueda instantánea por barcode. (c) Si el barcode no existe, mostrar opción de crearlo. ~2 días.

---

## Resumen de Esfuerzo

| Prioridad | Ítem                          | Esfuerzo                |
| --------- | ----------------------------- | ----------------------- |
| ✅        | FP2 · backup-ui               | Completado              |
| ✅        | DT4 · Console.log en prod     | Completado              |
| ✅        | DT2 · Errores silenciados     | Completado              |
| 🔴        | DT5 · Error pattern duplicado | 1 día                   |
| ❌        | FP1 · preserve-list-filters   | 1 día                   |
| 🔴        | FP3 · public-catalog-api      | 15 días                 |
| 🟡        | DT1 · Archivos gigantes       | 15-20 días (5 archivos) |
| 🟡        | DT8 · Dashboard gráficos      | 3 días                  |
| 🟡        | NF1 · Órdenes laboratorio     | 10 días                 |
| 🟡        | NF2 · Citas/agenda            | 5 días                  |
| 🟡        | NF3 · POS rápido              | 5 días                  |
| 🟡        | NF4 · Garantías               | 5 días                  |
| 🟡        | NF6 · Upload imágenes         | 5 días                  |
| 🟡        | DT6 · Soft-delete consistente | 3 días                  |
| 🟡        | DT9 · Tests remote funcs      | 10 días                 |
| 🟢        | NF7 · Visor auditoría         | 2 días                  |
| 🟢        | NF10 · Export Excel           | 1 día                   |
| 🟢        | NF11 · Código barras          | 2 días                  |
| 🟢        | DT7 · PDF stack limpio        | 2 días                  |
| 🟢        | NF8 · Comisiones              | 5 días                  |
| ⚪        | NF9 · Multi-sucursal          | 20 días                 |

**Total estimado:** ~110 días-hombre. **Quick wins (🔴 bajo esfuerzo):** 4 días para resolver DT5, DT3 y FP1.

---

## Orden de Ataque Sugerido

```
Semana 1:  DT5 + DT3 (deuda técnica rápida)
Semana 2:  FP1 (preserve-list-filters)
Semana 3-5: FP3 inicio (public-catalog-api)
Semana 6:  DT8 (dashboard gráficos)
Semana 7-8: DT1 parcial (LensCatalogForm + EditSaleModal)
Semana 9:  NF1 (órdenes laboratorio)
Semana 10: NF6 (upload imágenes, coincide con FP3)
...
```
