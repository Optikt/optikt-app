/**
 * Compat shim (DT1 phase 4) — re-exports the split common schema modules.
 * Import directly from `./common/<concern>` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './common/dates';
export * from './common/contacts';
export * from './common/numbers';
export * from './common/identity';
export * from './common/optical';
export * from './common/pagination';
