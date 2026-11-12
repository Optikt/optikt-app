# Full Prompt — Rediseño de la vista "Detalle de Venta" (Optikt)

> **Propósito de este documento:** darle a un agente todo el contexto funcional y visual de la página de detalle de una venta (`/sales/[id]`) para que pueda **rediseñarla**. Describe qué se muestra, qué datos existen, qué se resalta, qué acciones hay, sus reglas de permisos/estados y qué queda fuera de alcance.
>
> **Fuente de verdad:** `src/routes/(app)/sales/[id]/+page.svelte` + `+page.server.ts` y los componentes en `src/lib/components/sales/**`. Todo lo descrito aquí existe en el código hoy.

---

## 0. Contexto de producto (importante para decisiones de diseño)

- **Optikt** es un sistema de gestión para una **óptica en Venezuela**: vende monturas, cristales (lentes) con prescripción, tratamientos y "ítems libres" (Servicios, Accesorios dentro de un pack).
- **Moneda referencial: USD.** Todos los precios de venta se expresan en `$` (formato `formatPrice`, locale `es-VE`, ej. `$1.234,50`). Los clientes mezclan métodos de pago en Bs (bolívares a la **tasa BCV**), USD efectivo, EUR, USDT (Binance) y PayPal. **Cada abono registra la tasa usada** (_rate freeze_: la tasa queda congelada en el momento del pago).
- **IVA incluido en el precio (_tax-inclusive_):** el precio de venta YA incluye IVA (tasa snapshot de la venta, típicamente 16%). La vista lo **descompone** para mostrar `base + IVA`.
- **Canal Cashea:** una venta puede marcarse como `isCashea` (compra a cuotas vía Cashea). Se muestra con un isotipo como badge.
- **Usuarios:** roles `ADMIN`, `MANAGER` (ven todo), `SELLER` (gestiona solo sus propias ventas), `VIEWER` (solo lectura). La UI condiciona acciones por esto.

---

## 1. Qué es la página y qué datos carga

**Ruta:** `/sales/[id]` — se llega desde la lista de ventas (`/sales`). Botón "Volver a Ventas" arriba a la izquierda (usa `getBackUrl('/sales')`).

**Carga inicial** (`+page.server.ts`, en paralelo):

| Dato                              | Origen                                         | Usado para                                                                                                      |
| --------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `sale` (`SaleWithRelations`)      | `findSaleByIdWithRelations`                    | Todo; incluye `customer` (nombre, cédula, teléfono, fecha de nacimiento), `seller`, `cancelledBy`, `refundedBy` |
| `items` (`SaleItemWithDetails[]`) | `getSaleItemsWithDetails`                      | Tabla de artículos con snapshots y RX embebidos                                                                 |
| `payments`                        | `getSalePayments(id, { includeVoided: true })` | Lista de abonos (ojo: **incluye pagos voidados**, la lista los muestra tal cual)                                |
| `movements`                       | `getMovementsWithDetails(referenceType: SALE)` | Modal de movimientos de stock                                                                                   |
| `suppliers`                       | `getAllSuppliers`                              | Selectores de proveedor (costos ítems libres)                                                                   |
| `allTreatments`                   | `getAllTreatments`                             | Solo para el editor de venta                                                                                    |
| `auditHistory`                    | `getEntityHistory('sale', id)`                 | Timeline + drawer de historial                                                                                  |
| `prescription`                    | `getSalePrescription`                          | Solo para el editor de venta (no se muestra en la vista)                                                        |

`sale` además trae: `saleDate` (alias de `createdAt` — la fecha de venta es la fecha de creación, single date truth), `orderNumber`, `status`, `subtotal`, `discount`, `discountType`, `total`, `snapshotTaxRate`, `paidAmountBcvUsd`, `isCashea`, `notes`, `refundStatus`, `refundAmount`, `refundNotes`, `cancellationReason`, `cancelledAt`, `updatedAt`.

Título de la pestaña: `Venta #0004 — Nombre del cliente — Optikt`.

**Layout general:** contenedor `max-w-7xl`, fondo `bg-surface`. Grid de **2 columnas en desktop (3/5 – 2/5)**:

