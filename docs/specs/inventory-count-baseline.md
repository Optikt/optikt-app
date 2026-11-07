# Conteo Físico (Inventory Count) — Estado actual completo

> Documento base para el rediseño UI/UX del módulo de conteo físico.
> Audita cómo funciona hoy: flujo, datos, permisos, interacciones, colores y tecnología.
> Último recorrido del código: 2026-11-04.

---

## 1. Resumen ejecutivo

El módulo **Conteo Físico** (`/inventory/count`) permite hacer un inventario cíclico: tomar un **snapshot** del stock de todos los ítems elegibles, contar uno por uno el stock real, detectar **diferencias** respecto al sistema y, al cerrar, generar un **informe de diferencias**.

Regla central de negocio: **el conteo NUNCA ajusta el stock automáticamente**. Las diferencias quedan como informe; el ajuste de stock se hace **manualmente** desde la ficha de cada producto/lente (`/products/[id]/adjustments`, `/lenses/[id]/adjustments`), y el usuario debe marcar cada línea como "Hecho".

Dos pantallas:

| Ruta                    | Pantalla                                                                        |
| ----------------------- | ------------------------------------------------------------------------------- |
| `/inventory/count`      | Lista/historial de sesiones + métricas + modal de creación                      |
| `/inventory/count/[id]` | Detalle de sesión: métricas, tabla de líneas, conteo inline, cierre/cancelación |

---

## 2. Stack y contexto técnico

| Área       | Tecnología                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Framework  | **SvelteKit 2** (`@sveltejs/kit ^2.70`) con **Svelte 5** (runes: `$state`, `$derived`, `$props`, `$bindable`, snippets) |
| Lenguaje   | TypeScript obligatorio                                                                                                  |
| Estilos    | **Tailwind CSS v4** (CSS-first: `@theme` en `src/routes/layout.css`), plugin `tailwind-scrollbar`                       |
| Icons      | `@lucide/svelte` (importes explícitos, nunca barrels)                                                                   |
| UI base    | shadcn-svelte / **bits-ui** (`ui/dialog`, `ui/popover`…), `DataGrid`, `AppBadge` propios                                |
| Datos      | **Drizzle ORM** + PostgreSQL (`postgres.js`), schema en `src/lib/server/db/schema/`, migraciones `drizzle/`             |
| Server     | Remote functions de SvelteKit (`$app/server`: `query`, `command`) en `src/lib/remote/inventoryCount.remote.ts`          |
| Validación | **Zod 4** (`src/lib/schemas/inventoryCount.ts`), client + server                                                        |
| Toasts     | `svelte-sonner`                                                                                                         |
| Contexto   | Svelte context (`src/lib/context/inventoryCount.ts`)                                                                    |
| Tests      | Vitest (unit + integration con Testcontainers), Playwright (e2e)                                                        |
| Paquete    | pnpm 11                                                                                                                 |

Convenciones que aplican al rediseño (`.github/instructions/`):

- **Sin barrels**: importar desde el módulo que define (`./countSummary`, `$lib/components/inventory/count/...`).
- **Tailwind es la única solución de estilos**; no duplicar clases — extraer componente.
- Carga inicial solo en `+page.server.ts` (`load`); lo demás con remote functions. Nunca `$effect`/`onMount` para datos iniciales.
- Validación client-side obligatoria + toast y caja de error en modales.
- Accesibilidad no opcional; tests al cambiar comportamiento; `pnpm lint && pnpm test` antes de commitear.
- Design system propio en `.github/instructions/design-ui.instructions.md` (grid 4px, disciplina de radios, color solo con significado, monospace para datos).
- Existe base de diseño consultable: `.github/prompts/ui-ux-pro-max/` (CSV de estilos/colores/UX) y `designs/optikt-redesign.pen`.

---

## 3. Mapa de archivos

```
src/routes/(app)/inventory/count/
  +page.server.ts            load: rol + getActiveSession + getSessions(limit 50)
  +page.svelte               pantalla lista (234 l.)
  [id]/+page.server.ts       load: rol + getSessionById (session + todas las líneas)
  [id]/+page.svelte          pantalla detalle (325 l.)

src/lib/remote/inventoryCount.remote.ts        7 remote functions (queries + commands)

src/lib/schemas/inventoryCount.ts              Zod + enums/labels/constantes de UI (114 l.)

src/lib/server/db/schema/inventoryCount.ts     2 tablas Drizzle (147 l.)
src/lib/server/db/queries/inventoryCount/
  sessions.ts      ciclo de vida (get/create/cancel/apply) (241 l.)
  lines.ts         lectura/escritura de líneas (189 l.)
  shared.ts        snapshot, enriquecimiento, filtros SQL (277 l.)
  types.ts         tipos de dominio (68 l.)
  sessions.int.spec.ts

src/lib/components/inventory/count/
  CountListHeader.svelte        encabezado lista + CTA + strip de sesión activa
  CountListMetrics.svelte       4 tarjetas de métricas
  CountHistoryTable.svelte      tabla historial + filtros (262 l.)
  CountCreateModal.svelte       modal de creación (197 l.)
  CountSessionHeader.svelte     encabezado detalle + cerrar/cancelar
  CountSummaryMetrics.svelte    métricas + barra de progreso + mensaje contextual
  CountLinesTable.svelte        tabla de líneas + toolbar filtros/búsqueda (249 l.)
  CountLineMobileCard.svelte    tarjeta móvil por línea (150 l.)
  CountLineEditRow.svelte       editor inline (117 l.) + tipo `CountLineEditing`
  CountActionModals.svelte      modales cerrar/cancelar sesión (202 l.)
  countSummary.ts               stats, filtros, métricas, mensajes (245 l.)
  countList.ts                  opciones de alcance, cobertura, merge (64 l.)
  countAdjustments.ts           predicados de diferencia + rutas de ajuste (52 l.)
  *.spec.ts                     tests unitarios de los 3 helpers

src/lib/context/inventoryCount.ts              contexto de sesión activa
src/lib/components/layout/Sidebar.svelte       ítem de nav + icono dinámico
src/routes/(app)/+layout.svelte                setInventoryCountContext
src/routes/(app)/+layout.server.ts             carga sesión activa en todo el app

Flujo de ajuste (módulo vecino):
src/routes/(app)/products/[id]/adjustments/    ajuste manual de producto (rol ADMIN/MANAGER)
src/routes/(app)/lenses/[id]/adjustments/      ajuste manual de lente (rol ADMIN)

e2e/inventory-count.test.ts                    cierre de sesión desde la UI
```

