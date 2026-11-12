# Página `/sales` — Descripción completa (estado actual, tras el rediseño)

> Referencia de la pantalla de listado de ventas. Reemplaza al documento previo al rediseño.
> Fuentes: `src/routes/(app)/sales/+page.{server.ts,svelte}`, `src/lib/components/sales/*`, `src/lib/remote/sales/queries.remote.ts`, `src/lib/server/db/queries/sales/*`, `docs/agents/sales.md`.
> Plan: `docs/plans/sales-list-redesign.md` · Contrato de acciones: `docs/specs/action-intent-param.md`.

---

## 1. Qué es

`/sales` es el listado de ventas: **saldo pendiente como protagonista**, dos vistas (**Lista** y **Cuadros**), filtros completos y visibles, KPIs globales y acciones rápidas que navegan al detalle. La vista elegida queda **guardada en el perfil del usuario**.

- **Ruta:** `src/routes/(app)/sales/`
- **Componentes:** `SaleListHeader`, `SaleKpiCards`, `SaleFilterBar`, `SaleStatusTabs`, `SaleFilterChips`, `SalesListView`, `SalesGridView`, `SaleCard`, `SaleBalanceCell`, `SaleRowMenu`, `SaleListFooter`, `CancelSaleModal` (todos en `src/lib/components/sales/`)
- **Puro/compartido:** `src/lib/shared/saleBalance.ts`, `src/lib/components/sales/{listParams,saleDisplay,statusFilter}.ts`
- **Remotes:** `listSales`, `getSalesStats` (`remote/sales/queries.remote.ts`), `saveUserPreference` (`remote/users/preferences.remote.ts`)
- **Queries:** `getSalesListPage`, `getAllSales`, `countSales`, `countSalesByStatus`, `sumSalesForSelection`, `getSalesStats`, `listSaleSellers` (`server/db/queries/sales/reads.ts`)

---

## 2. Flujo de datos

Capas estrictas: **página → remote (`query`) → query functions → Drizzle**.

### 2.1 Carga inicial (SSR) — 7 queries en paralelo

`+page.server.ts` parsea la URL y ejecuta en un solo `Promise.all`:

1. `getSalesListPage` → internamente `getAllSales` + `countSales` + `countSalesByStatus` + `sumSalesForSelection` (4 queries)
2. `getSalesStats` (KPIs globales)
3. `listSaleSellers` (opciones del select de vendedor)
4. `getUserPreference(user.id, 'sales.view')` (vista guardada)

Devuelve `{ sales, total, facets, selection, page, perPage, totalPages, stats, sellers, preferredView }`.

### 2.2 Interacciones posteriores

Un solo remote `listSales` por cambio de filtro (vuelve a correr `getSalesListPage` = 4 queries, una sola llamada de red). `getSalesStats` solo se refresca tras cancelar.

- **Búsqueda con debounce 300 ms**; el resto de filtros refrescan de inmediato.
- Todo cambio de filtro vuelve a **página 1**.
- `history.replaceState` (sin entradas nuevas en el historial).
- Mientras hay `loading` con filas visibles: contenido atenuado (`opacity-60`, `aria-busy`), **nunca** un spinner que reemplace la pantalla.

### 2.3 URL = fuente de verdad

| Param                                                 | Valores                                     | Significado                                           |
| ----------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| `q`                                                   | string                                      | búsqueda (tokens AND + match exacto de `orderNumber`) |
| `status`                                              | CSV de enums                                | estados; inválidos se ignoran                         |
| `shippingPending` / `freeItem` / `cashea` / `balance` | `1`                                         | toggles de filtros                                    |
| `seller`                                              | uuid                                        | vendedor (validado con `z.uuid()` en el load)         |
| `from`, `to`                                          | `YYYY-MM-DD`                                | rango de fechas (presets o personalizado)             |
| `sort`                                                | `recent`(def) · `balance` · `total` · `old` | orden                                                 |
| `per`                                                 | `10`(def) · `25` · `50`                     | por página                                            |
| `view`                                                | `list`(def) · `grid`                        | override explícito de la vista                        |
| `page`                                                | número ≥ 1                                  | página                                                |