- Izquierda: tarjeta cliente + tabla de artículos.
- Derecha (sticky al hacer scroll): resumen financiero + abonos + historial + tarjeta de reembolso + link a movimientos + "última actualización".

---

## 2. Secciones visibles, de arriba hacia abajo

### 2.1 Header de la página (`SaleDetailHeader`)

Barra-tarjeta con dos filas:

- **Fila 1 (arriba de la tarjeta):** botón link "← Volver a Ventas".
- **Fila 2 (la tarjeta):**
  - **Izquierda:** overline "DETALLE DE VENTA" + H1 `Venta #0004` (orderNumber padded a 4 dígitos) + badge isotipo Cashea si `isCashea`.
  - **Derecha (acciones, con gating):**
    - **Impresión** — solo si la venta NO está cancelada y tiene estado `PENDING/IN_PROGRESS/READY/COMPLETED`:
      - `Ver Recibo` — abre modal de vista previa PDF (`/api/pdf/sale/[id]`).
      - `Imprimir PDF` — abre el PDF en pestaña nueva. Antes, si hay riesgo de que el recibo exceda media carta (muchos ítems/pagos → `hasHalfLetterReceiptOverflowRisk`), muestra un toast de advertencia.
      - `Imprimir Tickera` — imprime en la tickera (impresora térmica de recibos) vía remote `printTickeraReceipt`; botón queda disabled con "Imprimiendo..." mientras corre.
    - `Cambiar Estado` (botón primario azul) — si `canManageSale`, no cancelada y estado en PENDING/IN_PROGRESS/READY (o COMPLETED siendo ADMIN/MANAGER).
    - `Editar` (botón bordeado tono info) — `canManageSale` y estado PENDING/IN_PROGRESS/READY. **Abre el editor lateral (`EditSaleModal`) — NO está en alcance de este rediseño: se rediseñó hace poco y se conserva tal cual**; solo se mantiene el punto de entrada.
    - `Cancelar` (botón bordeado rojo, separado con una línea vertical) — `canManageSale` y estado PENDING/IN_PROGRESS/READY.

**Semántica de `canManageSale` (`canManageSaleByOwner`):** ADMIN/MANAGER → siempre; SELLER → solo si es el vendedor de la venta; VIEWER → nunca. `canAct` (cualquier rol menos VIEWER) gobierna el botón de cobrar y la edición/anotación de costos e ítems libres.

### 2.2 Zona de avisos / notices (`SaleDetailNotices`)

Grid de tarjetas condicionales entre el header y el grid principal:

1. **Observaciones** — aparece si la venta tiene `notes` (texto libre de la venta). Ícono de documento, fondo blanco.
2. **Estado de cancelación** — solo si `status === CANCELLED`. Tarjeta color-coded según `refundStatus`:
   - `REFUNDED` → rojo, título "Reembolso emitido"
   - `RETAINED` → ámbar, título "Depósito retenido"
   - otro con pagos → gris, "Sin pagos previos"
     Contiene: motivo de cancelación (o "Sin motivo registrado"), fecha-hora de cancelación, quién la canceló, y un bloque interno "Resolución financiera" con el monto reembolsado en mono grande + notas del reembolso. Si `refundStatus === NO_PAYMENT`: "Sin pagos previos, no aplica reembolso."
3. **Aviso de ítems libres pendientes** — banda ámbar si hay FREE_ITEMs con `enrichmentStatus === PENDING`: "⚠ N ítems libres pendientes de completar."

### 2.3 Tarjeta de datos generales (`SaleDetailCustomerCard`)

Tarjeta blanca con grid de 2 columnas × 3 filas:

