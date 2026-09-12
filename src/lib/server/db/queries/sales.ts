/**
 * Compat shim (DT1 phase 4) — re-exports the split sales query modules.
 * Import directly from `./sales/<concern>` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './sales/types';
export * from './sales/shared';
export * from './sales/reads';
export * from './sales/writes';
export * from './sales/items';
export * from './sales/payments';
