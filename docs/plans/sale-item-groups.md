---
plan name: sale-item-groups
plan description: Agrupar ítems de venta y presupuesto por persona (nombre libre), reparto por unidades sin dividir líneas y fórmula principal del cliente (solo ventas)
plan status: active
---

## Idea

Una venta o presupuesto puede llevar monturas, cristales y accesorios para varias personas (padre + hija + hijo), o varios pares de una misma persona. Hoy no se sabe qué cristal va con qué montura ni para quién. Además, la venta crea **una** fórmula para el cliente titular con el primer cristal (`buildPrescriptionPayload` toma `items.find(lens)`), enlaza **todos** los cristales a esa fórmula (`createSale.ts:130-133`) y la conversión desde presupuesto deriva una fórmula con `firstDefined` (`quoteHelpers.ts:42`). Ambos pisan la `isCurrent` del titular con datos que pueden ser de otra persona (deuda en `docs/agents/sales.md` Known gaps, "Fórmulas multi-persona").

Mockup aprobado (2026-11-19): https://claude.ai/artifact/SSLgdCescVod2A8agBJEab. Tableros: 1 wizard paso 2 (venta/presupuesto), 2 drawer "Modificar orden / presupuesto" con pestaña Personas, 3 detalle (venta/presupuesto) con chip por línea y vista "Por persona", 4 móvil del detalle, 5 modal de conversión y duplicado.

### Decisiones acordadas con el usuario

- **Un solo desarrollo** (sin fases de entrega). Todo opcional: una venta sin grupos se ve y se comporta como hoy.
- **Grupo = persona o trabajo.** Nombre de texto libre, opcional, sin vínculo a `customers` (pedir cédula/teléfono entorpece la venta; quizá a futuro). Sin nombre se muestra "Trabajo N".
- **Las líneas nunca se dividen.** Una montura ×2 puede ser 1 para Sofía y 1 para Andrés: se guarda un reparto por unidades (`quantity` por miembro). Suma asignada ≤ `sale_items.quantity`; el resto queda "sin asignar". En UI: chip "2 personas" + tooltip / desplegable dentro de la misma fila.
- **Tratamientos** siguen a su cristal (`parentSaleItemId`); no se asignan aparte ni aparecen en el reparto.
- **Fórmula principal: solo ventas.** Al marcarla, la fórmula de ese cristal se guarda como fórmula vigente del cliente de la venta. Sin principal: no se crea ni se pisa ninguna fórmula.
  - Default: **un solo cristal y ningún nombre** → ese cristal viene marcado como principal (desmarcable). Conserva el flujo diario de hoy.
  - Cambiarla después (detalle/edición) = se crea una fórmula vigente nueva; la anterior queda en el historial del cliente. Desmarcar no borra nada.
  - Presupuestos no tienen principal; se elige en el modal de conversión (opción "Ninguna").
- **Convertir presupuesto → venta** copia grupos, nombres y reparto.
- **Duplicar presupuesto** conserva el emparejamiento, limpia los nombres (como ya limpia la graduación) y avisa. Nunca bloquea; si no se escribe nada quedan como "Trabajo N".
- **Pantallas:** oficina 1280×720 primero (sidebar abierto), 2K escala, móvil en detalle y drawer de edición (ya funcionan en móvil hoy). **El wizard de 3 pasos no tiene versión móvil y no se le agrega en este desarrollo.**
- **Orden visual por persona** (2026-11-20). Cuando hay grupos, las líneas se muestran juntas por persona en el orden de los grupos: montura, cristal (+ sus tratamientos), accesorios; luego la siguiente persona; al final lo sin asignar en su orden original. Una línea repartida (montura ×2) aparece una sola vez, en el primer grupo donde está, y los cristales de cada persona van debajo: "montura ×2, cristal, cristal". Sin grupos el orden es el de hoy. Aplica en detalle, drawer de edición, wizard, **ticket y PDF**. El ticket y el PDF **no** muestran el nombre de la persona, solo el orden.
- **Accesorios auto-agregados** (los que `includedAccessories.ts` agrega al elegir una montura o lentes de sol): en el wizard siguen a su montura al asignarla (misma persona y mismo reparto de unidades) y se pueden mover a mano después. El enlace montura→accesorio hoy solo existe en el wizard (`IncludedAccessoryMap`, no se persiste); una vez guardada, la venta conserva la relación a través del grupo. En edición o detalle, un accesorio sin grupo se asigna a mano.
- **Fuera de alcance:** seguimiento de laboratorio (compra de cristal, montaje, entrega) → queda como plan futuro en Known gaps de `sales`.

