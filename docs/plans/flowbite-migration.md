---
plan name: flowbite-migration
plan description: Migrate flowbite to shadcn-svelte
plan status: done
---

## Idea

Replace all flowbite-svelte components with shadcn-svelte (bits-ui) equivalents across 57 files. Migrate wrapper components first (FormInput, ConfirmModal, etc.), then domain modals, then pages. Finally remove flowbite from package.json and layout.css. Each migration step must pass pnpm check, lint, tests, and visual review. No UI changes. No push without user review.

## Implementation

- Fase 1a: Migrate FormInput.svelte wrapper (replaces Input+Label+Helper with shadcn equivalents) → check → lint → test → visual review → commit
- Fase 1b: Migrate FormTextarea.svelte → check → lint → test → commit
- Fase 1c: Migrate FormDatepicker.svelte (Calendar+Popover shadcn) → check → lint → test → commit
- Fase 1d: Migrate FormActions.svelte → check → lint → test → commit
- Fase 1e: Migrate BaseSelect.svelte → check → lint → test → commit
- Fase 2a: Migrate ConfirmModal.svelte wrapper (Modal→Dialog, Button shadcn, SVG spinner) → check → lint → test → commit
- Fase 2b: Migrate ~22 domain modal files that use Modal/Button/Spinner directly → file by file, check → lint → test after each batch
- Fase 3a: Migrate DataTable.svelte (table wrappers → native <table>) → check → lint → test → commit
- Fase 3b: Migrate TablePagination.svelte → check → lint → test → commit
- Fase 4: Migrate ~7 page-level files (+page.svelte with Button/Select/Toggle) → file by file → check after each → commit
- Fase 5a: Remove @plugin 'flowbite/plugin' and @source entries from layout.css → check → lint → commit
- Fase 5b: Remove flowbite and flowbite-svelte from package.json → pnpm install → check → lint → test → commit

## Required Specs

<!-- SPECS_START -->

- flowbite-migration-arch
- flowbite-migration-detail

<!-- SPECS_END -->
