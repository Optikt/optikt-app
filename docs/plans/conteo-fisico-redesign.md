# Plan maestro · Rediseño total del Conteo Físico (Optikt)

> **Documento de referencia permanente** para el rediseño del módulo `/inventory/count`.
> Todo lo decidido queda aquí; nada depende de memoria de sesión.
> Creado: 2026-11-06 · Estado: decisiones de producto cerradas, Fase 0 pendiente de ejecutar.

---

## 0. Documentos fuente (jerarquía de verdad: repo > prompt > mockup)

| Documento | Ubicación |
|---|---|
| **Prompt de implementación** (especificación total: 21 secciones) | `docs/specs/optikt-conteo-prompt-agente.md` (copia en repo) |
| **Mockup interactivo** (3 viewports: 1280×720, 1920×1080, 390×844) | `designs/optikt-conteo-mockup.html` (copia en repo; abrirlo en el navegador) |
| **Línea base del módulo actual** (audit con file:line, colores, tests) | `docs/specs/inventory-count-baseline.md` (en el repo) |

Originales en la máquina de Nanez: `/mnt/c/Users/victo/Downloads/optikt-conteo-prompt-agente.md` y `.../optikt-conteo-mockup.html`. Las copias del repo son la referencia canónica.

Reglas del prompt que mandan (sección 0 del prompt): los tokens/componentes del repo ganan sobre el mockup; el prompt gana sobre el mockup en comportamiento; si algo no está ni en prompt ni mockup → preguntar, no inventar.

Este plan **ya vive en el repo** (`docs/plans/conteo-fisico-redesign.md`); mantenerlo actualizado aquí como fuente única.

---

## 1. Decisiones de producto — CERRADAS (Nanez, 2026-11-06)

| # | Tema | Decisión |
|---|---|---|
| D1 | **Ítem nuevo nace verde** | SÍ. Ítem sin `lastCountedAt` con `createdAt` ≤ 75 % del plazo → verde con tooltip «Nuevo, aún no le toca»; después del margen → gris «nunca contado» (sección 8 del prompt). |
| D2 | **N de «más atrasados»** | **50 por defecto, configurable**. Tercer campo del drawer «Ajustes del ciclo» (junto a Plazo del ciclo y Umbral de diferencia). La tarjeta de Cobertura y la opción del drawer Nuevo conteo leen siempre ese valor (así luego se cambia a 25, 100…). |
| D3 | **Umbral en USD** | **Se incluye desde Fase 1**, con **valor por defecto 0 = desactivado** (el comportamiento de arranque es idéntico al mockup: solo unidades). Regla: diferencia «grave» si `\|d\| ≥ umbralUnidades` **O** `\|d × costo\| ≥ umbralUSD` cuando esté activo. El costo (FIFO) ya se usa para «Impacto est.», así que no agrega datos nuevos, solo el campo de settings + la comparación. |
| D4 | **Permisos de ajuste de lentes** | Alinear a **ADMIN + MANAGER** (hoy `/lenses/[id]/adjustments` es solo ADMIN y redirige a MANAGER). Muere el dead-end; coherente con "MANAGER puede ajustar" dentro de la sesión. |
| D5 | **SELLER crea conteos** | SÍ, se mantiene como hoy. SELLER no asignado responsable → **solo lectura** (matriz de roles, sección 16 del prompt). |
| D6 | **Hoja de conteo imprimible** | SÍ, entra en **Fase 6** (con exportes del informe). Decide formato concretado en esa fase (por marca, columna de conteo en blanco; con/sin stock sistema — opciones a confirmar al llegar). |

Consecuencias derivadas: el 75 % del semáforo queda **constante** (no configurable) salvo indicación futura; «Último ciclo completo» se calcula según propuesta del prompt (17.5): fecha del primer cierre donde el 100 % de los ítems elegibles quedó verificado dentro del plazo.

---

## 2. Sección 17 del prompt — respuestas ya verificadas contra el código (2026-11-06)

