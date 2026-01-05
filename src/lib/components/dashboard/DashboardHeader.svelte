<script lang="ts">
	import { Plus } from '@lucide/svelte';

	let { userName, onNewSale }: { userName: string; onNewSale?: () => void } = $props();

	const greeting = $derived(() => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Buenos días';
		if (hour < 18) return 'Buenas tardes';
		return 'Buenas noches';
	});
</script>

<header class="mb-8 flex flex-wrap items-start justify-between gap-4">
	<div>
		<h1 class="m-0 text-[1.75rem] font-bold text-brand-navy sm:text-xl">
			{greeting()}, <span class="text-gradient">{userName}</span>
		</h1>
		<p class="mt-1 text-slate-500">Bienvenido al sistema de gestión Optikt</p>
	</div>
	<div class="flex items-center gap-4">
		<button
			onclick={onNewSale}
			class="flex items-center gap-2 rounded-lg border-none bg-linear-to-br from-brand-blue to-brand-navy px-4 py-2.5 font-semibold text-white shadow-[0_4px_14px_rgba(78,181,197,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(78,181,197,0.5)] disabled:cursor-not-allowed disabled:opacity-60"
		>
			<Plus size={20} />
			Nueva Venta
		</button>
	</div>
</header>
