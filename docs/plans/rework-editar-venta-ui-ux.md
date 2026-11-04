---
plan name: rework-editar-venta-ui-ux
plan description: Rehacer el flujo de edición de ventas con validación óptica clara y advertencias confirmables.
plan status: active
---

## Idea
Discovery actual:
- src/lib/components/sales/EditSaleModal.svelte concentra estado, orchestration, add forms, draft mutation y submit en 485 líneas.
- EditSaleLensPanel.svelte mezcla selección de catálogo, precio/descuento, receta y tratamientos en un panel de 334 líneas; el botón solo valida ID/precio.
- El drawer usa SlideOver xl (max-w-2xl), scroll único y footer separado; no hay focus trap/restauración, ni dirty-close confirmation, ni errores inline de payload.
- La edición reemplaza todos los sale_items e inventario dentro de una transacción en updateSale.ts; paidAmount protection y stock son invariantes que deben conservarse.
- El rango óptico no se valida en la edición actual. El helper existente lensConfirmation.ts solo cubre alta de venta/cotización y es warning-only.
- El rechazo reproducible actual del schema es cilindro positivo: OptionalCylinderSchema max(0), no un rango de catálogo. Un cilindro negativo fuera del rango del cristal hoy no tiene gate en el edit.

Objetivo: construir un editor de documentos comerciales reutilizable, usando ventas como primer adaptador. El flujo debe ser explícito y comprensible: seleccionar/reemplazar cristal, editar receta por ojo, ver estado de rango como advertencia, confirmar excepciones y guardar con errores accionables; nunca convertir rango óptico en blocker. Mantener autorización, auditoría, protección de pagos, stock y transacción atómica.

### Contrato agnóstico acordado
- El editor compartido modela encabezado, cliente, notas, descuentos, ítems polimórficos, resumen, estado dirty y validación.
- Los ítems compartidos cubren producto, cristal, tratamiento e ítem libre; venta y quote adaptan sus IDs de relación (`parentSaleItemId` / `parentQuoteItemId`) al payload propio.
- Ventas habilitan `saleDate`, motivo obligatorio, inventario, protección de pagos y auditoría contextual; quotes habilitan `quoteDate`/`validUntil`, sin inventario ni protección por pagos.
- Primer entregable: ventas funcionales con componentes y contrato listos para conectar quotes después; no se construye una pantalla completa de edición de quote en esta fase.
- Política óptica: límites físicos y estructura de receta son errores bloqueantes; estar fuera del rango específico del cristal es advertencia confirmable por ojo.

## Implementation
- Definir tipos y adaptadores del editor de documento comercial, junto con la matriz UX de errores bloqueantes vs advertencias y el mapeo de ventas/quotes sin duplicar reglas compartidas.
- Separar el orquestador del drawer en estado/validación/payload puros y componentes de sección: encabezado, artículos, editor de cristal, editor de producto/ítem libre, resumen y footer; preservar IDs de parent/child y la semántica de reemplazo de items.
- Rehacer el editor de cristal como flujo en pasos o secciones claras: catálogo y precio, receta OD/OI, tratamientos; mostrar rangos del cristal seleccionado y estado por ojo inline; permitir valores fuera de rango con advertencia y confirmación explícita antes de aplicar.
- Unificar validación cliente/servidor para edición: mantener límites físicos y relaciones estructurales como errores; no agregar un rechazo por rango óptico; traducir Zod/remote errors a campos y mensajes humanos en vez de depender de un toast genérico. El contrato debe poder ser consumido por `UpdateSaleSchema` y `UpdateQuoteSchema` sin hacer idénticos sus invariantes de dominio.
- Mejorar interacción del drawer: focus/keyboard semantics, cierre seguro cuando hay cambios, estados loading/saving, acciones sticky claras, resumen de diferencia antes de guardar y feedback de inventario/total sin ocultar la causa.
- Agregar cobertura unitaria para contrato, adaptadores, validación, warnings de rango, confirmación, dirty state, payload de reemplazo y mensajes; agregar prueba de integración/e2e del flujo de editar cristal fuera de rango y guardar exitosamente.
- Verificar invariantes server-side: una sola transacción para revertir/reconsumir inventario, protección de monto pagado, autorización, validación de tratamientos por proveedor y auditoría post-commit; ejecutar check, lint, tests y QA manual del drawer.

## Required Specs
<!-- SPECS_START -->
- rework-editar-venta-ui-ux
<!-- SPECS_END -->