Parseo tolerante en `components/sales/listParams.ts` (spec) + `statusFilter.ts` (spec) + `parsePageParam`/`parseBooleanParam` de `$lib/utils`. **Los params originales (`q`, `status`, `shippingPending`, `freeItem`, `cashea`, `page`) siguen compatibles con enlaces viejos.**

Persistencia al salir: `beforeNavigate` guarda el querystring en `sessionStorage` (`listReferrer:/sales`) cuando se navega a un sub-ruta de `/sales`; el detalle vuelve con `getBackUrl('/sales')` conservando filtros, vista y página.

---

## 3. Cabecera (`SaleListHeader`)

- `h1` **Ventas** (Space Grotesk 28/700 navy) con el subtítulo **«N ventas registradas»** (conteo **global**, `stats.total`) **en la misma línea**, alineado a la baseline.
- **SegmentedToggle Lista/Cuadros** (variant `light`, `role=tablist` + `aria-selected` + navegación con flechas) con tooltip «Vista de lista o cuadros».
- Botón **«+ Nueva venta»** (dorado, 38 px) solo si `canOperate(role)` (todo rol ≠ VIEWER).

**Vista por perfil (§4.3 del prompt):** precedencia `?view=` > preferencia guardada > `list`. Se resuelve en el SSR (sin parpadeo). Al cambiar: `replaceState` + `saveUserPreference` **en silencio (sin toast)**; si el guardado falla, la vista cambia igual y se reintenta en silencio. VIEWER también puede guardarla.

---

## 4. KPIs (`SaleKpiCards`) — globales

Tres botones, en `grid-cols-[1.35fr_1fr_1fr]` (se apilan < md), cada uno con tooltip y acción:

| KPI                                       | Contenido                                                | Clic                                        |
| ----------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| **Por cobrar** (navy, monto dorado SG 30) | `receivableAmount` + «en N ventas con saldo»             | `balance=1`, limpia estados, `sort=balance` |
| **Ventas del mes**                        | conteo + «USD x vendidos» (`monthly`, `monthlyTotalUsd`) | preset `Este mes`                           |
| **Listas para retirar**                   | conteo + «por entregar» (`ready`)                        | `status=READY`                              |

Definición de «Por cobrar» = **no canceladas con saldo > 0,01** (misma regla que `dashboard.ts` y `receivables.ts`). Reemplazan al `<dl>` `SaleStatsCards` (**eliminado**).

---

## 5. Filtros (una card, tres niveles)

### Nivel 1 — `SaleFilterBar`

- **Búsqueda + controles en la misma fila** (desktop): cada control es hermano directo de la búsqueda (`display:contents` en el agrupador) para que **fluya inline** y, si no entra, **se aplane uno por uno** en vez de empujar todo el bloque hacia abajo.
- **Búsqueda** (flex-1, mín. 200 px): lupa dentro del campo (`pl-9`, sin superponerse al placeholder), placeholder «Buscar por cliente, vendedor o # de orden…», debounce 300 ms.
- **Vendedor** (select «Todos los vendedores», `max-w-44`).
- **Fecha**: presets `Todas las fechas · Hoy · Últimos 7 días · Este mes · Personalizado` (+ dos `input[type=date]` en personalizado). El preset activo se deriva de `from`/`to` (`saleListDatePreset`).
- **Filtros ▾** (popover con 4 switches 30×18): `Cashea · Envío pendiente · Ítem libre · Solo con saldo pendiente`, con burbuja navy del conteo.
- **Orden**: `Más recientes · Mayor saldo · Mayor total · Más antiguas` (tooltip).
- **Mobile (< lg):** primera fila = búsqueda + botón «Filtros» con conteo; el resto en bloque colapsable.

### Nivel 2 — `SaleStatusTabs` (pestañas facetadas)

«Todas N» + una por estado con su conteo. **Multiselección** (clic alterna; «Todas» limpia), `aria-pressed`, activa en navy. Los conteos son **facetados**: respetan los demás filtros e ignoran el de estados (`countSalesByStatus`, una query `GROUP BY`). Reemplaza a `StatusMultiSelect` (eliminado); `statusFilter.ts` sigue vivo.

### Nivel 3 — `SaleFilterChips`

