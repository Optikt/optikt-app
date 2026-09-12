/**
 * Compat shim (DT1 phase 4) — re-exports the split purchase order query modules.
 * Import directly from `./purchaseOrders/<concern>` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './purchaseOrders/types';
export * from './purchaseOrders/shared';
export * from './purchaseOrders/orders';
export * from './purchaseOrders/items';
export * from './purchaseOrders/lifecycle';