| Campo           | Muestra                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cliente**     | Nombre completo + cédula (`RIF/Cédula no registrada` como fallback) + teléfono (solo si hay customer) + edad calculada (`birthDate`, "N años")                                                                                 |
| **Ver cliente** | Link con icono a `/customers/[id]` (solo si hay customer asociado)                                                                                                                                                             |
| **Vendedor**    | `seller.fullName` o "Sin asignar"                                                                                                                                                                                              |
| **N° Orden**    | `#0004`                                                                                                                                                                                                                        |
| **Fecha**       | `saleDate` (solo fecha, es-VE)                                                                                                                                                                                                 |
| **Estado**      | Badge de estado con colores canónicos: Pendiente=warning, En Progreso=info, Lista para Retirar=purple, Completada=success, Cancelada=error. (IN_PROGRESS se renderiza con un span manual azul; el resto con `SaleStatusBadge`) |

### 2.4 Tabla de artículos y servicios (`SaleItemsTable`) — el corazón de la vista

Sección con header "Artículos y servicios" + contador de grupos ("N items").

**Agrupación de ítems:** los ítems se agrupan en `DisplayGroup`: un ítem principal (LENS_PAIR, PRODUCT, FREE_ITEM) con sus **tratamientos como subfilas** anidadas (items `TREATMENT` con `parentSaleItemId`).

**Columnas:** `Producto | Cant. | Precio | Total`.

**Fila principal — izquierda:**

- **Icono categorizado:** 👁 Eye (cristal, ámbar), ✨ Sparkles (ítem libre, gris), 📦 Package (montura/producto, índigo).
- **Nombre principal + badge de tipo:** `CRISTAL` (ámbar), `ÍTEM LIBRE` (gris), `MONTURA` (índigo). Debajo, la línea de detalles: segunda parte del nombre separada por `·`, o el SKU.
- **Descuento por ítem** si existe: `- $X (Y%)` en rojo.
- **Bloque de ítem libre (`FREE_ITEM`) según estado de enriquecimiento:**
  - `PENDING`: caja ámbar "⚠ Pendiente de completar — Costo y proveedor no registrados aún" + botón `Completar ítem →` (si `canAct`). Abre `EnrichItemModal`.
  - `ENRICHED`: "✓ Completado" + costo unitario + **margen calculado inline** (`((precio−costo)/costo)*100%`), proveedor, notas ópticas. Botón `Editar` (re-enriquecer, con confirmación).
- **Bloque de costos internos del cristal (LENS_PAIR):** línea con `Cristales: $X`, `Montaje: $Y` (si >0), `Envío: $Z` (si >0) o badge pill ámbar `🚚 Envío pendiente` (`shippingCostPending`), y `Total: $C` en mono navy. Botón lápiz para editar (si `canAct`) → formulario inline (`CostEditForm`) con base/montaje/envío/checkbox "envío pendiente" → remote `updateItemCosts`.
  - Si el cristal no tiene costos: "Sin costos registrados" + botón `Agregar` (mismo form).

**Prescripción (RX) colapsable (`LensRxPanel`):** si el ítem es cristal y tiene snapshot de prescripción, la fila es expandible (chevron, animación de altura, accesible con teclado Enter/Espacio). El panel desplegado muestra la tabla óptica:

```
        ESF    CIL    EJE    ADD    DIP
● OD    -1.25  -0.50  170    +2.00  —
● OI    -1.75  —      015    +2.00  —
```

(mono, OD punto azul / OI punto rojo; valores vacíos como `—`; Alt. de montaje OD/OI aparecen como "—" hoy — están maquetados pero sin datos.)

**Subfilas de tratamiento (`TreatmentSubRow`):** ítem de tratamiento con ícono 🧪 morado, badge "TRATAMIENTO", categoría (label del enum), cant., precio y total de línea.

**Footer de la tabla (`ItemsTableFooter`):**

- `Costo interno total` (suma de costos de todos los grupos, solo si hay algún costo) — dato para el negocio, no lo ve el cliente.
- `Subtotal general`, luego `Descuento (monto o %)` en rojo (si >0) y `Total`.

> Nota: este footer repite Subtotal/Descuento/Total que también muestra el resumen financiero de la derecha — es info duplicada a consolidar en el rediseño.

### 2.5 Resumen financiero (`SaleDetailSummary`) — columna derecha, sticky

Tarjeta pegajosa (`lg:sticky lg:top-6`):

