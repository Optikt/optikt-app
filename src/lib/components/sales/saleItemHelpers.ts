/**
 * Shared helpers for sale wizard components (Step 2, Step 3, NewSaleForm).
 * Pure functions that operate on SaleItemRow + data arrays.
 *
 * Legacy barrel — re-exports the split modules under helpers/ so existing
 * import paths keep working. New imports should target helpers/<concern>.
 */

export * from './helpers/items';
export * from './helpers/pricing';
export * from './helpers/prescriptionValidation';
export * from './helpers/lensConfirmation';
export * from './helpers/taxBreakdown';
