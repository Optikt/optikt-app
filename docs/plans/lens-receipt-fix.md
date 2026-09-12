---
plan name: lens-receipt-fix
plan description: Corrige cristales impresos PDF
plan status: active
---

## Idea
Bug recibo PDF/tickera pierde FOTO y BLUE en cristales porque `hasInherentDescriptor` en `src/lib/utils/printDocumentItems.ts` solo detecta `fotocromat` largo y `blue cut/block`, mientras `LensCatalogForm` genera snapshotName con tokens sueltos `FOTO`, `AR`, `BLUE` (ej ventas #199 #200 #206). UI muestra `snapshotName` directo por eso se ve bien. Fix: ampliar detección a tokens sueltos `FOTO`, `FOTOCROMATICO`, `BLUE`, `BLUECUT`, mantener AR, cubrir variantes con/sin acento, usar mismo `getPrintItemLabel` en PDF A4 (`routes/(print)/print/sale/[id]`) y tickera (`printing.remote.ts` via `describeItem`), agregar tests vitest y validar en worktree `fix/sales-dates-and-details` sin tocar main, luego PR con evidencia.

## Implementation
- Reproducir bug con snapshots reales #199 #200 #206 en spec aislado
- Ampliar hasInherentDescriptor para FOTO suelto y BLUE suelto más variantes
- Verificar lensLabel mantiene material CR-39 más tipo más Fotocromático AR Blueblock
- Unificar PDF A4 y tickera sobre getPrintItemLabel sin duplicar lógica
- Agregar casos vitest FOTO solo BLUE solo AR combinado y regresión
- Validar render PDF y payload tickera en worktree fix/sales-dates-and-details
- Crear PR con capturas PDF tickera y checklist de specs

## Required Specs
<!-- SPECS_START -->
- dt1-payment-strategy
- dt1-patterns
- dt1-split-protocol
- public-catalog-arch
- sale-subtotal-semantics
- lens-print-tokens
<!-- SPECS_END -->