Un chip por filtro activo (estado, toggles, vendedor, fecha) con ✕ individual + **«Limpiar (n)»**. **Una sola fuente de verdad** de «filtros activos» (desktop y mobile); la búsqueda vive en su input.

---

## 6. Vista Lista (`SalesListView`)

`<table class="table-fixed">`, encabezado **30 px** uppercase 11 px, filas ≥ 58 px, hairlines, hover `surface-container-low`, entrada escalonada (25 ms/fila).

**Ancho adaptativo del contenedor** (corrección tras revisión en pantalla 2558 px): `max-w-[1280px]` base, `min-[1440px]:1440`, `min-[1920px]:1600`, `min-[2400px]:1920` — en pantallas angostas se comporta igual que el mockup (1280) y en las anchas llena sin dejar ~500 px vacíos a los lados.

**Columnas** (`w` fijos; Cliente absorbe el sobrante):

| Columna                         | Contenido                                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **#** (96)                      | `#265` mono 14/700 navy **enlace real** + isotipo Cashea 18 px (tooltip)                                                                                                                                                       |
| **Cliente** (auto)              | nombre 14/600 (hasta 2 líneas, sin truncar) + cédula mono 12 px                                                                                                                                                                |
| **Fecha** (96)                  | `DD/MM/AA` + «hace N d» (secundario)                                                                                                                                                                                           |
| **Total** (100, der.)           | `$x` Space Grotesk 600                                                                                                                                                                                                         |
| **Saldo pendiente** (176, der.) | ver §6.1                                                                                                                                                                                                                       |
| **Estado** (124)                | `SaleStatusBadge` con **`whitespace-nowrap`** y etiqueta corta **«DISPONIBLE»** para `READY` (`saleListStatusLabel`, solo en la tabla); debajo, los iconos de **envío pendiente** (ámbar) e **ítem libre** (morado) si existen |
| **Vendedor** (150)              | avatar 26 px + nombre — **`hidden` hasta `@min-[1130px]`** (oculta encabezado Y celdas a la vez)                                                                                                                               |
| **⋯** (44)                      | `SaleRowMenu` (cabecera `sr-only` «Acciones»)                                                                                                                                                                                  |

### 6.1 Celda de saldo (`SaleBalanceCell`)

- **Con saldo:** monto SG 16/700 navy (tooltip «Cobrado $x de $y») + barra 5 px con relleno `warning` (`#f79009`) + «N% cobrado».
- **Pagada:** «✓ Pagado» en `on-success-container` + barra verde completa + total debajo en secundario.
- **Cancelada:** total tachado + **barra vacía con borde discontinuo** + «⊘ Cancelada · sin saldo» (`on-error-container`).

Estados de saldo de un vistazo: **naranja = hay saldo · verde = pagado · gris discontinuo = cancelada**.

### 6.2 Menú ⋯ (`SaleRowMenu`)

Botón 34×34, icono 18 px **navy**, tooltip «Más acciones», `aria-label`, menú blanco radio 12 con `animate-pop` (scale .95→1, 200 ms):

1. **Ver detalle**
2. **Registrar pago** (si hay saldo > 0,01, no cancelada y el rol puede) — subtexto «Abre la venta y su drawer de pago» → navega a `?action=pay`
3. **Cambiar estado** (no canceladas ni completadas) — subtexto «Abre la venta y el modal de estado» → navega a `?action=status`
4. —separador— **Cancelar venta** (rojo; solo `PENDING` + ownership) → abre `CancelSaleModal` **desde el listado** (2 pasos, sin cambios)

**No se copia** el drawer de pago ni el modal de estado al listado.

### 6.3 Pie (`SaleListFooter`)

`Mostrando 1–10 de 264 ventas` · `Selección: total $x · saldo $y` (tooltip: suma de **todas** las ventas que cumplen los filtros, sin canceladas) · selector `10/25/50` (**solo en Lista**) · paginación con ventana de 5 (actual en `brand-blue`, `aria-current="page"`). Tokens (`on-surface-variant`), nunca `text-slate-*`.

---

## 7. Vista Cuadros (`SalesGridView` + `SaleCard`)

