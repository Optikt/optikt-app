<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { resolve } from '$app/paths';
</script>

<header class="mb-4 flex items-end justify-between gap-2">
	<div>
		<p class="mb-0 text-xs font-semibold tracking-widest text-slate-400 uppercase">
			Panel de Control
		</p>
		<h1 class="font-heading m-0 text-3xl font-bold text-brand-navy">Centro de Operaciones</h1>
	</div>
	<a
		href={resolve('/sales/new')}
		class="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-navy no-underline shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md"
	>
		<Plus size={18} />
		NUEVA VENTA
	</a>
</header>
