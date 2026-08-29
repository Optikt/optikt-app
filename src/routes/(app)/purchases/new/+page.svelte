<script lang="ts">
	import { NewPurchaseOrderForm } from '$lib/components/purchases';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Nueva Orden de Compra - Optikt</title>
</svelte:head>

<NewPurchaseOrderForm suppliers={data.suppliers} />
