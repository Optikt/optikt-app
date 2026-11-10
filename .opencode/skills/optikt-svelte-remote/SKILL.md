---
name: Optikt remote functions & Svelte 5
description: Patrones de remote functions de SvelteKit, validación Zod, toasts y tooltips en Optikt. Usar al crear o modificar formularios, queries, commands, modales o componentes Svelte.
---

# Remote functions, forms y componentes (Optikt)

## Remote functions

Se importan de `$app/server`: `query`, `form`, `command` (ver `src/lib/remote/brands.remote.ts:5`).

| Función | Cuándo |
| --- | --- |
| `query` | Lecturas (GET). Ej: `src/lib/remote/sales/queries.remote.ts:41` `listSales` |
| `form` | Envíos de formulario con validación. Ej: `src/lib/remote/brands.remote.ts:83` `createBrandForm` |
| `command` | Acciones que no son formulario (botones). Ej: `src/lib/remote/sales/payments.remote.ts:13` `addPayment` |

- `query.batch` **no se usa en este repo**. No lo introduzcas sin una razón medida: para listados, agrega en la query.
- Estructura: `src/lib/remote/*.remote.ts` + subcarpetas por dominio (`sales/`, `quotes/`, `purchaseOrders/`, `lenses/`, `users/`).

## Validación

- Schemas Zod en `src/lib/schemas/*.ts` (`common/` para piezas reutilizables: `identity`, `numbers`, `dates`, `optical`, `pagination`, `contacts`).
- Convención de nombre: PascalCase + sufijo `Schema` (`ListSalesSchema`, `CreateBrandSchema`, `AddPaymentSchema`).
- Import directo al archivo del schema, nunca al barrel `src/lib/schemas/index.ts`.
- El servidor valida, **pero el cliente también**: sin validación en cliente los errores no se muestran bien.

## Errores y toasts

- Helpers en `src/lib/utils/form.ts`: `toastUnboundErrors(allIssues)`, `getFormErrorMessage`, `scrollToFirstError`.
- En modales: toast **y** una caja de error inline (el toast puede quedar detrás del modal).
- En `try/catch` con toast, añade siempre `console.error(error)` para poder depurar.

## Formularios en modales

Los issues de `form` persisten al cerrar el modal (limitación de SvelteKit). Solución con `.for(id)`:

```svelte
let formInstanceId = $state(crypto.randomUUID());
$effect(() => {
	if (open) untrack(() => (formInstanceId = crypto.randomUUID()));
});
const currentForm = $derived(myForm.for(formInstanceId));
```

## Reglas de Svelte 5 / convenciones

- Runes: `$state`, `$derived`, `$effect`, `$props()`. Sin `export let`, `$:`, `createEventDispatcher`, `<slot>`, `on:event`, `let:`.
- En `+page.svelte`, los `data` de `load` no son reactivos: destrúyelos y envuélvelos en `untrack`.
- Carga inicial con `+page.server.ts` (`PageServerLoad`), nunca con `$effect`/`onMount`.
- `{#each}` siempre con key.
- Sin barrels nuevos (`index.ts`), tampoco para `@lucide/svelte` (imports explícitos).
- Tooltips: `InfoTooltip` (icono junto a un label) y `TriggerTooltip` (elemento interactivo propio). Ejemplo real: `src/lib/components/support/SupportTicketFormModal.svelte:236`.

### Contrato de `TriggerTooltip` (fuente de bugs)

```svelte
{#snippet submitTrigger({ props })}
	<button {...props} type="submit" aria-disabled={!canSave}>Guardar</button>
{/snippet}
```

- El snippet recibe `{ props }` y hay que **desestructurar y esparcir** `{...props}`: si no, el elemento no recibe hover/focus y el tooltip nunca abre.
- Nunca `disabled` nativo en un trigger con tooltip (no dispara hover/focus): usa `aria-disabled` + guard en el handler.
- `type="submit"` **después** de `{...props}` (bits-ui usa `type="button"` por defecto y lo pisaría).

## Prueba mínima

```sh
pnpm exec svelte-check --tsconfig ./tsconfig.json   # o: pnpm check
pnpm exec eslint <archivos cambiados>
pnpm exec vitest --run --project=client             # pruebas de componentes (.svelte.spec.ts)
```

## Checklist

- [ ] ¿Reusé `query`/`form`/`command` en vez de un `fetch` manual?
- [ ] ¿Schema Zod con nombre `*Schema` e import directo?
- [ ] ¿Validación y muestra de errores también en cliente?
- [ ] ¿Sin sintaxis legacy de Svelte 4?
- [ ] ¿`{#each}` con key y sin barrels nuevos?
