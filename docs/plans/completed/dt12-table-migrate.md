---
plan name: dt12-table-migrate
plan description: Consolidar tablas UI duplicadas
plan status: done
---

## Idea
## Idea
Eliminar duplicado DT12: `DataTable.svelte` (snippet header/row + RowActions/defaultActions) y `DataGrid.svelte` (columns/pagination/mobileCard + patrón /sales). La tabla más nueva es `DataGrid` (usada en SalesTable.svelte:44 como canon) con 9 consumidores vs 5 de DataTable. Objetivo: unificar en un único componente `DataGrid` (o wrapper fino) con API compatible, migrar los 5 consumidores legacy, eliminar DataTable, y dejar cero refs duplicadas.

Problema actual:
- Dos APIs incompatibles para misma función (listar entidades). Migrar requiere reescritura, no solo cambio de import.
- Estilos divergentes: DataTable usa bg-slate-50/border-slate + hover:bg-slate-50; DataGrid usa surface-container-* / outline-variant / rounded-xl (Material)
- Features no paritarias: DataTable tiene defaultActions parseActionString + RowActions + soporte deletedAt toggle; DataGrid tiene pagination obligatoria + mobileCard responsive + columns alineación. Falta bridge para casos sin paginación.

Enfoque simple (no over-engineer):
- No crear tercer componente genérico. Reusar DataGrid tal cual + volver paginación opcional y añadir slot actions opcional si hace falta. Mantener cambios mínimos por tabla migrada (1:1 columnas ↔ th).
- Branch dedicado `chore/dt12-unify-tables` para PR aislado. Cada migración en commit separado para review fácil. BackupsTable ya usa DataTable y debe migrar también.

## Contexto útil
- DataGrid requiere 9 refs: PurchaseOrdersTable, MovementsTable, ProductsTable, LensCatalogTable, QuotesTable, CustomersTable, SalesTable, inventory/count, inventory/count/[id]
- DataTable 5 refs: MaterialsTable, SuppliersTable, UsersTable, BrandsTable, BackupsTable
- Plan base: PLAN.md:85 DT12 (2 días, riesgo: dos fuentes bugs)


## Implementation
- Crear branch `chore/dt12-unify-tables` desde main, push inicial vacío y abrir PR draft con checklist DT12
- Auditar paridad API: mapear Props de DataTable (header/row snippets, defaultActions, RowActions, emptyIcon Component) vs DataGrid (columns, page/perPage/total/onPageChange, mobileCard) y definir shim mínimo (pagination opcional + actions slot)
- Extender DataGrid para compatibilidad: hacer page/perPage/total/totalPages/onPageChange opcionales (si faltan no renderiza paginación) y añadir soporte opcional rowClass/actionsSnippet para no perder estilo DataTable si se necesita, mantener estilos DataGrid como canon
- Migrar tablas legado 1/5: BrandsTable.svelte + MaterialsTable.svelte — convertir header th a columns array, row snippet a <tr> con clases DataGrid, reemplazar defaultActions por RowActions inline o dropdown según SalesTable pattern, verificar Story vacío
- Migrar tablas legado 2/5: SuppliersTable.svelte + UsersTable.svelte — mismo mapeo columns/row, validar permisos canManage y callbacks onView/onEdit/onDelete/onReactivate, test manual modales delete/reactivate
- Migrar tablas legado 3/5: BackupsTable.svelte (src/lib/components/backups) — último consumidor DataTable, llevar a DataGrid aunque sea tabla pequeña, asegurar empty estados nuevos
- Eliminar DataTable.svelte, limpiar export en src/lib/components/ui/index.ts:4, grep 0 refs `DataTable`, eliminar parseActionString/helpers muertos si no usados, pnpm check + lint + tests
- QA visual + PR final: comparar before/after cada tabla (desktop + mobileCard), validar no regression pagination en tablas grandes, actualizar PLAN.md DT12 a ✅ completado, marcar PR ready for review

## Required Specs
<!-- SPECS_START -->
- backup-infra-sec
- public-catalog-arch
<!-- SPECS_END -->