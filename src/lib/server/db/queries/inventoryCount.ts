/**
 * Compat shim (DT1 phase 4) — re-exports the split inventory count query modules.
 * Import directly from `./inventoryCount/<concern>` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './inventoryCount/types';
export * from './inventoryCount/shared';
export * from './inventoryCount/sessions';
export * from './inventoryCount/lines';
