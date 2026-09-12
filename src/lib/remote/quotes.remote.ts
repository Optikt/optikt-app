/**
 * Compat shim (DT1 phase 4) — re-exports the split quotes remote modules.
 * Import directly from `./quotes/<concern>.remote` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './quotes/shared';
export * from './quotes/queries.remote';
export * from './quotes/commands.remote';
export * from './quotes/lifecycle.remote';
