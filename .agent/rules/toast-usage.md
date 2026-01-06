---
trigger: always_on
---

# svelte-sonner - Toasts

## Usage

Render the toaster in the root of your app.

```svelte
<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';
	import { Toaster } from 'svelte-sonner';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<Toaster position="top-center" expand richColors closeButton />
{@render children()}
```

Then use it

```
<button onclick={() => toast('My first toast')}>
  Give me a toast
</button>
```

## Types

You can customize the type of toast you want to render, and pass an options object as the second argument.

### Default

```svelte
toast('Event has been created')
```

### Description

```svelte
toast.message('Event has been created', {
    description: 'Monday, January 3rd at 6:00pm',
})
```

### Success

```svelte
toast.success('Event has been created')
```

### Info

```svelte
toast.info('Event will be created')
```

### Warning

```svelte
toast.warning('Event has warnings')
```

### Error

```svelte
toast.error('Event has not been created')
```

### Action

```svelte
toast('Event has been created', {
  action: {
    label: 'Undo',
    onClick: () => console.log('Undo')
  },
})
```

### Promise

```svelte
const promise = new Promise((resolve, reject) => setTimeout(() => {
  if (Math.random() > 0.5) {
    resolve({ name: 'Svelte Sonner' });
  } else {
    reject();
  }
}, 1500));

toast.promise(promise, {
  loading: 'Loading...',
  success: (data) => {
    return data.name +  " toast has been added";
  },
  error: 'Error... :( Try again!',
});
```

### Custom

```svelte
import Custom from './Custom.svelte' toast(Custom)
```

## Position

Swipe direction changes depending on the position defining it on the toaster:

```svelte
<Toaster position="top-right" />
```

Position can be `undefined | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'`

## Other

### Headless

```svelte
<script>
	import HeadlessToast from './HeadlessToast.svelte';

	toast.custom(HeadlessToast);

	// With props:
	toast.custom(HeadlessToast, {
		componentProps: {
			eventName: 'Louvre Museum'
		}
	});
</script>

<!-- ... -->

<Toaster />
```
