<script lang="ts">
	import { CircleHelp, X } from '@lucide/svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	interface Props {
		orderNumber: number;
		saving: boolean;
		inventoryNotice?: boolean;
		onClose: () => void;
	}

	let { orderNumber, saving, inventoryNotice = true, onClose }: Props = $props();

	const notice = $derived(
		`Los cambios se registrarán en auditoría.${inventoryNotice ? ' Artículos nuevos consumirán inventario.' : ''}`
	);
</script>

<header
	class="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-2.5 dark:border-slate-700"
>
	<div class="flex min-w-0 items-center gap-1.5">
		<h2 class="truncate text-lg font-bold text-brand-navy dark:text-white">
			Modificar Orden #{String(orderNumber).padStart(4, '0')}
		</h2>
		{#snippet noticeTrigger({ props }: { props: Record<string, unknown> })}
			<button
				{...props}
				type="button"
				aria-label="Más información"
				class="inline-flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-navy focus-visible:ring-2 focus-visible:ring-brand-blue/30 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
			>
				<CircleHelp size={16} />
			</button>
		{/snippet}
		<TriggerTooltip text={notice} side="bottom" trigger={noticeTrigger} />
	</div>
	<button
		type="button"
		onclick={onClose}
		disabled={saving}
		aria-label="Cerrar"
		class="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-200 text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 max-sm:h-10 max-sm:w-10 dark:border-red-900/60 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300"
	>
		<X class="h-5 w-5" />
	</button>
</header>
