# Optikt App

Optical store management system built with SvelteKit, Shadcn-Svelte, and Drizzle ORM.

## Tech Stack

- **Framework:** SvelteKit (Svelte 5 with runes)
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

## Svelte MCP server

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