| # | Pregunta | Respuesta verificada |
|---|---|---|
| 17.1 | ¿`createdAt` en productos y lentes? | ✅ `products.ts:59` y `lenses.ts` (lens_catalog_items) lo tienen. Regla D1 viable. |
| 17.2 | Costo por ítem | La pantalla de ajuste usa `lot.unitPurchasePrice` (FIFO del lote). **Impacto est. = costo FIFO**, coherente con Ajustar. Orden de Revisar: `\|dif × costo\|` desc. |
| 17.3 | Constantes | 75 % fijo; N = **configurable** (D2). |
| 17.4 | Umbral USD | Resuelto (D3): se incluye, default 0. |
| 17.6 | Motivos de ajuste | ✅ `AdjustmentReason` en `src/lib/shared/enums/inventoryTypes.ts:73`: `PHYSICAL_COUNT`, `DAMAGE`, `SAMPLE`, `CUSTOMER_RETURN`, `ENTRY_ERROR`, `OTHER` ("Otro"). «Otros» = `OTHER` + texto libre obligatorio en `notes`. `LOSS_REASONS` y `ADJUSTMENT_REPORT_CATEGORIES` ya existen para impacto/pérdida. |
| 17.9 | `DataGrid` / virtualización | `DataGrid` NO soporta ventaneo ni cursor de teclado → hoja de conteo = **componente nuevo** (`CountSheet`/`CountRow`, sección 11.3). `SearchCombobox` es de valor único pero tiene hooks (`.getId`, `.getLabel`, `.filterFn`, `.onquerychange`, `.children`) → modo multiselección **aditivo** viable (11.2). |
| 17.12 | Exportar | **Sin dependencias nuevas**: `export-to-csv` ya está (`src/lib/utils/csv.ts`) → Excel/CSV; PDF vía `puppeteer-core` ya usado por `/api/pdf/quote/[id]` y `/api/pdf/sale/[id]`; impresión con `window.print()` + `@media print` (ya existe base en `layout.css`). |
| 17.16 | ¿Lentes con proveedor? | ✅ `lens_catalog_items.supplier_id` NOT NULL (`lenses.ts:108`) → filtro por proveedor para lentes abierto sin trabajo extra. |
| 12.2 | Settings | ✅ Tabla `settings` **singleton**, ya cargada en cada request del layout → lugar natural para `cycleDays` (30), `diffThresholdUnits` (2), `diffThresholdUsd` (0, D3), `quickOldestLimit` (50, D2). |
| 17.17 | URL state | `$page.url` + `replaceState` es compatible: el layout usa `{#key page.url.pathname}` (no re-render con search params) y scroll restore usa pathname. Verificar en Fase 0 de todas formas. |

Pendientes de resolver **durante** el trabajo (no bloquean): 17.5 formato exacto de «ciclo completo», 17.10 propuesta mínima de concurrencia (last-write-wins + `countedByName` visible; sin websockets), 17.14 detalle del historial de responsables.

---

## 3. Plan de fases (sección 15 del prompt; una por una, en este orden)

> Regla: cerrar cada fase con `pnpm lint && pnpm test` en verde + resumen de qué se hizo, qué difiere del mockup y qué dudas quedaron. Nanez envía capturas y prompt de corrección antes de avanzar.

### Fase 0 · Verificación (sin código de producto) ← **SIGUIENTE PASO**
- Completar respuestas de la sección 17 (doc en conversación ya cubre casi todo).
- Inventariar el kit completo con su API real: `PageHeader`, `SlideOver` (focus trap?), `SegmentedToggle`, `DataGrid`, `ConfirmModal`, `WizardHeader`, `EmptyState`, `InfoTooltip`/`TriggerTooltip` (variantes: título+cuerpo, portal/flip, foco, sobre `aria-disabled`), `SearchCombobox`, `Badge*`, `FormInput`/`FormDatepicker`.
- Confirmar: acceso a `settings` y su lectura global; estructura de `inventory_movements` para vincular (`adjustmentMovementId`);
- **Aceptación:** documento breve de hallazgos + propuesta de ajustes → **Nanez aprueba antes de Fase 1.**

