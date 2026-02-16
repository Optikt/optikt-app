# svelte-sonner — Toast Reference

Use this reference when implementing toast notifications with `svelte-sonner`.

## Setup

The Toaster is already rendered in the root layout:

```svelte
<Toaster position="top-center" expand richColors closeButton />
```

## Usage

```ts
import { toast } from 'svelte-sonner';
```

### Basic Types

```ts
toast('Default message');
toast.success('Event created');
toast.error('Something failed');
toast.info('New information');
toast.warning('Be careful');
```

### With Description & Icon

```ts
toast('Event created', {
  description: 'Monday, January 3rd at 6:00pm',
  icon: MyIconComponent
});
```

### Action Toast

```ts
toast('Event created', {
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo')
  }
});
```

### Promise Toast

```ts
toast.promise(() => new Promise((resolve) => setTimeout(resolve, 2000)), {
  loading: 'Loading',
  success: 'Success',
  error: 'Error'
});

// With result data
toast.promise(promise, {
  loading: 'Loading...',
  success: (data) => `${data.name} has been added!`,
  error: 'Error'
});
```

### Custom Component

```ts
toast(CustomComponent);           // styled
toast.custom(HeadlessComponent);  // unstyled/headless
```

### Update a Toast

```ts
const toastId = toast('Initial message');
toast.success('Updated message', { id: toastId });
```

### Dismiss

```ts
const toastId = toast('Message');
toast.dismiss(toastId);  // dismiss specific
toast.dismiss();          // dismiss all
```

### Duration

```ts
toast('Message', { duration: 10000 });          // 10 seconds
toast('Persistent', { duration: Number.POSITIVE_INFINITY }); // stays forever
```

### Callbacks

```ts
toast('Event created', {
  onDismiss: (t) => console.log(`Toast ${t.id} dismissed`),
  onAutoClose: (t) => console.log(`Toast ${t.id} auto-closed`)
});
```

## Tailwind Styling

```ts
toast('Hello', {
  unstyled: true,
  classes: {
    toast: 'bg-blue-400',
    title: 'text-red-400',
    description: 'text-red-400',
    actionButton: 'bg-zinc-400',
    cancelButton: 'bg-orange-400',
    closeButton: 'bg-lime-400'
  }
});
```

## Project Convention

- Use `toast` for user-friendly error feedback in `try/catch` blocks
- Always add `console.error(error)` alongside toast errors for debugging
- In modals, combine toast with a small error box (toasts appear behind modals)
