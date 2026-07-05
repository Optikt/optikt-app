---
plan name: wizard-context
plan description: prop drilling elimination
plan status: active
---

## Idea
Eliminate prop drilling across the entire sales wizard by introducing Svelte 5 context API. Phase 1: Move immutable reference data (products, lensItems) into a catalog context. Phase 2: Move mutable shared state (items, selectedCustomer, newCustomer, labels, discount, notes) into a sale data context using a $state wrapper for reactivity. Both NewSaleForm and NewQuoteForm benefit. Targets ~12 components across steps 1-3, reducing Props interfaces by 40-60% and removing 4 levels of prop threading.

## Implementation
- Create wizardContext.ts with CATALOG_KEY/SALE_KEY symbols and TypeScript interfaces
- Phase 1: Set catalog context (products/lensItems) in NewSaleForm + NewQuoteForm
- Phase 1: Update 8 consumer components to getContext instead of props (SaleStep2Items, SaleStep2ItemCard, SaleStep2SearchBar, SaleStep3Summary, QuoteStep3Summary, SaleStep2Toolbar pass-through, NewSaleForm, NewQuoteForm)
- Phase 1: Remove products/lensItems from all Props interfaces and parent templates
- Verify Phase 1: 0 errors, 715 tests, re-index MCP
- Phase 2: Create $state wrapper (saleCtx) for mutable shared state in NewSaleForm/NewQuoteForm
- Phase 2: Update consumers to read from saleCtx context instead of drilled props (items, selectedCustomer, newCustomer, labels, discount, notes)
- Phase 2: Remove all drilled props from interfaces and templates, verify 0 errors, re-index MCP

## Required Specs
<!-- SPECS_START -->
- public-catalog-arch
- wizard-context
<!-- SPECS_END -->