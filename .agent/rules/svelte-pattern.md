---
trigger: always_on
---

# Eslint rules
Try to follow our eslint rules, because we can avoid most of them. If it's too complicate to solve, ask the user. If you can solve it, do it. Only try to solve these listed rules, if there are new ones that cannot be solve, it's too complicate or make the code complex, ask the user.

## Listed rules

- `no-navigation-without-resolve` rule: If the url/link is external you can use `rel="external"`. If it's app internal, you should use the Svelte Typing. You can import `Pathname` from `$app/types` on somecases, but if it's too specific you should use the right typing like `/sales` or whatever you wanted to make.

- `svelte/require-each-key` rule: when using `each` block, we should add the ID for the elements.

- `state_referenced_locally` svelte rule: This is a svelte rule/warning. This should treated carefuly, but if it's happening from a `+page.svelte` file, exactly coming after destructuring the `$props.data` you should the `untrack` (since data will not do a reactive change). OR when use `data` from the `$props`, generally you should destructure the values use from `data` so can use `untrack`. Only for this case, other scenarios should be handled differently and in a intelligent way after user decision.

# Load initial data

- To load initial data for pages, use a `+page.server.ts` file for a `+page.svelte` file to load the initial data needed.
- Use a `load` function on the `+page.server.ts` (a `PageServerLoad` type function) to load that initial data. Do not use `$effect` or `onMount` hook in the pages to load this initial data.
- To future loads (as filtering and other stuff), you can use the remote functions. ONLY use the `PageServerLoad` function for the initial data.

# Manejo de Errorres con remote functions

- El server con las remote functions puede realizar las validaciones con valibot, pero es necesario hacer client-side validations para poder mostrar correctamente los errores al usuario.
- Usa toast si es posible. En el caso de que use modal, entonces puedes usar el toast y un pequeño recuadro en el modal (ya que el toast tiende a quedarse de fondo)
- Cuando se use el `try/catch` block y se use el toast para mostrar que hubo un error de manera user friendly, de ser posible, en interacciones, hacer un `console.error` con el `error` obtenido para future debugging.

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