---

## 4. Modelo de datos e invariantes

### `inventory_count_sessions`

| Columna                                                              | Tipo             | Notas                                       |
| -------------------------------------------------------------------- | ---------------- | ------------------------------------------- |
| `id`                                                                 | serial PK        |                                             |
| `status`                                                             | varchar          | `OPEN` \| `APPLIED` \| `CANCELLED`          |
| `scopeType`                                                          | varchar          | `ALL` \| `PRODUCT_CATEGORY` \| `LENS`       |
| `scopeValue`                                                         | varchar          | solo con `PRODUCT_CATEGORY` → `ProductType` |
| `notes`                                                              | text             | máx. 500 chars                              |
| `openedById/openedAt`                                                | uuid/timestamptz |                                             |
| `appliedById/appliedAt`, `cancelledById/cancelledAt`, `cancelReason` |                  |                                             |
| `totalItemsCounted`, `totalAdjustmentsIn/Out`, `totalMatches`        | integer          | se calculan **al cerrar**                   |
| `createdAt/updatedAt`                                                |                  |                                             |

**Índice clave**: `ux_inventory_count_sessions_open` → unique parcial `WHERE status = 'OPEN'`. **Solo puede existir una sesión abierta a la vez en todo el sistema** (reforzado en `createSession` con error "Ya existe una sesión de conteo abierta").

### `inventory_count_lines`

| Columna                           | Tipo              | Notas                           |
| --------------------------------- | ----------------- | ------------------------------- |
| `id`                              | serial PK         |                                 |
| `sessionId`                       | int FK → sessions | `onDelete: cascade`             |
| `itemType`                        | varchar           | `PRODUCT` \| `LENS`             |
| `productId` / `lensCatalogItemId` | uuid FK           | uno u otro (restrict)           |
| **`systemStock`**                 | integer NOT NULL  | **snapshot** al abrir la sesión |
| `countedStock`                    | integer nullable  | `null` = pendiente              |
| `difference`                      | integer           | `countedStock - systemStock`    |
| `adjustmentCompleted` + `ById/At` |                   | tracking manual del ajuste      |
| `countedById/countedAt`           |                   | último usuario que contó        |
| `notes`                           | text              | máx. 240 chars                  |

**Invariants de datos:**

1. `systemStock` es inmutable: la comparación siempre es contra el snapshot, no contra el stock vivo.
2. `difference` se recalcula en cada guardado (`upsertCountLine`).
3. Cambiar el conteo **resetea** `adjustmentCompleted` (y sus metadatos) si cambió el conteo o la diferencia.
4. Las líneas se insertan de una sola vez al crear la sesión (`createSnapshotLines`).
5. Líneas elegibles:
   - **Productos**: `deletedAt IS NULL` **y** (`stock > 0` **o** tiene algún `inventory_movement`). Opcional filtro `type = scopeValue`.
   - **Lentes**: `deletedAt IS NULL` **y** `inventoryMode = 'STOCK'` **y** (`stock > 0` o tiene movimientos).
   - Orden por nombre. Si 0 ítems → error "No hay ítems elegibles para este conteo".
6. Las líneas se enriquecen con joins a `products`, `lensCatalogItems` y `users` (quién contó, quién marcó el ajuste).

> Nota: el row incluye `currentStock` (stock **vivo** actual) calculado en `lines.ts:74`, pero **no se muestra en ninguna pantalla** — la tabla muestra `systemStock`.

---

## 5. Máquina de estados de la sesión

```
            createSession (ADMIN/MANAGER/SELLER, sin otra OPEN)
                       │
                       ▼
                    ┌────────┐
        ┌───────────│  OPEN  │◄── única en el sistema (índice único)
        │           └───┬────┘
        │               │
 cancelSession          │ applySession
 (ADMIN/MANAGER,        │ (ADMIN/MANAGER, 100% líneas contadas)
  motivo ≥ 5 chars)     │
        │               │
        ▼               ▼
  ┌───────────┐   ┌──────────┐
  │ CANCELLED │   │ APPLIED  │
  └───────────┘   └──────────┘
   solo lectura    solo lectura + totales congelados
```

- `OPEN` → editable: contar/editar líneas, marcar ajustes, cerrar, cancelar.
- `APPLIED` → solo lectura; guarda `totalItemsCounted/In/Out/Matches`. Se pueden seguir marcando ajustes como hechos (`setLineAdjustmentStatus` solo rechaza `CANCELLED`).
- `CANCELLED` → solo lectura total; exige motivo; no se marcan ajustes.
- **Ningún estado modifica `products.stock` ni `lensCatalogItems.stock`.**

---

## 6. Flujo end-to-end

### 6.1 Llegada a la lista (`/inventory/count`)

1. `+page.server.ts`: `requirePageRole(ADMIN, MANAGER, SELLER)` (si no → redirect `/dashboard`).
2. Carga en paralelo: `getActiveSession()` (la OPEN más reciente) + `getSessions({limit: 50})`.
3. El layout (`(app)/+layout.server.ts`) ya cargó `activeInventoryCountSession` para **todas** las páginas → se propaga por contexto.
4. Render:
   - `CountListHeader`: título "Conteo Físico", subtítulo con 2 stats (sesiones aplicadas en 14 días, cobertura acumulada), **CTA** ("Continuar sesión" si hay activa / "Nueva sesión" si no) y **strip de estado** (punto verde/ámbar + "Sesión #N en progreso" o "Sin sesión activa" + chips de alcance y pendientes).
   - `CountListMetrics`: 4 tarjetas — Sesiones totales, Sesiones abiertas, Aplicadas recientes (14 días), Ítems auditados.
   - `CountHistoryTable`: cabecera + filtros + `DataGrid`.
   - `CountCreateModal`: oculto hasta pulsar CTA.