### Decisión técnica (refina el mockup sin cambiar la UX)

La ⭐ principal se ancla al **cristal**, no al grupo: `sales.primary_lens_item_id`. Motivos: (a) un grupo puede tener dos cristales (misma persona, dos pares) y hay que saber cuál fórmula usar; (b) el default "un solo cristal" funciona sin crear grupos; (c) evita un `isPrimary` en grupos que en presupuestos no existe. En la UI la estrella sigue mostrándose en el grupo cuando tiene un solo cristal; si tiene varios, se muestra por cristal.

## Modelo de datos

Migración Drizzle `0055_sale-item-groups` (generar con `pnpm drizzle-kit generate`, revisar SQL, no aplicar sin confirmar):

- `sale_item_groups`: `id uuid pk default random`, `sale_id uuid not null → sales(id) on delete cascade`, `label varchar(60) null`, `position integer not null`, `created_at`, `updated_at`. Índice `ix_sale_item_groups_sale_id`.
- `sale_item_group_members`: `group_id uuid not null → sale_item_groups(id) on delete cascade`, `sale_item_id uuid not null → sale_items(id) on delete cascade`, `quantity integer not null check (quantity > 0)`. PK `(group_id, sale_item_id)`. Índice por `sale_item_id`.
- `sales.primary_lens_item_id uuid null → sale_items(id) on delete set null`.
- Espejo: `quote_item_groups`, `quote_item_group_members` (FK a `quotes` / `quote_items`). **Sin** columna de principal en quotes.
- Grupos y miembros se borran duro (son metadato, no dinero/inventario); no pasan por papelera.

Invariantes (validadas en Zod **y** en el servidor dentro de la tx):
1. Por ítem, `Σ members.quantity ≤ item.quantity`.
2. Miembros solo de ítems `PRODUCT`, `LENS_PAIR`, `FREE_ITEM` (nunca `TREATMENT`).
3. Todos los ítems del grupo pertenecen al mismo documento y no están soft-deleted.
4. Grupos sin miembros no se guardan.
5. `primary_lens_item_id`, si existe, apunta a un `LENS_PAIR` vivo de la misma venta.
6. `label` trim; vacío → `null`.

## Contrato de entrada

`ItemGroupsInputSchema` (en `src/lib/schemas/sales.ts`, reutilizado por `quotes.ts`):

```ts
groups: z.array(z.object({
  label: z.string().trim().max(60).optional(),
  members: z.array(z.object({ itemId: z.uuid(), quantity: CoercedInteger.min(1) })).min(1)
})).max(20).optional()
```

`itemId` es el id cliente del ítem (`SaleItemSchema.id`, ya existe para enlazar tratamientos). El servidor lo traduce al id real con el mismo `idMap` que ya usan `createSale` y `updateSale` (`updateSale.ts:234-245`). Ventas añaden `primaryLensItemId: z.uuid().nullable().optional()` (id cliente). `refine` cruzado: suma ≤ cantidad, sin tratamientos, primary ∈ ítems LENS_PAIR.

## Implementation