`grid-cols-[repeat(auto-fill,minmax(250px,1fr))]`, gap 12. **El `SaleCard` es el componente único** también usado por el layout mobile de la vista Lista (la tabla no cabe < lg → ambas vistas usan tarjetas).

```
#265 [Cashea]                     [PENDIENTE] [⋯]
Estefania Villaroel
V-8983210 · hace 17 d
SALDO PENDIENTE
USD 180,00              de USD 180,00
[▓▓▓▓▓░░░░░]  57% cobrado
[envío] [ítem libre]     (solo si existen)
```

- ⋯ arriba a la derecha (compensa su padding con margen negativo), pill de estado a su izquierda.
- Fila de flags **solo si existen** (sin espacio muerto).
- Toda la tarjeta clicable; la accesibilidad la garantiza el enlace del número de orden.
- **Cancelada:** fondo `#fbfafb`, hijos a 65 % de opacidad **excepto** la fila superior (pill + ⋯).

---

## 8. Estados de pantalla

- **Cargando (sin filas):** skeletons de filas (Lista) o tarjetas (Cuadros); **filtros y KPIs permanecen**.
- **Cargando (refetch):** contenido atenuado, sin spinner.
- **Vacío:** icono de recibo + «No se encontraron ventas» + «Prueba con otros filtros o límpialos.» + botón «Limpiar filtros»; sin ventas en absoluto: «Registra una venta para comenzar» (`stats.total === 0`).
- **VIEWER:** sin «Nueva venta», sin registrar pago/cambiar estado/cancelar; el menú ⋯ solo ofrece «Ver detalle».

---

## 9. Acciones rápidas: `?action=`

Contrato completo en `docs/specs/action-intent-param.md`. El listado **navega**; el detalle **ejecuta**:

1. Valores válidos `pay` | `status`; cualquier otro se ignora.
2. El detalle lo consume **una sola vez** cuando la venta ya está cargada y lo limpia con `replaceState` (recarga/atrás no reabren nada).
3. **Valida con los mismos guard que sus botones** y muestra toast si no aplica («Esta venta ya está pagada», «No tienes permisos…»). El servidor sigue validando de verdad.
4. `getBackUrl('/sales')` conserva filtros, vista y página al volver.

---

## 10. Permisos

| Acción                                        | ADMIN | MANAGER | SELLER         | VIEWER |
| --------------------------------------------- | ----- | ------- | -------------- | ------ |
| Ver / buscar / filtrar / cambiar vista        | ✅    | ✅      | ✅             | ✅     |
| «Nueva venta», registrar pago, cambiar estado | ✅    | ✅      | ✅             | ❌     |
| Cancelar venta                                | ✅    | ✅      | solo las suyas | ❌     |
| Guardar vista en el perfil                    | ✅    | ✅      | ✅             | ✅     |

---

## 11. Invariantes a respetar

1. **URL compatible**: params originales intactos; los nuevos son aditivos.
2. **`saleBalance` es el único cálculo de saldo** (`total − paidAmountBcvUsd`, ε 0.01, canceladas = no aplica).
3. **`paidAmountBcvUsd`** es la única fuente de «cobrado» (suma recalculada de pagos activos).
4. **`saleDate` = alias de `created_at`** (no existe columna `sale_date`).
5. **`perPage` consistente** entre server load y remote (default 10).
6. **Soft-delete** implícito (`deleted_at IS NULL`) en listado, conteos y agregados.
7. **Estados:** `PENDING → IN_PROGRESS → READY → COMPLETED` + `CANCELLED` (terminal); pagar completo no auto-completa.
8. **Cancelación** solo desde `PENDING` + ownership; el `CancelSaleModal` de 2 pasos no cambió.
9. **Orden por defecto** `orderNumber DESC`; con búsqueda, relevancia y luego `orderNumber DESC`; `balance` ordena desc con canceladas al final.
10. **`DataGrid` no se tocó** (sigue para otros módulos); la vista Lista de ventas usa su propia tabla.
11. **`?action=`** nunca queda en la URL y nunca se confía sin validar.

---

## 12. Desviaciones conocidas vs. mockup / deuda