### 6.2 Filtrado del historial (cliente)

- Chips de alcance (toggle, se puede desactivar pulsando otra vez), input `date` "Día", botón "Limpiar".
- Sin filtros → usa las 50 sesiones cargadas. Con filtros → llama al remote `getSessions({limit: 100, scopeType, openedOn})`.
- Protección contra carreras con `historyRequestId` (ignora respuestas viejas).
- Estados vacíos distintos según haya filtros ("No hay sesiones para este filtro" vs "Sin sesiones registradas").
- **Los filtros viven en estado del componente: refrescar la página los pierde (sin URL state).**

### 6.3 Crear sesión (modal)

1. `CountCreateModal` (overlay propio `fixed inset-0 z-50`, `bg-brand-navy/35` + blur).
2. Selección de **alcance** en 3 tarjetas con icono (`COUNT_SCOPE_OPTIONS`):
   - `ALL` "Todo el inventario" (productos + lentes STOCK) — `Layers3`
   - `PRODUCT_CATEGORY` "Solo productos" (+ `<select>` de categoría: Montura, Lentes de sol, Lentes de contacto, Accesorio, o "Todos los productos") — `PackageSearch`
   - `LENS` "Solo lentes STOCK" — `ScanSearch`
3. Notas operativas (opcional, 500 chars) y panel lateral "Checklist de una sesión sana" que explica snapshot, unicidad, que los ajustes son manuales y que todas las líneas deben confirmarse.
4. Submit → `createSession` (command): valida Zod (p. ej. `scopeValue` solo con `PRODUCT_CATEGORY`), rol, unicidad, inserta sesión + líneas snapshot en **transacción**.
5. Éxito: merge optimista en listas, setea contexto `activeSession` (cambia el icono del sidebar a `ClipboardCheck`), cierra modal y `goto` a `/inventory/count/[id]`.
6. Error: caja de error en el modal + toast. Escape/click fuera cierran (si no está enviando).

### 6.4 Detalle de sesión (`/inventory/count/[id]`)

1. Load: rol + `getSessionById` → sesión enriquecida + **todas** las líneas (404 si no existe o id inválido).
2. `CountSessionHeader`: "Volver al historial", eyebrow según estado ("Conteo físico en ejecución" / "Informe de conteo físico" / "Conteo físico cancelado"), título `Sesión #N`, y si `OPEN && canManage` → botones **Cerrar sesión** (deshabilitado hasta 100% contado) y **Cancelar sesión**.
3. `CountSummaryMetrics`:
   - Badge de estado + "Alcance: …" + chip "Con notas" si hay notas.
   - "Apertura: fecha · Responsable" + lifecycle (quién cerró/canceló).
   - Stats inline: Pendientes (oro), OK (verde), +Dif (conteo/unidades), -Dif (conteo/unidades).
   - Barra de progreso `counted/total · %`.
   - Panel derecho: 4 métricas compactas (**Cobertura** `n/total`, **Diferencias**, **Variación** neta, **Ajustes** `hechos/total`) + mensaje contextual (`buildSummaryMessage`): "Siguiente paso: faltan N líneas…" / "Conteo completo…" / notas / motivo de cancelación / "N líneas requieren ajuste manual".
4. `CountLinesTable`:
   - Toolbar: chips de filtro `Todos | Pendientes | Con diferencia | OK`, buscador (nombre/SKU/ref, client-side), contador `n / total`.
   - `DataGrid`: 7 columnas (Ítem, SKU/Ref, Stock sistema, Stock contado, Diferencia, Contado por, Acción); fila con nota del ítem si existe.
   - Estados por fila:
     - **Pendiente** → botón "Contar".
     - **Contada** → valor clickeable (reeditar) + "✓ responsable".
     - **OK** (diferencia 0) → check verde "OK".
     - **Con diferencia** → badge de diferencia (`+n` verde / `-n` rojo) + enlace **"Ir a ajustar ↗"** (abre en **pestaña nueva**: `/products/{id}/adjustments` o `/lenses/{id}/adjustments`) + checkbox **"Hecho"** + label "Ajustado".
   - `sessionCancelled` oculta el checkbox de "Hecho".
5. Edición inline (`CountLineEditRow`, `layout="desktop"`): input numérico (min 0), botón check, toggle "Agregar nota" con textarea; **Enter guarda, Escape cancela**. Solo se permite en `OPEN`.
6. Guardado (`handleSaveLine`):
   - Validación client: entero ≥ 0 (si no, toast).
   - **Optimista**: aplica la línea localmente con `difference` recalculado y resetea el tracking de ajuste si corresponde; luego `upsertCountLine`.
   - Éxito → reemplaza con la línea devuelta y cierra edición. Error → rollback al estado previo + toast.
   - El server revalida (Zod, sesión abierta, línea pertenece a la sesión) y **recarga todas las líneas** de la sesión para devolver la fila.
7. Marcar ajuste "Hecho" → `setLineAdjustmentStatus` con lista de ids en progreso (evita doble click) → actualización local; error → toast.
8. **Cerrar sesión** → `CountActionModals` modal de confirmación con rejilla de stats (Contados, Sin diferencia, Pendientes, Diferencias +, Diferencias −), aviso explícito de que **no se aplica ningún ajuste automático**, bloqueo con warning si `pendingTotal > 0` → `applySession` → toast "Sesión de conteo cerrada", limpia contexto (icono sidebar vuelve a normal).
9. **Cancelar sesión** → modal con textarea de motivo (mín. 5 chars, validado en cliente y en Zod) → `cancelSession` → toast, estado solo lectura.