- **Fase 0 · Schema y migración.** Tablas + columna en `src/lib/server/db/schema/sales.ts` y `quotes.ts` (relations incluidas), migración 0055, tipos `SaleItemGroup`/`QuoteItemGroup` en `queries/*/types.ts`. Gate: `pnpm check`.
- **Fase 1 · Lógica pura + schemas.** `src/lib/shared/saleItemGroups.ts` (+ `.spec.ts`), dominio `sales` por la excepción de `shared/saleItem*`: `assignedQty`, `remainingQty`, `clampAllocations(groups, items)` (al bajar cantidad o borrar ítem), `dropEmptyGroups`, `groupDisplayLabel(label, index)` → "Trabajo N", `chipModel(item, groups)` (sin asignar / 1 persona / N personas · M libre + texto del tooltip), `defaultPrimaryLens(items, groups)` (un cristal y ningún nombre), `clearLabels(groups)` (duplicado), `orderItemsByGroups(items, groups)` (orden de display estable: por grupo → montura/producto, cristal + tratamientos hijos, accesorio; línea compartida en su primer grupo; sin asignar al final en orden original; sin grupos = identidad), `followIncludedAccessories(groups, frameRowId, accessoryMap)` (wizard). Schemas Zod de la sección anterior en `schemas/sales.ts` y `schemas/quotes.ts` con specs.
- **Fase 2 · Server.**
  - Query functions con `executor` en `src/lib/server/db/queries/sales/itemGroups.ts` y `queries/quotes/itemGroups.ts`: `replaceSaleItemGroups(saleId, groups, tx)` (delete + insert), `findSaleItemGroups(saleId)`, `setSalePrimaryLens(saleId, itemId|null, tx)`; espejos para quotes.
  - `createSale.ts`: insertar grupos con ids traducidos. Fórmula: si llega `primaryLensItemId`, crear la prescripción solo con ese cristal y enlazar **solo ese** `LENS_PAIR` a `createdPrescription.id`; el resto conserva `item.prescriptionId ?? null` (corrige `createSale.ts:130-133`). Sin primary → no `unsetCurrentPrescriptions` ni `createPrescription`.
  - `updateSale.ts`: tras el reemplazo de ítems, `replaceSaleItemGroups` con `idMap`; remapear `primary_lens_item_id`. Si cambia el principal → nueva prescripción vigente desde el snapshot del cristal (doctor: el de la prescripción enlazada si existe; si no, `null`, igual que hoy en la conversión). Todo en la misma tx.
  - Comando nuevo **solo-grupos** `saveSaleItemGroups({ saleId, groups, primaryLensItemId })` (`src/lib/server/sales/saveSaleItemGroups.ts` + remote en `src/lib/remote/sales/groups.remote.ts`): permitido en cualquier estado salvo `CANCELLED` (incluye `COMPLETED`, porque no toca dinero ni inventario); permisos `canManageSaleByOwner`. Recibe ids reales. Quotes: `saveQuoteItemGroups` (bloqueado si el presupuesto ya está convertido).
  - Quotes: `createNewQuote.ts` y `updateExistingQuote.ts` insertan/reemplazan grupos con el mismo patrón.
  - `convertQuoteToSale.ts`: reemplazar `derivePrescriptionFromQuoteItems` por la elección del modal (`primaryQuoteItemId | null`); copiar grupos con el mapa `quoteItemId → saleItemId`; quitar el comentario `DEBT(multi-person-rx)`. Eliminar `derivePrescriptionFromQuoteItems`/`firstDefined` si quedan sin uso.
  - Lecturas: `findSaleByIdWithRelations` y la lectura de detalle de quote devuelven `groups` (con miembros) y `primaryLensItemId`.
  - Auditoría (después de la tx, best-effort): `logUpdate('sale'|'quote', { groups: before }, { groups: after })` con resumen legible. Historial muestra "Agrupación por persona actualizada" + resumen ("Montura Nano Vista: 1 Sofía, 1 Andrés") en `saleAudit`/`quoteAudit`.
