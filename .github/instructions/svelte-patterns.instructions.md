---
applyTo: '**/*.svelte,**/*.ts,**/+page.server.ts,**/+layout.server.ts'
---

# Svelte & SvelteKit Patterns

## ESLint Rules to Follow

- **`no-navigation-without-resolve`**: For external URLs use `rel="external"`. For app-internal links, use Svelte typing — import `Pathname` from `$app/types` or use a literal type like `'/sales'`.
- **`svelte/require-each-key`**: Always add a key (ID) when using `{#each}` blocks.
- **`state_referenced_locally`**: Handle carefully. In `+page.svelte` files, when destructuring `$props().data`, use `untrack` since data won't change reactively. Destructure specific values from `data` and wrap with `untrack`. Other scenarios need case-by-case judgment.

## Loading Initial Data

- Use `+page.server.ts` with a `load` function (`PageServerLoad`) to load initial data for `+page.svelte`
- **Never** use `$effect` or `onMount` in pages for initial data loading
- For subsequent loads (filtering, etc.), use remote functions. Only use `PageServerLoad` for the initial data.

## Error Handling with Remote Functions

- Server-side validation happens via valibot in remote functions, but **client-side validation is required** to show errors correctly to users
- Use toasts for error feedback. In modals, use both a toast and a small error box (toasts tend to appear behind modals)
- In `try/catch` blocks with toast error feedback, always add `console.error(error)` for debugging

## Component Self-Containment Rule

If a component performs a specific action (toggle, delete, reactivate), it should import and call the remote function internally. Pass only the data needed and emit events (`onSuccess`, `onError`) for parent coordination.

- **Generic components** (like `ConfirmModal`): take callbacks
- **Domain-specific components**: call their own remotes
- For form inputs, use `FormInput` (includes Labels + Inputs) and `FormTextarea`

## Remote Function Usage

| Function          | Use Case                         |
| ----------------- | -------------------------------- |
| **`query`**       | Read data (GET operations)       |
| **`query.batch`** | Multiple queries, avoid N+1      |
| **`form`**        | Form submissions with validation |
| **`command`**     | Button clicks, non-form actions  |

## Form Modal Reset Pattern

When using `form` remote functions inside modals, validation issues persist after close (known SvelteKit limitation).

**Solution:** Use `.for(id)` with a unique ID that changes each time the modal opens:

```svelte
<script lang="ts">
  import { untrack } from 'svelte';

  let formInstanceId = $state(crypto.randomUUID());

  $effect(() => {
    if (open) {
      untrack(() => {
        formInstanceId = crypto.randomUUID();
      });
    }
  });

  const currentForm = $derived(myForm.for(formInstanceId));
</script>

<form {...currentForm.enhance(...)}>
  <!-- Use currentForm.fields.X.issues() for validation errors -->
</form>
```

For update forms with existing IDs:

```ts
const currentUpdateForm = $derived(myForm.for(`${item.id}-${formInstanceId}`));
```

Key points:

- `untrack()` prevents the effect from re-triggering when updating state
- Each modal open creates a fresh form instance with cleared validation
- Use `crypto.randomUUID()` for collision-free IDs