- **Desglose fiscal (descompuesto del precio tax-inclusive):**
  - `Subtotal` — monto pre-impuesto.
  - `Descuento ($X o %)` en rojo — **descuento global de la venta** (solo si > $0.01).
  - `IVA (16%)` — monto del impuesto (calculado client-side con `computeTaxBreakdown` respetando exenciones por ítem `snapshotIsTaxable`).
  - `Total` (bold).
- **Saldo Pendiente** (si queda > $0.01): monto gigante en ámbar/negrita + **barra de progreso de pago** + "X cubierto / Y%".
  Si está 100% pagada: texto gigante verde **"Pagado"**.
- **Botón `Cobrar / Registrar Pago`** (full width, azul) — visible si `canAct && !cancelada && saldo > 0.01`. Abre el drawer de pagos (`SalePaymentDrawer`).

Normalización de dinero: `paidAmountBcvUsd` es el total abonado normalizado a USD-BCV; `remainingBcvUsd = max(0, total − paidAmountBcvUsd)`; progreso = `paid/total*100` (cap 100%).

### 2.6 Abonos Registrados (`SaleDetailPayments`)

Lista scrolleable bajo el resumen. Cada abono en tarjeta:

- **Línea 1:** fecha + método (label humanizado) + referencia si la tiene | monto en `$` (BCV normalizado, bold).
- **Línea 2 según el método:**
  - Métodos en Bs (Pago móvil, Transferencia, POS, Efectivo Bs): `Tasa BCV: NN.NN` | `Bs. X` (monto original en bolívares).
  - Binance USDT: `Tasa USDT: NN.NN` | `USDT X`.
  - Otros (USD cash etc.): `Efectivo $ • Tasa BCV: NN.NN` | `Bs. X` (equivale Bs).
- **Estado vacío:** "Aún no hay abonos registrados" (itálica centrada).
- ⚠ Hoy el loader incluye pagos **voidados** y la lista los muestra igual — detalle a revisar en el rediseño.

### 2.7 Historial de Auditoría (`SaleAuditTimeline` + drawer `SaleAuditHistoryDrawer`)

Bajo los abonos, tarjeta "HISTORIAL" con contadores y link "Ver historial":

- Timeline registrada (`auditHistory` clasificado por `classifySaleAuditEntry`): eventos de la venta: `Venta creada`, `Estado: Completada`, `Cliente actualizado`, `Vendedor actualizado`, `Venta actualizada`. Puntos de color: crear=navy, estado=azul, resto=gris. Cada evento muestra label + quién + fecha (formato corto).
- Muestra los **4 primeros eventos** de la lista (ordenada del historial); si no hay ninguno, muestra el bloque "Creada por [vendedor] — fecha".
- El botón "Ver historial" abre un **drawer lateral (`SlideOver`)** con la timeline completa vertical (título "Historial de cambios", N eventos).
- Dato clave derivado: `saleLoadedAt` = `createdAt` del evento audit "create" de la venta (si existe), usado como fecha de creación honesta.

### 2.8 Tarjeta de Reembolso (venta cancelada, columna derecha)

Si `isCancelled && refundStatus !== NO_PAYMENT`: tarjeta con título `refundDecisionTitle(refundStatus)` ("Reembolso emitido" / "Depósito retenido" / "Sin pagos previos") + monto `refundAmount` grande en mono. **Nota: esta info está duplicada** (también en la tarjeta de estado de cancelación de notices).

### 2.9 Movimientos de Stock (modal)

Botón link "📋 Ver movimientos de stock (N)" al fondo de la columna derecha. Abre modal centrado con la lista de `movements` de inventario ligados a la venta:

- Cada movimiento: icono círculo − (rojo, salida: SALE_OUT / ADJUSTMENT_OUT) o + (verde, entrada: CANCEL_REVERT reversión, RETURN_IN, ADJUSTMENT_IN, PURCHASE_IN).
- Título con label humanizado ("Salida por Venta", "Reversión por Cancelación"...), delta de cantidad coloreado, nombre del ítem, fecha y usuario.
- Estado vacío: "No hay movimientos de stock registrados".

### 2.10 Footer de página

Texto alineado a la derecha, itálica: "Última actualización en la venta [fecha-hora]" (`sale.updatedAt`).