- **Fase 3 · Wizard paso 2 (solo escritorio, venta y presupuesto).** Estado `groups: { key, label, members: Map<rowId, qty> }[]` + `primaryLensRowId` en `wizardContext.ts`; `clampAllocations` al cambiar cantidad o borrar ítem. Componentes nuevos en `src/lib/components/sales/groups/`: `ItemPersonChip.svelte` (chip PARA en la fila de etiquetas de la tarjeta, con `TriggerTooltip` para el reparto), `ItemPersonPopover.svelte` (Asignar / − + / nueva persona / "Organizar todo…"), `PersonsDrawer.svelte` (drawer navy: nombres, ⭐ solo ventas, tabla de reparto). Botón "Personas (N)" junto a "Copiar Rx a todos" en `SaleStep2Toolbar.svelte`. Pie: "★ Fórmula del cliente: X" en ventas. `wizardSubmission.ts`: `buildSaleItemsFromWizard`/`buildQuoteItemsFromWizard` emiten `groups`; `buildPrescriptionPayload(items, date, primaryRowId)` usa el cristal principal (no el primero). Reutilizar en `NewQuoteForm.svelte` vía los mismos componentes (sin ⭐).
- **Fase 4 · Drawer de edición.** Pestañas `Artículos | Personas · N` en la cabecera ARTÍCULOS de `EditSaleItemsList.svelte`/`EditSaleModal.svelte`; chip PARA bajo cada ítem en `EditSaleItemView.svelte`; la pestaña Personas reutiliza `PersonsDrawer` en modo embebido. Draft en `editSaleDraft.ts` y `quoteEditAdapter.ts`; `submitEditSale.ts` envía `groups`/`primaryLensItemId`. Aviso de qué pasará con la fórmula al guardar. **Modo solo-grupos**: si la venta no es editable (completada, rol sin permiso para editar ítems) el drawer abre directo en Personas, con Artículos en solo lectura, y guarda vía `saveSaleItemGroups`.
- **Fase 5 · Detalle (venta y presupuesto) + móvil.** En `itemsTable/SaleItemsRow.svelte`: chip bajo la descripción (sin columna nueva), "Para N personas ▸" desplegable en la misma fila, badge "★ Fórmula del cliente". Selector `Lista | Por persona` y botón "Organizar" (abre el drawer en Personas) en la cabecera de `SaleItemsTable.svelte`; vista Por persona sin montos (una línea repartida no se divide en dinero). Quotes vía `quoteItemsAdapter.ts`. Móvil: chips en cada línea y "Personas · N" abre el drawer como hoja inferior con objetivos de 44 px. Usar los umbrales de container query existentes (<700, ≥700, ≥1500).
- **Fase 6 · Conversión y duplicado.** `QuoteConvertModal.svelte`: sección "Personas" (pasan tal cual) + fieldset "Fórmula del cliente (opcional)" con un radio por cristal (etiquetado con su persona) y "Ninguna"; preselección con `defaultPrimaryLens`. Duplicado: `quoteToWizardDraft.ts` copia grupos con `clearLabels`, y el wizard muestra un aviso (toast `svelte-sonner` + banda) "Se limpiaron los nombres de N personas; el emparejamiento se conservó".
- **Fase 6b · Orden en todas las vistas.** Aplicar `orderItemsByGroups` en detalle (venta/presupuesto), drawer de edición, ticket (`tickera*`) y PDF (`src/routes/(print)/**`, `api/pdf`). No hay columna de posición en `sale_items`/`quote_items` (se leen por `createdAt`), así que el orden se deriva al mostrar; no se persiste. En el wizard se reordena al cerrar el popover/drawer, no mientras se edita, para que las tarjetas no salten.
- **Fase 7 · Docs y verificación.** Actualizar `docs/agents/sales.md` (reglas de grupos, primary, comando nuevo, cerrar deuda multi-persona, agregar "seguimiento de laboratorio" como plan futuro), `docs/agents/quotes.md` (grupos, conversión, duplicado), `docs/agents/prescriptions.md` (cuándo se crea/pisa `isCurrent` desde ventas). Verificar en navegador a 390×844, 1280×630 (sidebar abierto) y 2560×1300. Retirar este plan con `mark_plan_done` al mergear (dominios: `sales`, `quotes`, `prescriptions`).

## Pruebas

- **Unit:** `shared/saleItemGroups.spec.ts` (todas las funciones puras, incluido clamp al bajar cantidad y default de principal), specs de schemas (suma > cantidad, tratamientos, primary inválido, label vacío → null), `wizardSubmission.spec.ts` (payload con grupos; `buildPrescriptionPayload` usa el principal), `quoteToWizardDraft.spec.ts` (labels limpios, emparejamiento intacto), `editSaleDraft.spec.ts`.
- **Integración (`*.int.spec.ts`):** `createSale` (con/sin grupos; principal enlaza solo su cristal; sin principal no toca `isCurrent`), `updateSale` (remapeo de grupos y principal tras reemplazo de ítems; cambio de principal crea fórmula nueva y deja la anterior), `saveSaleItemGroups` (venta COMPLETED permitido, CANCELLED rechazado, suma inválida rechazada, sin efectos en totales/inventario), `createNewQuote`/`updateExistingQuote`, `convertQuoteToSale` (copia grupos, principal elegido, "Ninguna" no crea fórmula).
- **Componente:** chip/popover (asignar, repartir, clamp), drawer (renombrar, ⭐ solo en ventas), detalle (desplegable de reparto, vista Por persona).
- **Gates por fase:** `eslint` + `pnpm check` + vitest de los proyectos afectados (`/verify`). Revisión `money-reviewer` en Fase 2 (toca `createSale`/`updateSale`/conversión aunque no cambie montos) y `drizzle-guardian` en Fase 0.

## Riesgos

- `updateSale` reemplaza ítems con ids nuevos: si se olvida el remapeo, los grupos quedan apuntando a ítems soft-deleted. Mitigación: `replaceSaleItemGroups` siempre corre cuando hay `items` en el payload, y un int spec lo cubre.
- Cambiar el comportamiento de la fórmula: hoy toda venta con cristal crea una fórmula vigente. Con el default "un cristal sin nombres → principal" el caso común no cambia; con varios cristales y sin elección explícita ya **no** se pisa nada (es el arreglo buscado).
- Popover dentro de tarjetas con `overflow-hidden` (`SaleStep2ItemCard.svelte:72`): usar portal (bits-ui Popover) para que no se recorte.

## Required Specs

<!-- SPECS_START -->
<!-- SPECS_END -->
