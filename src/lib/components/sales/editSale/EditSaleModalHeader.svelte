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

	const orderId = $derived(`#${String(orderNumber).padStart(4, '0')}`);
</script>

<header
	class="flex shrink-0 items-center gap-2.5 border-b border-outline-variant/60 px-5 py-2.5 dark:border-slate-700"
>
	<h2 class="truncate text-[16px] font-bold tracking-[-0.01em] text-brand-navy dark:text-white">
		Modificar orden
	</h2>
	<span
		class="shrink-0 rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs font-bold text-brand-blue-dark dark:bg-brand-blue/20 dark:text-brand-blue-light"
	>
		{orderId}
	</span>

	{#snippet noticeTrigger({ props }: { props: Record<string, unknown> })}
		<button
			{...props}
			type="button"
			aria-label="Más información"
			class="inline-flex h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-surface-container hover:text-brand-navy focus-visible:ring-2 focus-visible:ring-brand-blue/30 focus-visible:outline-none dark:hover:bg-slate-800 dark:hover:text-white"
		>
			<CircleHelp size={15} />
		</button>
	{/snippet}
	<TriggerTooltip text={notice} side="bottom" trigger={noticeTrigger} />

	<button
		type="button"
		onclick={onClose}
		disabled={saving}
		aria-label="Cerrar"
		class="ml-auto flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:border-red-900/60 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300"
	>
		<X class="h-[18px] w-[18px]" />
	</button>
</header>
