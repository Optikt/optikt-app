/**
 * Compat shim (DT1 phase 4) — re-exports the split purchase orders remote modules.
 * Import directly from `./purchaseOrders/<concern>.remote` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './purchaseOrders/shared';
export * from './purchaseOrders/queries.remote';
export * from './purchaseOrders/commands.remote';
export * from './purchaseOrders/update.remote';
export * from './purchaseOrders/draft.remote';
export * from './purchaseOrders/review.remote';
export * from './purchaseOrders/payments.remote';
export * from './purchaseOrders/finance.remote';