---

## 3. Máquina de estados y gating (invariantes que el rediseño debe respetar)

**Estados de venta:** `PENDING → IN_PROGRESS → READY → COMPLETED` (+ `CANCELLED`). Labels: "Pendiente", "En Progreso", "Lista para Retirar", "Completada", "Cancelada".

- **`Cambiar Estado`** ofrece SOLO los targets siguientes (`nextStatusTargets`): PENDING → [IN_PROGRESS, READY, COMPLETED]; IN_PROGRESS → [READY, COMPLETED]; READY → [COMPLETED]; COMPLETED/CANCELLED → sin targets.
- **Al registrar un pago que deja la venta 100% pagada** (`paidAmountBcvUsd >= total - 0.01`) y estaba en PENDING/IN_PROGRESS/READY: se abre automáticamente el modal de cambio estado pre-cargado con los targets siguientes — empujando el flujo "pago completado → siguiente estado".
- **Impresión habilitada** solo si NO cancelada (y estado vigente).
- **Editar** solo en PENDING/IN_PROGRESS/READY (el botón abre el sidebar existente, fuera de alcance).
- **Cancelar** solo en PENDING/IN_PROGRESS/READY.
- **Cobrar** solo si hay saldo y no está cancelada.

**Roles:** VIEWER solo ve (sin botones operativos ni formularios de costos). SELLER ve los botones solo en sus ventas. ADMIN/MANAGER ven todo y además pueden cambiar estado de una venta COMPLETED.

**Después de cualquier acción exitosa** (pago, cancelación, edición, cambio de estado, costos): `invalidateAll()` + re-sincroniza estado local desde `data` (la página está toda en `$state` derivada del dato inicial via `untrack`).

---

## 4. Modelos / overlays disparados desde esta página

| Overlay                                                                       | Abre desde                                 | Qué hace                                                                                                           | ¿En alcance del rediseño?                          |
| ----------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| **`EditSaleModal`** (sidebar lateral)                                         | Botón "Editar"                             | Editor completo de la venta — **rediseñado hace poco; NO modificar, solo mencionar**                               | ❌ FUERA de alcance                                |
| `SalePaymentDrawer` (SlideOver)                                               | Botón "Cobrar / Registrar Pago"            | Formulario de pago multi-moneda (payment form, rail por moneda, tasa BCV live del store), reset por drawerResetKey | Contexto puntual: se puede re-mencionar como flujo |
| `CancelSaleModal` (2 pasos: motivo + decisión de reembolso, con confirmación) | Botón "Cancelar"                           | Sugerencias de motivo, elige REFUNDED/RETAINED/NO_PAYMENT con notas                                                | Solo como acción de entrada                        |
| `SaleStatusModal` (ConfirmModal)                                              | "Cambiar Estado" o auto tras pago completo | Lista targets con descripciones y validación de orden de flujo                                                     | —                                                  |
| `EnrichItemModal`                                                             | "Completar ítem" de un FREE_ITEM           | Pide costo real, proveedor, notas ópticas; re-enriquecimiento con paso de confirmación                             | —                                                  |
| `SaleMovementsModal`                                                          | Link de movimientos                        | Historial de inventario de la venta                                                                                | —                                                  |
| `SaleAuditHistoryDrawer` (SlideOver)                                          | "Ver historial"                            | Timeline completa de cambios                                                                                       | —                                                  |
| `PDFViewerModal`                                                              | "Ver Recibo"                               | Vista previa + descarga del PDF del recibo (`/api/pdf/sale/[id]`)                                                  | —                                                  |

---

## 5. Lo que hoy se "resalta" (intenciones actuales del diseño)