### Fase 1 · Datos y servidor
- Migraciones + backfill: cobertura por ítem (`lastCountedAt` + `lastCountSessionId` en `products`/`lens_catalog_items`, fijados en la tx de `applySession`), responsables de sesión (tabla de participantes con baja lógica), recuento (`recountStock`, `recountedById/At`), `adjustmentMovementId` en líneas de conteo, settings del ciclo (D2, D3).
- Nueva regla de cierre (sección 3 del prompt: cierra con stock 0 sin confirmar, bloquea recuentos pendientes).
- `applyLineAdjustment` / `applyAdjustmentsBatch` reutilizando la lógica de ajuste manual existente (12.6) y vinculando el movimiento.
- Alcance estructurado con retrocompatibilidad (`ALL`, `PRODUCT_CATEGORY`, `LENS` también: `BRAND`, `SUPPLIER`, `TYPE`, `QUICK_OLDEST`, `QUICK_NEVER`).
- `previewScope`; `upsertCountLine` ligero (solo la línea); informe agregado por dimensión.
- **Aceptación:** migración limpia con backfill verificable; tests de integración: regla de cierre, `lastCountedAt` solo verificados, acceso por participante/rol, ajuste vincula movimiento, agregados por marca/proveedor/tipo, compatibilidad sesiones antiguas.

### Fase 2 · Cobertura + Nuevo conteo + Ajustes del ciclo
- Pestañas Cobertura|Historial, tarjeta de ciclo + `CoverageBar`, atajos (D2), tabla por dimensión con selección, barra de selección fija, Historial, drawer Nuevo conteo (combobox multiselección, responsables + externos, vista previa viva), drawer Ajustes del ciclo (3 campos: plazo/umbral unidades/umbral USD desactivado por defecto/N configurable).
- **Aceptación:** 1280×720 muestra ciclo + atajos + ≥4 filas sin scroll de página extra; seleccionar 2 marcas → «Contar selección» abre el panel con todo cargado; atajos no aparecen bajo Marca/Proveedor/Tipo; no se inicia sin ítems o sin responsables (tooltip con causa); URL state.

### Fase 3 · Sesión: Contar (escritorio)
- Cabecera navy con barras diagonales, stepper, franja de resumen ≤ ~130 px, toolbar, hoja agrupada por marca con cabeceras sticky, cursor de teclado (↑↓/Enter/Esc/`/`), grupo «Stock 0» colapsado + «Confirmar los N en 0», filtros con «Stock 0», columna derecha ≥1600, virtualización, guardado por línea con rollback.
- **Aceptación:** contar 20 ítems solo con teclado; en 1280×720 se ven ≥9 filas; no hay scroll anidado; con 2.000 ítems el scroll es fluido; Esc revierte; «Confirmar los N en 0» no bloquea el cierre.

### Fase 4 · Sesión: teléfono (390×844)
- Ficha (20/56/36 px), toggle Ficha|Lista, tarjetas de Cobertura, drawer a pantalla completa, objetivos ≥44 px, `inputmode="numeric"` + `enterkeyhint="next"`.
- **Aceptación:** contar un ítem con teclado numérico + «Guardar y siguiente» en un gesto; paridad reglas/datos con escritorio.

### Fase 5 · Revisar, recuento, ajuste y cierre
- Lista por impacto, selector de motivo en lote, «Aplicar todo (N)» (solo bajo ambos umbrales, D3), recuento obrigatorio sobre umbral, drawer «Ajustar stock» (repo reasons + Otros con texto), regla de cierre, cancelación.
- **Aceptación:** no se cierra con recuentos pendientes; ajustes crean `inventory_movement` vinculado a la línea; SELLER ve CTAs `aria-disabled` con tooltip «Solo ADMIN o MANAGER».

### Fase 6 · Informe, Historial, impresión y exportes
- KPIs, cobertura antes→después, «Qué se movió» por marca/proveedor/tipo, detalle de diferencias, sesión cancelada (informe mínimo), Imprimir (sin shell), PDF (impresión del navegador preferido o patrón puppeteer), Excel (export-to-csv, BOM UTF-8), hoja de conteo imprimible (D6).
- **Aceptación:** informe de cualquier sesión del Historial es estable; desglose = totales; impresión limpia sin shell; exportes correctos.

### Fase 7 · Responsables, permisos y pulido
- Edición de responsables en sesión activa (pila de avatares → drawer), matriz de roles completa (sección 16), recorrido de teclado/a11y, ajuste fino visual en los 3 viewports, concurrencia mínima (17.10), pasada final de tooltips.
- **Aceptación:** matriz de roles probada; SELLER asignado cuenta pero no revisa/cierra; no asignado solo lee; ningún enlace muerto en redirect al dashboard; a11y sin hallazgos críticos; Nanez aprueba con capturas.

---

## 4. Qué NO se toca (secciones 2 y 20 del prompt)

