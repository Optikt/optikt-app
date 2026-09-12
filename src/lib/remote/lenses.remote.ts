/**
 * Compat shim (DT1 phase 4) — re-exports the split lenses remote modules.
 * Import directly from `./lenses/<concern>.remote` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './lenses/materials.remote';
export * from './lenses/technologies.remote';
export * from './lenses/catalog.remote';
export * from './lenses/catalog-update.remote';
export * from './lenses/catalog-stock.remote';