### 6.5 Flujo de ajuste (módulo vecino, parte del recorrido)

- "Ir a ajustar ↗" abre en pestaña nueva la página de ajuste manual:
  - **Producto** (`/products/[id]/adjustments`, rol ADMIN/MANAGER): wizard con rail de pasos, selección de lote FIFO, motivo, dirección (entrada/salida), cantidad, notas, tarjeta de impacto/pérdida estimada, confirmación si es pérdida financiera → `createManualAdjustmentCmd` → genera un `inventory_movement` (`MANUAL_ADJUSTMENT`) y actualiza el lote/stock.
  - **Lente** (`/lenses/[id]/adjustments`, rol **ADMIN**): mismas ideas, valida `inventoryMode = 'STOCK'`.
- **No hay enlace de datos** entre el ajuste y la línea de conteo: el usuario debe volver a la pestaña de la sesión y marcar "Hecho" a mano. Nadie verifica que el ajuste se haya hecho realmente.

---

## 7. Matriz de permisos

| Acción                        | ADMIN | MANAGER                          | SELLER                                        |
| ----------------------------- | ----- | -------------------------------- | --------------------------------------------- |
| Ver lista / detalle           | ✅    | ✅                               | ✅                                            |
| Crear sesión                  | ✅    | ✅                               | ✅                                            |
| Contar / editar líneas, notas | ✅    | ✅                               | ✅                                            |
| Marcar ajuste "Hecho"         | ✅    | ✅                               | ✅                                            |
| **Cerrar (apply) sesión**     | ✅    | ✅                               | ❌ (`canManage` oculta botón; server rechaza) |
| **Cancelar sesión**           | ✅    | ✅                               | ❌                                            |
| Ajustar producto              | ✅    | ✅                               | ❌ (redirect a `/dashboard`)                  |
| **Ajustar lente**             | ✅    | ❌ (**redirect a `/dashboard`**) | ❌                                            |

⚠️ **Desalineación real**: un MANAGER puede cerrar la sesión y ver "Ir a ajustar ↗" en un lente, pero al abrirla es redirigido al dashboard. Un SELLER puede contar todo pero no cerrar, y al llegar al 100% no ve ningún botón habilitado (solo el mensaje "lista para cerrarse").

Guardrails: `requirePageRole` en loads (redirect), `requireRole` en cada remote (403), y re-chequeo de rol dentro de `applySession`.

---

## 8. Contrato remoto (`src/lib/remote/inventoryCount.remote.ts`)

| Remote                    | Tipo    | Params                                                | Guard   | Devuelve                        |
| ------------------------- | ------- | ----------------------------------------------------- | ------- | ------------------------------- |
| `getActiveSession`        | query   | —                                                     | A/M/S   | sesión OPEN o null              |
| `getSessions`             | query   | `limit(1-100, def 20)`, `scopeType?`, `openedOn?`     | A/M/S   | `SessionSummary[]`              |
| `getSessionById`          | query   | `id`                                                  | A/M/S   | detalle + líneas                |
| `getSessionLines`         | query   | `sessionId`, `filter?`                                | A/M/S   | líneas (hoy no se usa desde UI) |
| `createSession`           | command | alcance + notas                                       | A/M/S   | `{success, session}`            |
| `upsertCountLine`         | command | `sessionId, itemId, itemType, countedStock≥0, notes?` | A/M/S   | `{success, line}`               |
| `setLineAdjustmentStatus` | command | `lineId, adjustmentCompleted`                         | A/M/S   | `{success, line}`               |
| `applySession`            | command | `id`                                                  | **A/M** | `{success, session}`            |
| `cancelSession`           | command | `id, reason(5-500)`                                   | **A/M** | `{success, session}`            |

Todos los commands envuelven en try/catch y devuelven `{success:false, error}` (nunca tiran). Lecturas con Zod en el query.

### 8.1 Mapa de interacciones con el resto del sistema

| Con qué                                               | Cómo interactúa                                                                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layout de la app** (`(app)/+layout.server.ts`)      | Carga `activeInventoryCountSession` en **cada request** del app; se pasa a `+layout.svelte`.                                                                                                |
| **Contexto Svelte** (`lib/context/inventoryCount.ts`) | `setInventoryCountContext` en el layout; lo consumen `Sidebar` y las dos páginas del módulo. La lista lo pone `{id}` al crear, el detalle lo pone `null` al cerrar/cancelar.                |
| **Sidebar** (`layout/Sidebar.svelte:62`)              | Ítem "Conteo Físico" (`/inventory/count`): icono `purchases` (ClipboardList) por defecto → `clipboard-check` (ClipboardCheck) mientras hay sesión activa. **Es el único indicador global.** |
| **Productos** (`products`)                            | Snapshot lee `products` (no borrados, con stock o movimientos, filtro opcional por `type`); ruta de ajuste `/products/{uuid}/adjustments`.                                                  |
| **Catálogo de lentes** (`lensCatalogItems`)           | Snapshot lee `inventoryMode='STOCK'` no borrados; ruta de ajuste `/lenses/{uuid}/adjustments`.                                                                                              |
| **Movimientos de inventario** (`inventoryMovements`)  | Solo se **lee** para decidir elegibilidad del snapshot. El ajuste manual posterior escribe un `MANUAL_ADJUSTMENT` **sin vincularlo a la línea de conteo**.                                  |
| **Usuarios** (`users`)                                | Nombres de quien abrió/contó/marcó ajuste/cerró/canceló (joins en `shared.ts`/`lines.ts`).                                                                                                  |
| **Navegación**                                        | `goto(resolve(...))` al crear y al volver; "Ir a ajustar" usa `window.open(..., '_blank', 'noopener,noreferrer')`.                                                                          |
| **Toasts**                                            | `svelte-sonner` para éxito/error en todas las acciones.                                                                                                                                     |
| **No interactúa con**                                 | notificaciones, auditoría (`audit`), reportes/PDF, dashboard, caja/ventas/compras. No hay widget ni entrada de navegación fuera del ítem del sidebar.                                       |

