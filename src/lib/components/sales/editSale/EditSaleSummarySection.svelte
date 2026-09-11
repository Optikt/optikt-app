<script lang="ts">
	import { Calculator } from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';

	interface Props {
		previewSubtotal: number;
		previewGlobalDiscount: number;
		previewTotal: number;
		removedCount: number;
	}

	let { previewSubtotal, previewGlobalDiscount, previewTotal, removedCount }: Props = $props();
</script>

<section
	class="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50"
>
	<div class="mb-4 flex items-center gap-2">
		<Calculator class="h-4 w-4 text-brand-blue" />
		<h3 class="text-sm font-bold text-brand-navy dark:text-white">Resumen</h3>
	</div>
	<div class="space-y-2 text-sm">
		<div class="flex justify-between">
			<span class="text-slate-600 dark:text-slate-400">Subtotal</span>
			<span class="font-semibold text-slate-800 dark:text-white">
				{formatPrice(previewSubtotal)}
			</span>
		</div>
		{#if previewGlobalDiscount > 0}
			<div class="flex justify-between">
				<span class="text-slate-600 dark:text-slate-400">Descuento</span>
				<span class="font-semibold text-slate-800 dark:text-white">
					-{formatPrice(previewGlobalDiscount)}
				</span>
			</div>
		{/if}
		<div class="flex justify-between">
			<span class="font-bold text-slate-800 dark:text-white">Total</span>
			<span class="font-bold text-slate-800 dark:text-white">
				{formatPrice(previewTotal)}
			</span>
		</div>
		{#if removedCount > 0}
			<div class="flex justify-between text-red-600 dark:text-red-400">
				<span>Artículos eliminados</span>
				<span class="font-semibold">{removedCount}</span>
			</div>
		{/if}
	</div>
</section>
