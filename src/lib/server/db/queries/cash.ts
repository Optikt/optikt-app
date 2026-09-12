/**
 * Compat shim (DT1 phase 4) — re-exports the split cash query modules.
 * Import directly from `./cash/<concern>` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './cash/expenses';
export * from './cash/report';
export * from './cash/daily';
export * from './cash/pipeline';
