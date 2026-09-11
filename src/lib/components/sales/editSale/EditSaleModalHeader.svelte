<script lang="ts">
	import { X } from '@lucide/svelte';

	interface Props {
		orderNumber: number;
		saving: boolean;
		onClose: () => void;
	}

	let { orderNumber, saving, onClose }: Props = $props();
</script>

<header
	class="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700"
>
	<div class="min-w-0 flex-1">
		<h2 class="truncate text-lg font-bold text-brand-navy dark:text-white">
			Modificar Orden #{String(orderNumber).padStart(4, '0')}
		</h2>
		<p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
			Los cambios se registrarán en auditoría. Artículos nuevos consumirán inventario.
		</p>
	</div>
	<button
		type="button"
		onclick={onClose}
		disabled={saving}
		class="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 max-sm:h-10 max-sm:w-10 dark:hover:bg-slate-800 dark:hover:text-slate-300"
	>
		<X class="h-5 w-5" />
	</button>
</header>