1. **El estado de la venta** va sobre todo: `H1`, badge en la tarjeta, audit y cambios bloqueados/desbloqueados.
2. **El saldo pendiente / pagado:** el número más grande de la página es `Saldo Pendiente` o `Pagado`; la barra de progreso de cobertura está al lado.
3. **El RX (prescripción)** es lo técnico por excelencia — colapsable tipo acordeón con tabla óptica ESTÁNDAR de óptica (ESF/CIL/EJE/ADD por ojo OD/OI).
4. **Costos internos / margen** — visibilidad de negocio (no para el cliente): costos de cristal, costo interno total, margen del ítem libre.
5. **Ítems libres pendientes** de completar se empujan agresivamente (banda ámbar arriba + botón dentro de la fila del ítem).
6. **Cancelaciones y reembolsos** con semántica financiera explícita (color por decisión: reembolsado / retenido / no aplica).
7. **Trazabilidad:** quién creó, quién canceló, historial de cambios, movimientos de stock — todo alcanzable desde esta vista.

---

## 6. Datos que están disponibles hoy pero NO se muestran (oportunidades)

- `prescription` (prescripción a nivel venta, con DP/NP / monturas) — cargada, se usa solo en el editor.
- `sale.refundedBy` — quién emitió el reembolso (no se muestra en la UI, solo `cancelledBy`).
- Balance/detalle por ítem de costo interno vs. margen global de la venta — solo pieza a pieza.
- Desglose de pagos por método/rail a nivel venta — solo existe en la lista individual de abonos.
- No hay un bloque con equivalencia en Bs de los montos clave (total, saldo) a la tasa actual — solo los abonos en Bs muestran su equivalencia con la tasa congelada.

---

## 7. Detalles de estilo / sistema de diseño actual (para mantener la coherencia)

- Sistema de tokens: `bg-surface`, `surface-container-*`, `outline-variant`, `brand-blue/brand-navy/brand-gold`, radios `--ds-radius-*` (`rounded-xl` ≈ 16, `rounded-2xl` ≈ 24), sombra `--ds-shadow-md`.
- Tipografía: números/tasas/IDs en mono (`font-mono`) con `tabular-nums`; overlines en mayúsculas con tracking (`tracking-widest text-on-surface-variant uppercase`).
- Colores de monto: azul/ámbar para pendiente (por cobrar), verde para resuelto, rojo para descuentos/cancelación/reembolso, ámbar para avisos/pendientes.
- Iconos `@lucide/svelte` explícitos (Eye, Package, Sparkles, FlaskConical, Printer, ReceiptText, FileText, Pen, Play, CircleX, History, ClipboardList, Plus/Minus...)
- Modos de formulario: modales clásicos y `SlideOver` (drawer lateral). Toasts de éxito/error con `svelte-sonner`.
- El diseño debe seguir las instrucciones de `design-ui.instructions.md` (grid 4px, consistencia con el sistema actual, transiciones de 150–250ms, color solo con significado).

---

## 8. Frases/labels canónicos (para NO inventar copy nuevo)

- `Detalle de venta` · `Venta #0004` · `Volver a Ventas`
- `Ver Recibo` · `Imprimir PDF` · `Imprimir Tickera` · `Cambiar Estado` · `Editar` · `Cancelar`
- `Cliente` · `Vendedor` · `N° Orden` · `Fecha` · `Estado` · `Ver cliente`
- `Artículos y servicios` · `Producto / Cant. / Precio / Total` · `Costo interno total` · `Subtotal general` · `Total` · `Descuento`
- `Prescripción` (panel RX) · `Cristal` · `Montura` · `Ítem libre` · `Tratamiento`
- `Pendiente de completar` · `Completar ítem →` · `✓ Completado` · `Sin costos registrados` · `Agregar (costos)` · `Envío pendiente`
- `Subtotal` · `IVA (X%)` · `Saldo Pendiente` · `Pagado` · `Cubierto` · `X%` · `Cobrar / Registrar Pago`
- `Abonos Registrados` · `Tasa BCV` · `Tasa USDT` · `Aún no hay abonos registrados`
- `Historial` · `N eventos` · `Ver historial` · `Historial de cambios` · `Creada por`
- `Ver movimientos de stock (N)` · `Movimientos de Stock` · `Salida por Venta` · `Reversión por Cancelación`
- `Observaciones` · `Estado de cancelación` · `Reembolso emitido` · `Depósito retenido` · `Resolución financiera` · `Última actualización en la venta ...`
- `⚠ N ítems libres pendientes de completar` · `⚠ Este recibo tiene muchos ítems o pagos y puede superar media carta` (toast)

