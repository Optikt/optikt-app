# Optikt App

Optical store management system built with SvelteKit, Shadcn-Svelte, and Drizzle ORM.

## Tech Stack

- **Framework:** SvelteKit (Svelte 5 with runes)
- **Styling:** Tailwind CSS
- **Icons:** `@lucide/svelte`
- **ORM:** Drizzle (PostgreSQL) — schema in `src/lib/server/db/schema/`, migrations in `drizzle/`
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

## AGENTS.md per domain (obligatorio)

Rules live on two levels. Both are **mandatory**:

1. **Root `AGENTS.md` (this file)** — global rules that apply to the whole repo, always. If a rule is global, it lives here and nowhere else.
2. **`docs/agents/<domain>.md`** — domain rules: business logic, invariants, local patterns and tech debt. **Before touching files of a domain, read its doc. If it doesn't exist yet, create it from `docs/agents/_TEMPLATE.md`.**

The path→domain mapping is machine-owned in `scripts/agents-domains.json` (source of truth; `pnpm agents:coverage` lists anything unmapped). Resolution rule: a path belongs to the domain named by its directory/prefix (`components/lenses`, `remote/lenses`, `queries/lenses`, `schemas/lenses*`, routes `lenses`) except for the exceptions listed at the end of this section. The CI check (`scripts/check-agents-docs.mjs`) warns when a domain was changed but its doc wasn't.

### Layer boundaries (do not skip or reverse)

- UI component → remote function (`query`/`form`/`command` in `src/lib/remote/`) → server query functions (`src/lib/server/db/queries/`) → Drizzle.
- Components never import anything from `src/lib/server/`. Remote functions never use Drizzle inline — they call query functions. `+page.server.ts` loaders are thin: delegate to remote functions.
- Validation with Zod schemas lives in `src/lib/schemas/`; reuse query functions with `tx` (see Database Transaction Pattern below); audit goes after the transaction.

### Documentation Sync Rule (mandatory)

When you add, remove or change any of these in a domain, update its `docs/agents/<domain>.md` in the same PR (create it from the template if missing):

- remote endpoints (new/removed/relocated, or changed semantics)
- business rules, state machines, invariants, money/inventory guarantees
- domain-owned schema fields with rule implications
- resolved or discovered tech debt

Global patterns or repo-wide conventions go to the root `AGENTS.md`, not to a domain doc.

### Index

Todos los dominios tienen doc en `docs/agents/<id>.md`. Batch core (reglas más profundas): `sales`, `payments`, `receivables`, `purchases`, `cash`, `inventory`, `products`, `lenses`, `materials`, `brands`, `customers`, `quotes`. Batch secundario: `suppliers`, `prescriptions`, `users`, `reports`, `dashboard`, `notifications-rates`, `backups`, `history`, `support`, `printing`, `trash`, `settings` — y `shared` para lo cross-cutting (UI base, documento comercial, schemas/common, audit, utils).

Mapping exceptions (everything under its own name unless listed):

| Path | Domain |
|---|---|
| `src/lib/server/payments/**`, `src/lib/components/payments/**` | `payments` (por deuda de factory transversal; los flujos de pago de venta/compra quedan en `sales`/`purchases`) |
| `src/lib/server/db/queries/purchaseOrder*.{ts,spec.ts}`, `src/lib/schemas/purchaseOrder*` | `purchases` |
| `src/lib/remote/catalog.remote.ts`, `src/lib/schemas/catalog*` | `products` |
| `src/lib/remote/lenses/**`, `src/lib/server/db/queries/lenses/**` | `lenses` |
| `src/lib/components/accessories/**`, `*brandAccessories*` | `brands` |
| `*brandSuppliers*` | `suppliers` |
| `src/lib/server/auth*`, `src/lib/schemas/auth.ts`, `src/lib/remote/auth.remote.ts`, `src/lib/server/db/queries/sessions.ts`, `src/routes/(auth)/**` | `users` |
| `src/routes/(app)/api/exchange-rates/**`, `src/lib/server/exchangeRates/**` | `notifications-rates` |
| `src/routes/api/internal/backup-webhook/**` | `backups` |
| `src/routes/(print)/**`, `src/routes/api/pdf/**`, `src/lib/server/pdf*` | `printing` |
| `src/lib/server/db/queries/deletedItems.ts`, `src/lib/server/db/schema/deletedItems.ts` | `trash` |
| `src/lib/server/db/queries/changeHistory.ts`, `src/lib/server/db/schema/changeHistory.ts` | `history` |
| Lógica pura en `src/lib/shared/`: `saleTotals*`, `saleItemCosts*`, `saleItemValues`, `tickera*`, `ticketRate*` → `sales`; `purchaseOrder*` → `purchases`; `payments/**` → `payments`; `expenseCalculations*` → `cash`; `prescriptionSnapshot*` → `prescriptions` | = dominio de destino |
| Cross-cutting (`components/ui`, `layout`, `commercialDocument`, `documentEditor`, `branding`, `background`, `schemas/common`, `audit`, `documentTotals`, `dates`, `utils`, `stores`, `types`, `hooks`): | `shared` (`docs/agents/shared.md`) — nota: `components/forms/**` (login) va a `users` |