---

## 9. UI actual — lista

- **Encabezado**: `font-heading text-2xl/3xl text-brand-navy`, subtítulo con separadores `•`, CTA alineado a la derecha.
  - CTA sesión activa: **navy** (`bg-brand-navy` → hover `navy-dark`), icono `Play`, texto "Continuar sesión".
  - CTA sin sesión: **gold** (`bg-brand-gold`, texto navy), icono `Plus`, "Nueva sesión".
- **Strip de estado**: `glass-card`, punto de 10px verde (sin sesión) o ámbar (con sesión), chips pill `bg-surface-container`.
- **4 métricas**: `glass-card`, label uppercase 11px `tracking-[0.18em] text-outline`, valor 2xl navy, icono en contenedor redondeado tintado (`bg-warning-container/60`, `bg-success-container/60`, `bg-info-container/60`, `bg-surface-container`).
- **Historial**: `glass-card` sobre `bg-surface-container-low`; chips de alcance pill (selección = navy sólido); input date con icono `CalendarDays`; botón "Limpiar".
  - Columnas: Sesión (# + fecha), Alcance (chip + label), **Cobertura** (barra `bg-brand-blue` + "n/total · % · N pendientes"), **Resultado** (+dif/-dif/OK), Estado (`AppBadge`), Responsable, Acción ("Continuar"/"Ver detalle" + `ArrowRight`).
  - `AppBadge`: OPEN→`warning`, APPLIED→`success`, CANCELLED→`neutral` (mayúsculas, `rounded-md`).
- **Modal creación**: `max-w-4xl`, radio `1.25rem`, rejilla 2 columnas (form + aside "Checklist"), tarjetas de alcance seleccionables (selección = navy con texto blanco), select nativo de categoría, textarea de notas, caja de error `bg-error-container`, footer con "Cancelar" (outline) e "Iniciar sesión" (navy).

## 10. UI actual — detalle

- **Header**: link "Volver al historial", eyebrow uppercase `tracking-widest text-slate-400`, título `Sesión #N`, acciones a la derecha (Cerrar = navy con `Check`, Cancelar = outline con `X`; deshabilitados con `disabled:opacity-50`).
- **Resumen**: columna izquierda (badge + alcance + notas + fechas + stats inline + barra de progreso) / columna derecha (rejilla 2×2 de métricas en `font-mono text-[15px] tabular-nums` + mensaje contextual con label uppercase).
- **Tabla de líneas**: toolbar con chips (selección navy), buscador con icono `Search` absoluto, contador `n / total`.
  - Fila: nombre (semibold navy) + nota debajo · SKU en `font-mono` · stock sistema semibold · contado (clickeable o "—") · badge de diferencia pill (`bg-success-container/70` / `bg-error-container/80` / neutro) · "Contado por" · acción.
  - Acciones: "Contar" (botón `bg-surface-container`), valor + "✓ nombre", check "OK" verde, "Ir a ajustar ↗" (texto `brand-blue`) + checkbox "Hecho" 14px + "Ajustado".
- **Mobile (`<lg`)**: `DataGrid` renderiza `CountLineMobileCard` (artículos `rounded-2xl`): nombre + badge de diferencia, grid 2 columnas Sistema/Contado, editor inline sin atajos de teclado, botones full-width, checkbox "Hecho" en fila con label.
- **Modales de acción**: `max-w-lg`, radio `1.25rem`, icono `TriangleAlert` en contenedor warning para cerrar; rejilla de 6 stats; aviso de pendientes; botones "Cancelar"/"Cerrar sesión de conteo" y "Volver"/"Confirmar cancelación" (`bg-error`).

### 10.1 Desglose de componentes (responsabilidades y estado)

#### Página lista — `src/routes/(app)/inventory/count/+page.svelte`

Estado (`$state`): `activeSession`, `summarySessions`, `historySessions`, `showCreateModal`, `scopeType`, `scopeValue`, `notes`, `formError`, `isSubmitting`, `historyScopeFilter`, `historyOpenedOn`, `isHistoryLoading`, `historyRequestId`.
Derivados (`$derived`): `totalSessions`, `openSessionsCount`, `recentlyAppliedCount` (APPLIED en 14 días), `totalAuditedItems` (suma `totalItemsCounted ?? countedLines`), `hasHistoryFilters`, `historyResultCount`, títulos de estado vacío.
Handlers: `selectScope`, `openCreateModal`, `handleCreateSession`, `goToSession`, `handleModalKeydown`, `refreshHistorySessions` (con guardia de carrera), `toggleHistoryScopeFilter`, `applyHistoryDayFilter`, `clearHistoryFilters`.

#### Página detalle — `src/routes/(app)/inventory/count/[id]/+page.svelte`

Estado: `session`, `lines`, `search`, `activeFilter`, `showApplyModal`, `showCancelModal`, `cancelReason`, `isApplying`, `isCancelling`, `updatingAdjustmentLineIds` (ids en vuelo), `editing` (`CountLineEditing`).
Derivados: `currentUser`, `canManage` (ADMIN/MANAGER), `isReadonly` (`status !== 'OPEN'`), `stats` (`computeCountStats`), `canCloseSession`, `filteredLines`, `summaryMetrics`, `summary`.
Handlers: `goBack`, `openAdjustment` (nueva pestaña), `toggleAdjustmentCompleted` + `handleAdjustmentCheckboxChange`, `startEditing`/`stopEditing`, `updateLineLocally`, `handleSaveLine` (validación + optimista + rollback), `handleApplySession`, `handleCancelSession` (motivo ≥5).

#### Componentes

| Componente                         | Responsable                                                                                                                         | Props clave                                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CountListHeader.svelte` (88)      | Título, subtítulo con 2 stats, CTA condicional, strip de sesión activa                                                              | `recentlyAppliedCount`, `totalAuditedItems`, `activeSession`, `onContinue`, `onCreate`                                                                                             |
| `CountListMetrics.svelte` (91)     | 4 tarjetas glass-card de métricas                                                                                                   | `totalSessions`, `openSessionsCount`, `recentlyAppliedCount`, `totalAuditedItems`, `hasActiveSession`                                                                              |
| `CountHistoryTable.svelte` (262)   | Sección historial: cabecera, chips de alcance, date, limpiar, `DataGrid` con snippets `row` y `mobileCard`                          | `sessions`, `isHistoryLoading`, `historyResultCount`, textos vacíos, `historyScopeFilter`/`historyOpenedOn` (bindable), `onToggleScope`, `onDayChange`, `onClear`, `onOpenSession` |
| `CountCreateModal.svelte` (197)    | Modal de creación: tarjetas de alcance, select de categoría, notas, aside checklist, footer                                         | `showCreate`, `isSubmitting`, `scopeType`, `scopeValue`, `notes` (bindable), `formError`, `onSelectScope`, `onClose`, `onSubmit`, `onKeydown`                                      |
| `CountSessionHeader.svelte` (63)   | Volver, eyebrow por estado, título `Sesión #N`, acciones cerrar/cancelar                                                            | `sessionId`, `status`, `canManage`, `canCloseSession`, `onBack`, `onOpenApply`, `onOpenCancel`                                                                                     |
| `CountSummaryMetrics.svelte` (119) | Badge + alcance + fechas + stats inline + barra + panel de 4 métricas + mensaje contextual                                          | `session`, `stats`, `metrics`, `messageLabel`, `message`                                                                                                                           |
| `CountLinesTable.svelte` (249)     | Toolbar (chips, buscador, contador) + `DataGrid` de 7 columnas; delega celdas en editor y tarjeta móvil                             | `lines`, `totalLines`, `activeFilter`/`search`/`editing` (bindable), `isReadonly`, `sessionCancelled`, callbacks de edición/ajuste                                                 |
| `CountLineMobileCard.svelte` (150) | Tarjeta `<lg` por línea: nombre, badge dif., Sistema/Contado, editor, ajuste/OK/contar                                              | mismos callbacks + `line`                                                                                                                                                          |
| `CountLineEditRow.svelte` (117)    | Editor inline; **módulo** exporta `CountLineEditing`, `createEmptyLineEditing`, `startLineEditing`; `layout: 'desktop' \| 'mobile'` | `count`/`notes`/`showNotes` (bindable), `isSaving`, `onSave`, `onCancel`; Enter/Esc solo en desktop                                                                                |
| `CountActionModals.svelte` (202)   | Dos modales: cerrar (stats + aviso sin ajuste automático) y cancelar (motivo)                                                       | `showApplyModal`, `showCancelModal`, `cancelReason` (bindable), todas las stats, `isApplying`, `isCancelling`, `canCloseSession`, `onApply`, `onCancel`                            |

#### Helpers lógicos (sin UI, con tests)

| Módulo                     | Exporta                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `countSummary.ts` (245)    | `computeCountStats`, `filterCountLines`, `buildSummaryMetrics`, `buildSummaryMessage`, `statusVariant`, `statusLabelFor`, `compactStatClass`, `scopeLabelFor`, `openedSummaryFor`, `lifecycleSummaryFor` + tipos `CountStats`, `SummaryMetric`, `SummaryMetricTone` |
| `countList.ts` (64)        | `COUNT_SCOPE_OPTIONS` (valor/label/descripción/icono), `isWithinLastDays`, `getCoveragePercent`, `getScopeLabel`, `mergeCreatedSession`                                                                                                                             |
| `countAdjustments.ts` (52) | `hasDifference`, `isMatchedLine`, `getAdjustmentPath`, `formatDifference`, `differenceBadgeClass`, `isAdjustmentStatusUpdating`, `toggleUpdatingId`, tipo `CountAdjustmentPath`                                                                                     |

---

## 11. Colores y paletas (tokens reales de `src/routes/layout.css`)

### 11.1 Marca

| Token                   | Hex                   | Uso en el módulo                                                        |
| ----------------------- | --------------------- | ----------------------------------------------------------------------- |
| `brand-navy`            | `#152346`             | Títulos, botones primarios, chips seleccionados, valores                |
| `brand-navy-dark`       | `#000d2f`             | Hover de primarios                                                      |
| `brand-navy-light`      | `#38466b`             | (reserva)                                                               |
| `brand-blue`            | `#419ebd`             | Enlaces/acciones secundarias, barras de progreso, foco, "Ir a ajustar"  |
| `brand-blue-light/dark` | `#7ad2f3` / `#3897b5` | variantes                                                               |
| `brand-gold`            | `#fcd01e`             | CTA "Nueva sesión", número de pendientes, realce "Alcance seleccionado" |
| `brand-gold-dark/light` | `#edc200` / `#ffe080` | hover / tintes                                                          |

### 11.2 Superficie (tonal, sin bordes duros)

| Token                                 | Hex       |
| ------------------------------------- | --------- |
| `surface` (fondo de página/body)      | `#fbf8fc` |
| `surface-container-lowest` (tarjetas) | `#ffffff` |
| `surface-container-low`               | `#f5f3f6` |
| `surface-container`                   | `#efedf1` |
| `surface-container-high`              | `#eae7eb` |
| `surface-container-highest`           | `#e4e2e5` |
| `surface-dim`                         | `#dbd9dd` |

### 11.3 Texto y estructura

| Token                                                      | Hex       |
| ---------------------------------------------------------- | --------- |
| `on-surface`                                               | `#1b1b1e` |
| `on-surface-variant`                                       | `#45464e` |
| `outline` (labels uppercase)                               | `#75777f` |
| `outline-variant` (bordes, dividido con `/15` `/20` `/25`) | `#c6c6cf` |

### 11.4 Semánticos (par container / on-container → badge `AppBadge`)

| Familia | base      | container | on-container | Uso en módulo                                                    |
| ------- | --------- | --------- | ------------ | ---------------------------------------------------------------- |
| Success | `#12b76a` | `#d1fadf` | `#027a48`    | OK, dif. positiva, sesiones aplicadas, ítems auditados           |
| Warning | `#f79009` | `#fef0c7` | `#b54708`    | sesión OPEN, pendientes, cobertura incompleta, warning de cierre |
| Error   | `#ba1a1a` | `#ffdad6` | `#93000a`    | dif. negativa, cancelación, cajas de error                       |
| Info    | `#419ebd` | `#d4eef8` | `#1e4f5e`    | métrica "Ítems auditados"                                        |
| Purple  | `#7c3aed` | `#ede9fe` | `#5b21b6`    | (disponible, no usado en el módulo)                              |

Además: escalas `primary-50…900` (azul cielo) y `secondary-50…900` (dorado), y paleta de charts `--chart-1..5` = `#419ebd, #152346, #fcd01e, #12b76a, #7c3aed`.

### 11.5 Cómo se combinan hoy (patrones repetidos)

- Tarjeta: `.glass-card` = `bg-white` + `border-slate-200` + sombra `--ds-shadow-md` (se usa `border-outline-variant/20` encima).
- Filtros/chips: sólido navy con texto blanco cuando está activo; `bg-surface-container` con `text-on-surface-variant` cuando no.
- Badges de diferencia: pill `bg-success-container/70 text-success` (positiva), `bg-error-container/80 text-error` (negativa), `bg-surface-container text-on-surface-variant` (0 o null).
- Labels: patrón fijo `text-[11px] font-semibold tracking-[0.18em] text-outline uppercase`.
- Overlay de modales: `bg-brand-navy/35 backdrop-blur-[2px]`.
- Focus: `--tw-ring-color: brand-blue` global + `accent-color: brand-blue` en checkboxes.

---

## 12. Tipografía, espaciado, radios, sombras, iconografía

- **Fuentes**: `Inter` (body) y `Space Grotesk` (`.font-heading`, títulos).
- **Base `html { font-size: 18px }`** → todas las medidas `rem`/`text-*` de Tailwind salen ~12.5% más grandes que el default de 16px.
- **Espaciado**: grid 4px; tokens `--ds-spacing-*` (4/8/12/16/24/32). Uso real en módulo: `p-4`, `p-6`, `gap-2/3/4/5`, `space-y-2/3/4/5`.
- **Radios en uso (mezcla)**: `rounded-lg` 8px, `rounded-xl` 12px (botones, glass-card), `rounded-2xl` 16px (tarjetas de alcance, métricas), `rounded-3xl` 24px (aside del modal), `rounded-[1.25rem]` 20px (modales), `rounded-full` (pills). El design-ui instructions pide radio de grid 4px y "sharp 4-8 o soft 8-12, no mezclar sistemas" → **el módulo hoy mezcla 8→24px**.
- **Sombras**: `--ds-shadow-sm/md/lg` (layered, premium). `.glass-card` usa `md`. Anti-patrones del design doc: sombras dramáticas, gradients decorativos, radios grandes en elementos pequeños, `spring`.
- **Iconografía**: `@lucide/svelte` explícito (`Play`, `Plus`, `ArrowLeft/Right`, `Check`, `X`, `Search`, `CalendarDays`, `RotateCcw`, `TriangleAlert`, `ClipboardList`, `Clock3`, `CheckCircle2`, `Boxes`, `Layers3`, `PackageSearch`, `ScanSearch`).
- **Transiciones**: `transition-colors` 150-200ms; barra de progreso `duration-200`; nada de spring.

---

## 13. Accesibilidad actual

**Bien**: `role="dialog"` + `aria-modal` + `aria-labelledby` en modales; `aria-pressed` en chips de filtro/alcance; `aria-label` en botones de icono; `aria-hidden` en puntos decorativos; tablas semánticas (`thead/th` con alineación); inputs con labels; `focus:ring` global; `accent-color` en checkboxes.

**Faltante / mejorable**:

- Los modales son overlays hechos a mano (no usan `ui/dialog` de bits-ui): **sin focus trap, sin foco inicial, sin `Escape` gestionado por el primitive** (el handler está en el overlay; funciona por burbujeo pero no hay gestión de foco al abrir/cerrar).
- El editor inline mobile no tiene atajos Enter/Escape (solo desktop).
- No hay navegación por teclado "siguiente pendiente" ni shortcut de conteo rápido.
- Estados vacíos y loading: `DataGrid` soporta spinner, pero la lista de líneas no usa `loading`.
- Contrast: `text-outline` (`#75777f`) sobre blanco ≈ 4.6:1 (apena AA para texto pequeño); los labels uppercase de 11px están en el límite.

---

## 14. Rendimiento y datos

- Load de lista: 1 query de sesión activa + 1 de sesiones (50) + enrich (users + agregados SQL con `count(*) filter (where …)`). La sesión activa se carga en **cada** request del app (layout).
- Load de detalle: sesión + **todas** las líneas con 5 joins. Sin paginación.
- `DataGrid` recibe `page=1, totalPages=1, onPageChange=noop` → **renderiza todas las filas** (una sesión `ALL` puede tener miles de productos + lentes). Igual en el historial.
- Cada guardado de línea hace `upsertCountLine` → server reejecuta `getSessionLines('ALL')` completo y devuelve 1 línea (transferencia O(n) por guardar).
- Búsqueda y filtros de líneas son **client-side** sobre lo ya cargado.
- No hay estado en URL (filtros/búsqueda se pierden al refrescar).

---

## 15. Tests existentes (red debe mantenerse en verde)

| Archivo                       | Cubre                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `countSummary.spec.ts` (217)  | `computeCountStats`, `filterCountLines`, `buildSummaryMetrics`, `buildSummaryMessage`, labels/variantes de estado                       |
| `countList.spec.ts`           | `isWithinLastDays`, `getCoveragePercent`, `getScopeLabel`, `mergeCreatedSession`, 3 opciones de alcance                                 |
| `countAdjustments.spec.ts`    | `hasDifference`/`isMatchedLine`, `getAdjustmentPath` (producto/lente/null), `formatDifference`, `differenceBadgeClass`, tracking de ids |
| `sessions.int.spec.ts`        | apply: totales correctos, rechaza SELLER, rechaza líneas sin contar, rechaza sesión no OPEN, rechaza usuario desconocido                |
| `e2e/inventory-count.test.ts` | login admin → abrir sesión → "Cerrar sesión" → toast "Sesión de conteo cerrada" → eyebrow "Informe de conteo físico"                    |

---

## 16. Invariantes a preservar en el rediseño

1. **Una única sesión OPEN** (índice único + guard en `createSession`).
2. **Snapshot inmutable**: `difference = countedStock - systemStock` (nunca stock vivo).
3. **El conteo jamás escribe en `products.stock` / `lensCatalogItems.stock`.**
4. **Cierre solo al 100%**: `canCloseInventoryCountSession(total, counted)`.
5. **Roles**: contar A/M/S; cerrar/cancelar solo A/M; guard en load **y** en cada remote.
6. **Reset del tracking de ajuste** al cambiar conteo/diferencia.
7. **Ajuste manual solo en líneas con diferencia** y no en sesiones CANCELLED.
8. Motivo de cancelación obligatorio (5-500), notas de sesión ≤500, notas de línea ≤240, conteo entero ≥0.
9. Rollback optimista ante fallo de guardado.
10. Disclosures actuales: al cerrar se avisa explícitamente que **no** hay ajuste automático; el checklist de creación explica snapshot/unicidad/ajustes manuales.
11. Tests unit + integration + e2e en verde; `pnpm lint && pnpm test`.

---

## 17. Oportunidades de mejora detectadas (evidencia)

### Experiencia de conteo (la más importante)

1. **Flujo de conteo lento**: una línea a la vez, edición inline en una tabla larga, sin "siguiente pendiente", sin conteo rápido tipo "igual que sistema", sin escáner/código. Para inventarios de miles de ítems es el cuello de botella.
2. **Sin paginación ni virtualización** en `CountLinesTable` (DataGrid con `totalPages=1`) → riesgo de UI pesada en sesiones grandes.
3. **Guardar recarga todas las líneas** en el server (`lines.ts:129`) → latencia creciente.
4. **Sin estado en URL**: filtros/búsqueda desaparecen al refrescar o navegar.
5. **Paridad desktop/mobile desigual**: el editor mobile no tiene Enter/Escape ni notas en el mismo bloque; comportamiento distinto entre plataformas.
6. **"Stock sistema" es el snapshot**, pero no se etiqueta como tal y `currentStock` (stock vivo) se calcula y no se muestra → confusión si hubo ventas durante la sesión.

### Cierre y ajustes

7. **Bucle de ajuste roto**: "Ir a ajustar ↗" abre pestaña nueva, no hay enlace de datos ajuste↔línea, y "Hecho" es un checkbox de confianza (nadie verifica que el ajuste exista). Candidato a integración o al menos a evidencia (mostrar el movimiento vinculado).
8. **Dead-end de permisos**: MANAGER no puede entrar a `/lenses/[id]/adjustments` (solo ADMIN) → redirect silencioso a `/dashboard`; SELLER cuenta pero no puede cerrar ni ve botón útil al 100%.
9. **Cancelar/cerrar solo visibles para A/M** sin explicación para SELLER (hoy el mensaje dice "lista para cerrarse" pero no quién puede cerrarla).

### Información y métricas

10. **Métricas redundantes**: 4 tarjetas en lista + 4 métricas + stats inline + mensaje + barra; labels ambiguos ("Sesiones totales" = "historial cargado en pantalla", depende del limit 50).
11. **El mensaje de "Siguiente paso" desaparece** cuando la sesión tiene notas (`buildSummaryMessage` prioriza notas sobre la guía).
12. **Semántica de color discutible**: diferencia positiva (sobrante) en verde "success" — un sobrante también puede ser error de conteo/fraude; y negativa en rojo. Conviene decidir la semántica en el rediseño.
13. Sin informe exportable/imprimible del conteo (existe estilo `@media print` global pero no vista de informe).

### UI/consistencia

14. **Dos CTA primarios distintos en la misma pantalla** (gold "Nueva sesión" vs navy "Continuar sesión") y radios mezclados 8→24px, contra lo que pide `design-ui.instructions.md`.
15. **Modales hechos a mano** en vez de `ui/dialog` (bits-ui) ya presente en el repo → sin focus trap.
16. **Clases duplicadas** (labels uppercase, chips, glass-card) violando la convención "no duplicar clases — extraer componente".
17. Único indicador global de sesión activa = **icono del sidebar** (sin banner/toast en el resto del app).

---

## 18. Decisiones abiertas para el rediseño

1. ¿Cambiar el modelo a **conteo asistido** (flujo guiado ítem por ítem / siguiente pendiente / modo rápido) manteniendo el mismo contrato de datos?
2. ¿Mantener tabla + filtros como vista "informe" y agregar un modo "contar" aparte?
3. ¿Integrar el ajuste dentro de la sesión (o vincular el `inventory_movement` a la línea) en vez del salto a pestaña nueva?
4. ¿Permitir que SELLER cierre, o mostrar explícitamente "solo ADMIN/MANAGER pueden cerrar"?
5. ¿Paginación/virtualización y guardado incremental (por línea) para sesiones grandes?
6. ¿Semántica de color para diferencias (+/−) y qué métricas sobreviven (consolidar)?
7. ¿Usar `ui/dialog`/bits-ui y extraer componentes de chips/labels para cumplir convenciones?
8. ¿Mantener el alcance actual de snapshots/filtros o ampliar (por marca/proveedor/ubicación)?
