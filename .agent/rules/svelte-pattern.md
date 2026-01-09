---
trigger: always_on
---

# Load initial data

- To load initial data for pages, use a `+page.server.ts` file for a `+page.svelte` file to load the initial data needed.
- Use a `load` function on the `+page.server.ts` (a `PageServerLoad` type function) to load that initial data. Do not use `$effect` or `onMount` hook in the pages to load this initial data. 
- To future loads (as filtering and other stuff), you can use the remote functions. ONLY use the `PageServerLoad` function for the initial data.

# Manejo de Errorres con remote functions

- El server con las remote functions puede realizar las validaciones con valibot, pero es necesario hacer client-side validations para poder mostrar correctamente los errores al usuario.
- Usa toast si es posible. En el caso de que use modal, entonces puedes usar el toast y un pequeño recuadro en el modal (ya que el toast tiende a quedarse de fondo)

# Component Self-Containment Rule:

If a component performs a specific action (like toggle, delete, reactivate), it should import and call the remote function internally. Pass only the data needed and emit events (like onSuccess, onError) for parent coordination. Generic components (like ConfirmModal) take callbacks; domain-specific components call their own remotes.

# Remote Function Usage Pattern

| Function          | Use Case                         |
| ----------------- | -------------------------------- |
| **`query`**       | Read data (GET operations)       |
| **`query.batch`** | Multiple queries, avoid N+1      |
| **`form`**        | Form submissions with validation |
| **`command`**     | Button clicks, non-form actions  |

# Form Modal Reset Pattern

When using `form` remote functions inside modals, validation issues persist after the modal closes. This is a known SvelteKit limitation (see [#15054](https://github.com/sveltejs/kit/issues/15054), [#14210](https://github.com/sveltejs/kit/issues/14210)).

**Solution:** Use `.for(id)` with a unique ID that changes each time the modal opens:

```svelte
import { untrack } from 'svelte';
let formInstanceId = $state(crypto.randomUUID());
$effect(() => {
  if (open) {
    // Use untrack to avoid infinite loop
    untrack(() => {
      formInstanceId = crypto.randomUUID();
    });
  }
});
const currentForm = $derived(myForm.for(formInstanceId));
<form {...currentForm.enhance(...)}>
  <!-- Use currentForm.fields.X.issues() for validation errors -->
</form>
```

## For update forms with existing IDs:

```ts
const currentUpdateForm = $derived(myForm.for(`${item.id}-${formInstanceId}`));
```

## Key points:

- `untrack()` prevents the effect from re-triggering when updating state.
- Each modal open creates a fresh form instance with cleared validation.
- Use crypto.randomUUID() for collision-free IDs (or some UUID specific library)

## Tour on-boards

Use https://flowbite-svelte.com/docs/extend/tour from Flowbite Svelte when asked to create onboarding. Remeber that the onboard should be per page, and with a button or something to be re-activated if needed!

## Wizard steps:

If found useful for the wizard creation, you can use the step indicator from Flowbite Svelte in https://flowbite-svelte.com/docs/extend/step-indicator . But do not stick on this if not fit into other ruling!