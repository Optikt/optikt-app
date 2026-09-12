/**
 * Compat shim (DT1 phase 4) — re-exports the split brandAccessories query modules.
 * Import directly from `./brandAccessories/<concern>` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './brandAccessories/types';
export * from './brandAccessories/reads';
export * from './brandAccessories/writes';
