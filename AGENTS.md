# Optikt App

Optical store management system built with SvelteKit, Flowbite-Svelte, and Drizzle ORM.

## Tech Stack

- **Framework:** SvelteKit (Svelte 5 with runes)
- **UI Library:** Flowbite-Svelte (use MCP tools for docs — `findComponent`, `getComponentDoc`, `searchDocs`)
- **Styling:** Tailwind CSS
- **Icons:** `@lucide/svelte`
- **ORM:** Drizzle (PostgreSQL) — schema in `drizzle/schema.ts`
- **Validation:** Zod
- **Toasts:** svelte-sonner
- **Package Manager:** pnpm

## Key Architecture

- `src/lib/remote/` — Remote functions (`query`, `query.batch`, `form`, `command`)
- `src/lib/schemas/` — Zod validation schemas
- `src/lib/components/` — UI components organized by domain (brands, customers, lenses, products, suppliers, etc.)
- `src/lib/server/` — Server-side auth, guards, audit, database
- `src/routes/(app)/` — Authenticated app routes
- `src/routes/(auth)/` — Auth routes (login, etc.)
- `drizzle/` — DB migrations and schema

## Database Transaction Pattern

Query functions in `src/lib/server/db/queries/` accept an optional `executor: DbOrTx = db` parameter (defined in `src/lib/server/db/types.ts`). This allows them to run standalone **or** inside a transaction:

```ts
// Standalone (default — uses db)
await addSalePayment(data);

// Inside a transaction (uses tx — rolls back on failure)
await db.transaction(async (tx) => {
	await addSalePayment(data, tx);
	await recalcSalePaidAmount(saleId, tx);
	await updateSale(saleId, { status: 'COMPLETED' }, tx);
});
```

**Rules:**

- All related writes in a remote command **must** be inside a single `db.transaction()`.
- Pass `tx` to every query function called within the transaction.
- Reads for validation (e.g., `findSaleById`) can stay outside the transaction.
- Audit logs are best-effort — log **after** the transaction succeeds, never inside it.
- Never duplicate query logic inline — always use the query function with `tx`.

## Instructions

Project conventions, Svelte patterns, and design principles are in `.github/instructions/`.
Toast reference is available as a prompt in `.github/prompts/toast-usage.prompt.md`.

## MCP Servers Available

- **Svelte MCP** — Svelte 5 / SvelteKit documentation, autofixer, playground links
- **Flowbite-Svelte MCP** — Component documentation, search, examples
