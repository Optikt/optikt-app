<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	interface Props {
		showPrimaryAction?: boolean;
	}

	let { showPrimaryAction = true }: Props = $props();
</script>

<header class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
	<div>
		<p class="mb-0 text-xs font-semibold tracking-widest text-slate-400 uppercase">
			Panel de Control
		</p>
		<h1 class="font-heading m-0 text-2xl font-bold text-brand-navy sm:text-3xl">
			Centro de Operaciones
		</h1>
	</div>
	{#if showPrimaryAction}
		<a
			href={resolve('/sales/new')}
			class="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-gold px-5 text-sm font-bold text-brand-navy no-underline shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md sm:w-auto"
		>
			<Plus size={18} />
			NUEVA VENTA
		</a>
	{/if}
</header>
