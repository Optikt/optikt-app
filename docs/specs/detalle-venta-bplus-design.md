# Detalle de venta · Opción B+ — diseño

> Fuente visual: mockup B+ (4 tamaños, escenarios, 3 drawers). Actualiza y amplía la Opción B ya mergeada (`docs/plans/redesign-sale-detail-view.md`, PR #216). Todo lo no mencionado se queda igual.

## 1. Objetivo y alcance

Cinco áreas + un fix, en una rama, commits atómicos uno por uno:

| #   | Slice                                                                                        | Commit |
| --- | -------------------------------------------------------------------------------------------- | ------ |
| F   | Buscador edición: dropdown ancho independiente del trigger                                   | 1      |
| A   | Pantallas grandes: `max-width` 1760, hero 3 zonas ≥1500px, rail 360/420, container queries   | 2      |
| B   | Pagos: fila sin truncar + drawer «Pagos de la venta» con anulación                           | 3      |
| C   | Stock: drawer con neto, filtros, grupos; tipo `EDIT_REVERT` hacia adelante                   | 4      |
| D   | Auditoría + historial: diff estructurado en `updateSale`, timeline con pagos, tope + ver más | 5      |
| E   | Móvil <700px: sidebar overlay, hero 1 col, bottom bar + hoja «Más», drawers full-width       | 6      |

Fuera de scope: cambios a `computeSaleTotals` / impuestos, redondeo, nuevas dependencias, `title` nativos.

## 2. Servidor y datos

### 2.1 `sale_payments`: quién + motivo (migración aditiva, sin backfill)

- Nuevas columnas nullable: `createdById uuid → users` (quién cobró), `voidedById uuid → users`, `voidReason varchar` (motivo anulación).
- `addSalePayment`: guarda `createdById` del ctx. `voidSalePayment`: `VoidPaymentSchema` exige `reason` (no vacío) + guarda `voidedById/voidReason`; mantiene soft-delete `voidedAt` y recalcs/estado actuales.
- Lo viejo queda "—" / "sin detalle" (aceptado). Auditoría sigue best-effort después de la tx.

### 2.2 Stock: `EDIT_REVERT` solo hacia adelante (sin migración de datos)

- Nuevo valor `EDIT_REVERT` en `InventoryMovementType` + label «Reversión por edición» (el `CANCEL_REVERT` queda solo para cancelación real).
- `revertSaleInventory(..., origin: 'edit' | 'cancel')`: escribe `EDIT_REVERT` + `notes` con motivo de edición cuando `origin='edit'`; `updateSale` pasa `'edit'`, `cancelSale` pasa `'cancel'` (default `'cancel'`).
- Movimientos viejos quedan como `CANCEL_REVERT` (entendible, sin reescritura).
- Agrupación por operación (prompt §5): por `referenceType + referenceId + usuario + minuto de createdAt` (no hay columna de operación; no se agrega).

### 2.3 Diff de auditoría en `updateSale` (único cambio de negocio)

- Punto: `before` = ítems leídos dentro de la tx (`oldItems`, ya existe); `after` = `data.items` validados. Cálculo puro fuera/después de la tx, anexado al evento «Venta actualizada» vía auditoría (después del commit, best-effort). La tx de inventario no se toca.
- Emparejamiento: por `id` cliente (ya llega en `data.items`, hoy se descarta como PK). `swap` = cambió de producto; hijos tratamiento re-creados sin id = `add`/`del` (aceptado, documentado).
- Esquema `SaleAuditDiff v1`: `{ v:1, items: add|del|swap|mod[], header: saleDate|notes|isCashea|discount[], totals: Subtotal|Total[] }`, tope 50 cambios + `truncated: N`. Valores ya legibles (`USD 1.234,50`, fórmula `−1.00 −1.00 ×142°`).
- Privacidad: costos internos **nunca** en el diff visible (exclusión total, sin gate por rol — el gate ADMIN/MANAGER solo sigue aplicando a editar costos).
- Eventos viejos: aviso «Sin detalle de cambios registrado (evento anterior al registro detallado)», sin migración.

## 3. UI por área (mockup B+ manda en lo visual)

### A · Pantallas grandes (container queries, nunca viewport)

- `.page`: `max-width: 1760px`, `container-type: inline-size`. Umbrales: `<700` móvil (E); `700–1499` base actual; `≥1500` hero 3 zonas.
- Hero ≥1500 áreas: `"hl hc mon" / "acts acts hcta"` (cliente `hc2` columna propia a toda altura; `hcta` cobro bajo dinero). 700–1499: `"hl mon" / "hc mon" / "acts hcta"`. DOM: hijos directos `hl hc2 mon acts hcta` + `grid-template-areas`.
- Rail: 360px ≥1060, 420px ≥1500. Barras decorativas se reposicionan a la izquierda de `mon`; ocultas en móvil. Sidebar toggle reacomoda suave (container, no viewport).

### B · Pagos: tarjeta + drawer «Pagos de la venta»

- Tarjeta (`SaleDetailPayments`): cabecera Pagos + contador vigentes + «Ver detalle» + «+ Registrar» (saldo + permiso). Fila `32px 1fr auto 30px`, arriba-alineada; izquierda envuelve (`overflow-wrap:anywhere`, sin `…`): método 600 / fecha + Ref. / tasa BCV mono + tooltip; derecha USD 600 + Bs original; ⋯ anular (permiso + no cancelada). Anulados colapsados tras «Ver N anulados».
- Drawer 440px (full en móvil), reutilizando `SalePaymentDrawer` como alta y creando `SalePaymentsHistoryDrawer` sobre `PaymentsTable` viejo (no tal cual: sin `paymentNumber`, con `createdBy/voidBy` nuevos). Franja Total/Cobrado/Saldo + tarjeta por pago (monto original, tasa congelada + tipo, fecha y hora, registrado por, referencia, equivalente USD BCV, notas; anulado: fondo `#fbfafb` + motivo/quién/cuándo, sin acción; vigente: «Anular este pago» → modal existente con motivo obligatorio).

### C · Stock: de modal a drawer

- `SaleMovementsModal` → `SaleStockDrawer` 440px (full móvil): subtítulo «N movimientos · efecto neto por producto»; resumen neto por producto (Producto·Salidas·Reversiones·Neto; neto 0 en gris); filtros Todos/Salidas/Reversiones; grupos por operación (más reciente primero): «Edición · fecha · usuario» / «Creación de la venta» / «Cancelación»; fila compacta ~44px (↓ roja salida / ↑ verde reversión, nombre 600, motivo secundario, cantidad Space Grotesk ±).

### D · Historial: rail + drawer con detalle

- Rail: 3 eventos recientes (título, usuario·fecha, motivo envuelto, «N cambios · Total ±USD x →» abre drawer expandido; estados «A→B»). Pie: «Movimientos de stock (N)» + «Última actualización: evs[0]».
- Drawer 440px (full móvil), filtros Todos/Ediciones/Estados, tarjeta por evento (icono por tipo, título, usuario·fecha-hora, chip `Total ±USD x` verde/rojo/gris + tooltip, MOTIVO destacado, estados como pills). «Ver los N cambios» (grid-rows 250ms): ARTÍCULOS (`+`Agregado / `−`Quitado / `⇄`Reemplazado antes tachado→después negrita / `✎`Modificado con filas `Campo: antes→después` incl. fórmula OD/OI, precio, tratamiento), DATOS (fecha, nota, Cashea, descuento), TOTALES (antes→después + delta). Viejos: aviso en cursiva sin despliegue.
- Timeline une `sale` + `sale_payment` (registrado/anulado). «Ver más» pagina (`limit 50 + offset`; hoy el drawer corta en 50 silencioso).

### E · Móvil (<700px contenedor)

- Sidebar overlay (hamburguesa, velo, cierra al tocar; oculta búsqueda global y nombre, deja logo+avatar). Hero 1 col sin barras: sobrelínea ←Ventas, título 24 + pill + Cashea, stepper compacto (solo paso actual con etiqueta), meta 2 col, cliente (nombre link, chips cédula/tel que copian, dirección envuelve), dinero 2 col (Total+Bs | Saldo+Bs) + Desglose/Calcular full-width.
- Acciones del hero → barra inferior fija (CTA dorado Cobrar/Imprimir + «Más»); hoja «Más» (bottom sheet asa, radio 16, translateY): pasar estado (1 fila por transición válida + descripción), editar, imprimir, calcular, pagos, historial, stock, —separador— cancelar (rojo). Todo con mismos guards.
- Artículos como tarjetas (sin header columnas; USD izq / Bs der; fórmula colapsable full-row; hijos sangría 36). Pagos+Historial apilados. Drawers/modales full-width; calculadora por mini-tarjetas. Página con 96px libres abajo. Nada crítico solo-hover.

### F · Buscador edición

- `SearchCombobox.svelte`: dropdown desacoplado del trigger (`left-0 right-auto w-max min-w-full max-w-[min(32rem,90vw)]`, vacío/loading igual). Sin portal; si un ancestro del modal recorta, `overflow-visible` en la banda del editor. Sin cambios en `ItemSelect` ni en el wizard.

## 4. Flujos, errores, accesibilidad

- Drawers: `role=dialog`, foco de retorno, `aria-expanded` en despliegues, `prefers-reduced-motion`. Toasts + `console.error` en catch (patrón repo). Anular pago / cancelar venta: modal existente, motivo obligatorio, guards de permiso/estado intactos.
- Sin `…` salvo donde el prompt lo pida expresamente; envolver siempre (`overflow-wrap:anywhere`).

## 5. Pruebas

- Unit: diff (add/del/swap/mod por campo, fórmula, tratamiento hijo, descuento global, Cashea, totales, tope 50+truncated); agrupación stock por operación + neto; saldo/resumen pagos.
- Servidor (int, testcontainers): `updateSale` guarda diff sin alterar totales/inventario; evento viejo sin diff se lee; void pago exige motivo y guarda quién/cuándo; `EDIT_REVERT` solo en edición.
- Componente/E2E: abrir cada drawer en 390 y 1280; filtros; anular desde drawer; hoja «Más» por permiso/estado; overlay sidebar; layout 1280/1920/2560 sin regresión.
- Visual manual contra mockup (Compleja #0262: nada truncado).

## 6. Qué NO hacer

Ver prompt §10 (no truncar, no viewport queries, no solo Subtotal/Total, no costos en diff, no nueva op. de anulación, no rotular edición como cancelación, no hover-crítico, no acciones del hero en página móvil).

## 7. Doc-sync

Cada slice actualiza `docs/agents/sales.md` (+ `inventory.md`/`history.md` donde aplique) en el mismo commit.