- **SegmentedToggle** ganó variantes opcionales `variant: 'default' | 'light'` e `icon` (default = estilo navy original; no cambia a compras). La vista usa `light` (activo blanco con sombra).
- **Pill de estado**: usa `AppBadge` del kit (≈13.5 px/600/radius 6) en vez de 11 px/700/radius 4 del mockup — consistencia con el resto de la app.
- **Moneda:** `$` (`formatPrice`) en vez de «USD 180,00» (decisión del usuario).
- **Hover de fila:** token `surface-container-low` (`#f5f3f6`) en vez de `#f6f8fb`.
- **Sobrepago:** el warning ya existía y se reutilizó (`PaymentRailSection` → «El monto supera la deuda. Excedente: …», no bloquea; specs `PaymentRailSection.svelte.spec.ts`, `paymentFormValues.spec.ts`).
- **Menú ⋯ no ofrece «Cambiar estado» en COMPLETED** (spec §6.4); el detalle sí permite revertir a ADMIN (`SaleDetailHeader`), y `?action=status` valida igual.
- 🔴 **Sin verificación visual** (Playwright vs mockup) ni **pruebas de integración ejecutadas** en esta máquina: no hay Docker/Postgres disponibles. Los specs `queries/sales/list.int.spec.ts` y `queries/userPreferences.int.spec.ts` corren en CI (`pnpm test:integration`).
- 🟠 Deuda preexistente: `routes/(app)/sales/[id]/+page.svelte` (≈830 líneas) — plan `dt1-t2-sales`.

---

## 13. Mapa de archivos

| Rol                                   | Path                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Página (SSR load: 7 queries)          | `src/routes/(app)/sales/+page.server.ts`                                                                          |
| Página (estado, URL, filtros, vistas) | `src/routes/(app)/sales/+page.svelte`                                                                             |
| Cabecera + toggle de vista            | `src/lib/components/sales/SaleListHeader.svelte`                                                                  |
| KPIs                                  | `src/lib/components/sales/SaleKpiCards.svelte`                                                                    |
| Filtros nivel 1                       | `src/lib/components/sales/SaleFilterBar.svelte`                                                                   |
| Pestañas de estado (facetadas)        | `src/lib/components/sales/SaleStatusTabs.svelte`                                                                  |
| Chips + Limpiar(n)                    | `src/lib/components/sales/SaleFilterChips.svelte`                                                                 |
| Vista Lista                           | `src/lib/components/sales/SalesListView.svelte`                                                                   |
| Vista Cuadros                         | `src/lib/components/sales/SalesGridView.svelte`                                                                   |
| Tarjeta única (Cuadros + mobile)      | `src/lib/components/sales/SaleCard.svelte`                                                                        |
| Celda de saldo (3 estados)            | `src/lib/components/sales/SaleBalanceCell.svelte`                                                                 |
| Menú ⋯                                | `src/lib/components/sales/SaleRowMenu.svelte`                                                                     |
| Pie (mostrando/selección/paginación)  | `src/lib/components/sales/SaleListFooter.svelte`                                                                  |
| Cancelar (modal 2 pasos)              | `src/lib/components/sales/CancelSaleModal.svelte`                                                                 |
| Saldo puro (helper + specs)           | `src/lib/shared/saleBalance.ts`                                                                                   |
| Params de URL + orden + presets       | `src/lib/components/sales/listParams.ts`                                                                          |
| Fechas relativas / #orden             | `src/lib/components/sales/saleDisplay.ts`                                                                         |
| Toggle segmentado (extendido)         | `src/lib/components/ui/SegmentedToggle.svelte`                                                                    |
| Preferencias de usuario               | `src/lib/server/db/schema/userPreferences.ts`, `queries/userPreferences.ts`, `remote/users/preferences.remote.ts` |
| Queries del listado                   | `src/lib/server/db/queries/sales/{reads,shared,types}.ts`                                                         |
| Remotes                               | `src/lib/remote/sales/queries.remote.ts`                                                                          |
| Specs de DB                           | `src/lib/server/db/queries/sales/list.int.spec.ts`, `src/lib/server/db/queries/userPreferences.int.spec.ts`       |
| Migración                             | `drizzle/0048_unknown_shockwave.sql`                                                                              |
