<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.png';
	import { Toaster } from 'svelte-sonner';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<Toaster position="top-center" expand richColors closeButton />
{@render children()}