## Tooltips (bits-ui)

Two reusable tooltip components. Use them instead of the native `title` attribute.

- `$lib/components/ui/InfoTooltip.svelte` — small info icon next to a label: `<InfoTooltip text="..." />`.
- `$lib/components/ui/TriggerTooltip.svelte` — rich tooltip for any interactive element you render yourself (submit buttons, links). Supports `title`, `text` and an `items` bullet list (e.g. "tooltip en botón submit" listing missing fields).

```svelte
{#snippet saveTrigger({ props })}
	<button {...props} type="submit" aria-disabled={!canSave}>Guardar</button>
{/snippet}

<TriggerTooltip
	title={missing.length > 0 ? 'Falta completar:' : undefined}
	items={missing}
	text={missing.length === 0 ? 'Todo listo para guardar' : undefined}
	trigger={saveTrigger}
/>
```

Rules:
- The `trigger` snippet receives `{ props }` (not raw props). Always destructure and spread `{...props}` — otherwise the element gets no hover/focus handlers and the tooltip never opens.
- Never use native `disabled` on a tooltipped trigger: disabled elements do not fire hover/focus, so the tooltip cannot open. Use `aria-disabled` plus a guard in the handler (`if (!canSave) return;`).
- Put `type="submit"` **after** `{...props}`; bits-ui's trigger defaults to `type="button"` and would override it.

## Import Policy — No Barrels

- Import directly from the defining module (`./form/lensFormPricing`, `$lib/components/inventory/count/countSummary`). Never add new `index.ts` barrels. **Never import from a barrel path** (`.../index.ts`) either — existing barrels are legacy consumables only; import the defining file.
- Why: Vite dev loads/parses every module re-exported by a barrel (slower startup + HMR); barrels hide dependency weight, invite circular imports through `index`, and weaken Knip dead-code detection. Prod tree-shaking is usually fine with pure ESM, but dev speed and explicit graphs are not.
- Exception: a barrel may exist **temporarily** as compat shim when splitting a module with legacy importers (see `dt1-split-protocol`); it must be removed in the follow-up migration PR.
- Precedent: `@lucide/svelte` explicit imports, never barrels (project conventions).

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

Project conventions, Svelte patterns, and design principles are in `.github/instructions/`. Los tres archivos de convenciones (`project-conventions`, `svelte-patterns`, `design-ui`) se cargan automáticamente vía `instructions` en `opencode.json`; `svelte-doctor.instructions.md` se lee bajo demanda. Toast reference is available as a prompt in `.github/prompts/toast-usage.prompt.md`.

## OpenCode tooling

- **Gate rápido:** tool `optikt_verify` (namespace `optikt`) o `/verify`. Corre `eslint` + `pnpm check` + solo los proyectos de vitest afectados por los archivos cambiados, y devuelve PASS/FAIL por gate.
- **Comandos:** `/verify`, `/db` (prepara migración Drizzle sin aplicarla), `/review-money` (auditoría de dinero).
- **Subagentes:** `money-reviewer`, `drizzle-guardian`, `svelte-reviewer` (revisan, no editan) y `test-author` (solo escribe pruebas).
- **Skills de dominio:** `optikt-money`, `optikt-db`, `optikt-svelte-remote`, `optikt-testing`. Se advierten solas y se cargan cuando aplican.
- **MCPs:** `svelte` (docs Svelte 5/SvelteKit), `context7` (docs al día de Drizzle/Tailwind/bits-ui/Zod), `playwright` (navegador real + screenshots). `postgres` está configurado pero `disabled`: apúntalo solo a una base de **desarrollo** antes de activarlo.


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
