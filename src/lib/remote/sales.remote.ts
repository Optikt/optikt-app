/**
 * Compat shim (DT1 phase 4) — re-exports the split sales remote modules.
 * Import directly from `./sales/<concern>.remote` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './sales/shared';
export * from './sales/queries.remote';
export * from './sales/commands.remote';
export * from './sales/payments.remote';
export * from './sales/lifecycle.remote';
export * from './sales/items.remote';
export * from './sales/update.remote';
export * from './sales/status.remote';
