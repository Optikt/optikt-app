<script lang="ts">
	import { CircleDollarSign, Copy } from '@lucide/svelte';

	let open = $state(false);

	const rates = [
		{ label: 'USD (BCV)', value: '474.05', suffix: 'Bs' },
		{ label: 'EUR (BCV)', value: '550.89', suffix: 'Bs' },
		{ label: 'USDT (Binance)', value: '625', suffix: 'Bs' }
	] as const;

	function toggle() {
		open = !open;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-exchange-rates]')) {
			open = false;
		}
	}
</script>

<svelte:document onclick={handleClickOutside} />

<div class="relative" data-exchange-rates>
	<button
		type="button"
		class="rounded p-2 text-white/70 transition-colors hover:bg-white/10"
		onclick={toggle}
		title="Tasas de Cambio"
	>
		<CircleDollarSign size={20} />
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg"
		>
			<div class="border-b border-slate-100 px-4 py-3">
				<h3 class="text-sm font-semibold text-brand-navy">Tasas de Cambio</h3>
			</div>
			<div class="divide-y divide-slate-100 p-2">
				{#each rates as rate (rate.label)}
					<div class="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-slate-50">
						<span class="text-sm text-slate-600">{rate.label}</span>
						<div class="flex items-center gap-2">
							<span class="font-mono text-sm font-semibold text-brand-navy">
								{rate.value}
								<span class="text-xs font-normal text-slate-400">{rate.suffix}</span>
							</span>
							<button
								type="button"
								class="rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
								title="Copiar valor"
								onclick={(e) => e.stopPropagation()}
							>
								<Copy size={12} />
							</button>
						</div>
					</div>
				{/each}
			</div>
			<div class="border-t border-slate-100 px-4 py-2.5">
				<p class="text-xs text-slate-400">Valores actualizados hace 2m</p>
			</div>
		</div>
	{/if}
</div>
