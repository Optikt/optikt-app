---
plan name: preserve-list-filters
plan description: Preserve query params on back navigation
plan status: done
---

## Idea
When navigating from list pages (sales, purchases, lenses, products, customers, quotes) to a detail page and then clicking the "Volver" button, the filters/search params are currently lost because the back button navigates to the bare URL. 

The fix is to store the list page's URL search params in sessionStorage when leaving a list page for a detail page within the same section, and then read those params when constructing the back URL in the detail page's goBack() function.

This applies to 6 list pages and their corresponding detail pages.

## Implementation
- Add `saveReferrerParams` and `getBackUrl` utilities to `src/lib/utils/urlState.ts` using sessionStorage
- Add `beforeNavigate` to each list page (sales, lenses, purchases, products, customers, quotes) to save current search params when navigating to a detail page of the same section
- Modify `goBack()` in sales detail, lenses detail (mobile), and quotes detail to use `getBackUrl()`
- Modify static back links in PurchaseOrderDetailHeader, lenses desktop PageHeader, products breadcrumb, and customers back link to use dynamic back URL with query params
- Verify all changes are consistent across pages and no unused imports remain

## Required Specs
<!-- SPECS_START -->
<!-- SPECS_END -->