---

## 9. Restricciones para el agente rediseñador

1. **Cómo pedimos el rediseño:** mejorar la **presentación y utilidad de lo que se muestra** en `/sales/[id]` — jerarquía visual, densidad, agrupación, navegabilidad, duplicados (ver §10). No se pide cambiar el modelo de datos, ni las remotes, ni añadir nuevas queries para el render.
2. **Fuera de alcance:** `EditSaleModal` (+ todos los componentes `editSale/**`). Se abre con el botón "Editar" y no debe ni modificarse ni re-designarse (solo mantener el punto de entrada).
3. **No perder funcionalidad:** toda acción activa del header (ver/abrir/imprimir recibo PDF, impresión en tickera, cambio de estado, cobrar, cancelar, editar costos de ítems, completar/enriquecer ítems libres, expandir RX) debe seguir accesible en la variante final; y toda regla de gating de la §3 se respeta.
4. **Reglas de dinero:** formatos `formatPrice` (USD, es-VE), mantener la tasas congeladas por abono (rate freeze). Nada de recalcular con tasa live lo que es histórico.
5. **Los avisos de sistema actuales** (toast de media carta, banda de ítems libres pendientes) reflejan reglas de negocio — cualquier rediseño debe mantener este tipo de feedback visible.

---

## 10. Duplicados / pain points detectados (insumo directo para re-diseñar)

- **Subtotal / Descuento / Total aparecen 2 veces:** footer de la tabla y resumen financiero repiten los mismos montos; idealmente un solo "bloque de dinero" canónico o jerarquías distintas (vendedor vs. negocio).
- **Detección de cancelación duplicada:** tarjeta de cancelación (notices) + tarjeta de reembolso (columna derecha) repiten lo mismo.
- **Ratios visuales de la derecha:** en pantallas altas, la columna sticky junte: resumen + abonos + historial — puede ser un bloque frágil si crecen los abonos.
- **El mismo estado** aparece en el header (título implícito), tarjeta de datos (badge) y en la timeline del audit.
- **Número de orden** aparece en H1 y en la tarjeta de datos.
- **La fecha** aparece en la tarjeta de datos y en el "Creada por" del timeline de audit.
- El **RX expandido** muestra hoy campos "—" maquetados (Alt. Montaje OD/OI) sin fuentes de datos reales.
- Los **pagos incluidos "voided"** se muestran tal cual en la lista de abonos.
- La columna `Cant.` tiene poco uso práctico: casi siempre vale 1 (los pares de cristales son un solo ítem).
- El ícono de **Cashea** es un solo isotipo sin texto ni tooltip detallado — la info del plan de cuotas no está desglosada en la vista.

---

## 11. Resumen de flujo (una historia de uso típica)

> Vengo de la lista de ventas porque quiero revisar la venta de María Pérez. Veo arriba quién es, `#0004`, que está "Lista para Retirar" y que es una venta Cashea. Decido darle un vistazo al RX de los cristales: expandeo la fila del cristal y veo su tabla óptica completa. Me fijo que el ítem libre "Servicio de montura" aún está pendiente de completar — lo completo asignando proveedor y costo. Reviso el resumen: aún debe `$130` — presiono "Cobrar" y registro un abono con pago móvil a la tasa BCV del día. Al quedar saldada me pregunta automáticamente si quiero pasarla a "Completada". Antes de entregarle, imprimo el recibo y me aseguro de que no excede media carta. Si el cliente cancela, hay una sección clara de cancelación donde veo quién la canceló, cuándo y qué decisión financiera se tomó (reembolso emitido, retenido o no aplica).

---

_Documento generado para el rediseño de la vista de detalle de venta. Fecha: 2026-11-08. Arbol de archivos de referencia: `src/routes/(app)/sales/[id]/{+page.svelte,+page.server.ts}` · `src/lib/components/sales/{detail,itemsTable,editSale}/` · `src/lib/utils/saleDetail.ts` · `src/lib/shared/{tax.ts,enums/}`._
