# Optikt App

Optical store management system built with SvelteKit, Flowbite-Svelte, and Drizzle ORM.

## Tech Stack

- **Framework:** SvelteKit (Svelte 5 with runes)
- **UI Library:** Flowbite-Svelte (use MCP tools for docs — `findComponent`, `getComponentDoc`, `searchDocs`)
- **Styling:** Tailwind CSS
- **Icons:** `@lucide/svelte`
- **ORM:** Drizzle (PostgreSQL) — schema in `drizzle/schema.ts`
- **Validation:** Valibot
- **Toasts:** svelte-sonner
- **Package Manager:** pnpm

## Key Architecture

- `src/lib/remote/` — Remote functions (`query`, `query.batch`, `form`, `command`)
- `src/lib/schemas/` — Valibot validation schemas
- `src/lib/components/` — UI components organized by domain (brands, customers, lenses, products, suppliers, etc.)
- `src/lib/server/` — Server-side auth, guards, audit, database
- `src/routes/(app)/` — Authenticated app routes
- `src/routes/(auth)/` — Auth routes (login, etc.)
- `drizzle/` — DB migrations and schema

## Instructions

Project conventions, Svelte patterns, and design principles are in `.github/instructions/`.
Toast reference is available as a prompt in `.github/prompts/toast-usage.prompt.md`.

## MCP Servers Available

- **Svelte MCP** — Svelte 5 / SvelteKit documentation, autofixer, playground links
- **Flowbite-Svelte MCP** — Component documentation, search, examples
