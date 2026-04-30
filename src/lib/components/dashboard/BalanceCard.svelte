<script lang="ts">
	import { Wallet, ArrowRight } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { formatPrice } from '$lib/utils';

	let { amount, count }: { amount: number; count: number } = $props();
</script>

<div
	class="glass-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
>
	<div class="flex items-center gap-4 sm:gap-5">
		<div
			class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gold/15 text-brand-gold-dark"
		>
			<Wallet size={26} />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
				Balance Pendiente Total
			</p>
			<p class="font-heading text-4xl font-bold text-brand-navy">
				{formatPrice(amount)}
			</p>
			{#if count > 0}
				<p class="mt-0.5 text-sm text-slate-400">
					{count} venta{count !== 1 ? 's' : ''} pendiente{count !== 1 ? 's' : ''}
				</p>
			{/if}
		</div>
	</div>
	<a
		href={resolve('/receivables')}
		class="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-6 py-3 text-sm font-semibold tracking-wide text-white uppercase no-underline shadow-sm transition-all hover:bg-brand-navy-light hover:shadow-md"
	>
		VER COBROS
		<ArrowRight size={16} />
	</a>
</div>
