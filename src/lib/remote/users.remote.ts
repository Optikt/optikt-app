/**
 * Compat shim (DT1 phase 4) — re-exports the split users remote modules.
 * Import directly from `./users/commands.remote` / `./users/forms.remote` in new code.
 * TODO: migrate legacy importers and remove this barrel.
 */
export * from './users/commands.remote';
export * from './users/forms.remote';
