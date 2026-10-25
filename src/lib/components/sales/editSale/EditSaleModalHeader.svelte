<script lang="ts">
	import { X } from '@lucide/svelte';
	import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';

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
	class="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700"
>
	<div class="flex min-w-0 items-center gap-1.5">
		<h2 class="truncate text-lg font-bold text-brand-navy dark:text-white">
			Modificar Orden #{String(orderNumber).padStart(4, '0')}
		</h2>
		<InfoTooltip text={notice} />
	</div>
	<button
		type="button"
		onclick={onClose}
		disabled={saving}
		aria-label="Cerrar"
		class="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 max-sm:h-10 max-sm:w-10 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
	>
		<X class="h-5 w-5" />
	</button>
</header>
