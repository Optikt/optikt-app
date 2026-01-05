<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { resolve } from '$app/paths';

	let { userName }: { userName: string } = $props();

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
		<a
			href={resolve('/sales/new')}
			class="flex items-center gap-2 rounded-lg border-none bg-linear-to-br from-brand-blue to-brand-navy px-4 py-2.5 font-semibold text-white no-underline shadow-[0_4px_14px_rgba(78,181,197,0.4)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(78,181,197,0.5)]"
		>
			<Plus size={20} />
			Nueva Venta
		</a>
	</div>
</header>
