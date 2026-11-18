---
plan name: quotes-redesign
plan description: Rediseño completo del módulo Presupuestos (mockup designs/quotes-redesign.html): lista, detalle, editar drawer, convertir modal, duplicar wizard, móvil + backend (Cashea, sequence, preview conversión) y docs
plan status: active
---

## Idea
Presupuestos = mismo lenguaje que Ventas. Reusar componentes de ventas con adapters; backend con isCashea, sourceQuoteId, sequence de quote_number, guard de concurrencia en conversión, preview de conversión. Docs quotes.md + sales.md actualizados. Ver prompt §1-§11.

## Implementation
- Migración DB: quotes.is_cashea, source_quote_id + índice, sequence quote_number con setval + unique index
- Backend: schemas (isCashea/sourceQuoteId/ConvertQuoteSchema), mover helpers server/quotes (fin inversión de capas), convertQuoteToSaleCore reescritura con createSale(tx), guard concurrente, altura OD/OS, getQuoteConversionPreview, stats/listado extendidos, quoteValidity
- Lista /quotes: reusar SaleListHeader/KpiCards/FilterBar/StatusTabs/Footer, QuotesListView, QuoteRowMenu, quoteValidity chips
- Detalle /quotes/[id]: QuoteDetailHero (CSS hero compartido), SaleItemsTable readonly, historial QuoteAuditTimeline, QuoteDetailMobileBar, preview "Si se convierte hoy"
- Editar: EditSaleModal parametrizado con adapter sale|quote (Cashea toggle, Válido hasta, sin motivo)
- Convertir: QuoteConvertModal con CustomerLookupInput inline, revisión stock/precio, footer navy, aria-disabled+inline falta-completar
- Wizard /quotes/new + duplicar (?from=): SaleStep1Info/2/3 reusados, banner duplicar, quoteToWizardDraft
- Ventas D12 (X navy) + D13 (Desglose/Calcular factura botones) sin regresión
- Borrar muertos: components/quotes/index.ts barrel, QuotesTable, QuoteStep3Summary, QuoteDetailHeader/Meta/Summary/ItemsTable/AssignCustomer, assignQuoteCustomer remote
- Tests unit + integración (10 casos conversión, sequence concurrente, duplicar, altura) + optikt_verify
- Docs: quotes.md, sales.md, shared.md + mark_plan_done
- Verificación visual playwright 390/1280/2560 de las 8 pantallas vs mockup

## Required Specs
<!-- SPECS_START -->
<!-- SPECS_END -->