Shell (navbar/sidebar/layout), ítem del sidebar + icono dinámico, productos/lentes/ventas/compras/caja, tokens del repo (no crear colores), y la **lógica de ajuste manual** (lotes FIFO, confirmación por pérdida) que se **reutiliza**.

## 5. Invariantes que se mantienen

1. Una única sesión `OPEN` (índice único parcial + guard).
2. Snapshot inmutable: `difference = contado final − systemStock`; nunca stock vivo.
3. **El conteo nunca ajusta stock**; solo acción explícita (individual o «Aplicar todo»).
4. Cambiar un conteo invalida recuento y ajuste hechos de esa línea.
5. Motivo de cancelación 5–500; notas sesión ≤500, línea ≤240; conteo entero ≥0.
6. Rollback optimista con toast de error.
7. Guard de rol en cada `load` **y** en cada remote function.
8. Tests existentes se actualizan donde cambie la regla; ninguno se borra sin reemplazo.

## 6. Reglas de trabajo (recordatorios duros)

- Runes de Svelte 5, TypeScript obligatorio, Tailwind v4 con tokens (`@theme` en `src/routes/layout.css`): nada nuevo de color; radios 4/8/12; sin gradientes/bordes ≥2px/rebotes.
- Sin dependencias nuevas ni barrels; iconos `@lucide/svelte` explícitos; toasts `svelte-sonner`; tooltips **propios** (InfoTooltip/TriggerTooltip ampliados, portal + título+cuerpo + foco + flip), **nunca `title`**.
- Carga inicial en `+page.server.ts`; el resto remote functions; nunca `$effect`/`onMount` para datos iniciales.
- Piso tipográfico (px efectivos con `html{font-size:18px}`): h1 24 · cifra ciclo 40 · KPIs 26 · cuerpo 15 (16 móvil) · input conteo 16/700 · etiquetas uppercase 12/700 `on-surface-variant` (nunca `outline` para texto) · tooltips 13. Nada más pequeño.
- `prefers-reduced-motion` → todo a 0 ms. `tabular-nums` en todo número.
- Reemplazos del módulo actual (11.4): `CountListHeader`, `CountListMetrics`, `CountHistoryTable`, `CountCreateModal`, `CountSessionHeader`, `CountSummaryMetrics`, `CountLinesTable`, `CountLineMobileCard`, `CountLineEditRow`, `CountActionModals`; helpers `countSummary.ts` / `countList.ts` / `countAdjustments.ts` se adaptan con sus specs.

## 7. Pruebas (sección 18 del prompt)

- **Unit (Vitest):** semáforo, clasificación de diferencia (con umbrales unidades+USD), verificado %, mediana de antigüedad, regla de cierre, `previewScope`, helpers de alcance, formateo, «Otros».
- **Integración (Testcontainers):** `applySession` nueva regla; `lastCountedAt`; participantes; alta/baja responsables; ajuste individual y en lote con movimiento vinculado y permisos; `upsertCountLine` ligero; agregados por dimensión; backfill; compatibilidad.
- **Componentes:** combobox multiselección (teclado, Backspace, externo), `CountRow` (Enter → siguiente pendiente, Esc revierte), `CoverageBar`, tooltips con foco.
- **E2E (Playwright):** conteo por 2 marcas + externo → teclado → recuento → ajuste con «Otros» → cerrar → informe + desglose → desde Historial; flujo 390×844; matriz de roles; cancelar con motivo. Actualizar `e2e/inventory-count.test.ts` y specs existentes.
- **Definición de terminado (sección 21):** cómodo en 1280×720, bien en 1920×1080, usable con pulgar en 390×844; cobertura/ciclo responde «cuándo se contó y qué falta»; conteo de 674 ítems = tarea de teclado o pulgar; informe por marca/proveedor al cerrar; responsables visibles y editables; tokens/componentes del repo en todo; a11y verificada; tests en verde; Nanez aprueba con capturas.

## 8. Puntos de control con Nanez

1. **Aprobación del documento de Fase 0** antes de tocar código.
2. Capturas + prompt de corrección al cierre de cada fase.
3. Micro-diferencias prompt↔mockup ya detectadas (se resuelven por el prompt): «Aplicar todo» del mockup ajusta también líneas recontadas que N no contea; la regla «ítem nuevo» no está dibujada en el mockup; «Último ciclo completo» es inventado en el mockup.
