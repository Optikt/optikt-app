/**
 * Compat shim (DT1 phase 4) — re-exports the split lens query modules.
 * Import directly from `./lenses/<concern>` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './lenses/materials';
export * from './lenses/technologies';
export * from './lenses/catalog';
export * from './lenses/pending';
