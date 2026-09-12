/**
 * Compat shim (DT1 phase 4) — re-exports the split optical range modules.
 * Import directly from `./opticalRange/<concern>` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './opticalRange/types';
export * from './opticalRange/parse';
export * from './opticalRange/validate';
export * from './opticalRange/collapse';
export * from './opticalRange/expand';
