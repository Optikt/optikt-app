<script lang="ts">
	import type { ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';
	import CalcHeader from './currencyCalc/CalcHeader.svelte';
	import CalcResults from './currencyCalc/CalcResults.svelte';
	import CustomRateSection from './currencyCalc/CustomRateSection.svelte';
	import {
		buildCustomVirtualRate,
		buttonLabel,
		computeConversions,
		CUSTOM_SOURCE_KEY,
		getBsCurrencyLabel,
		SIX_HOURS_MS,
		type SavedCustomRate
	} from './currencyCalc/currencyCalcUtils';

	interface Props {
		open: boolean;
		snapshot: ExchangeRatesSnapshot | null;
		refreshing?: boolean;
		onClose: () => void;
		onRefresh: (event: MouseEvent) => void;
	}

	let { open = $bindable(), snapshot, refreshing = false, onClose, onRefresh }: Props = $props();

	const rates = $derived(snapshot?.rates ?? []);

	let baseCurrency = $state('bs');
	let rawInput = $state('');

	const amount = $derived(parseFloat(rawInput) || 0);

	let showCustomInput = $state(false);
	let customRateInput = $state('');
	let customLabelInput = $state('');
	let savedRate = $state<SavedCustomRate | null>(null);

	function loadSavedRate() {
		try {
			const raw = localStorage.getItem('calc-custom-rate');
			if (raw) savedRate = JSON.parse(raw);
		} catch {
			/* ignore */
		}
	}

	function saveCustomRate(rate: SavedCustomRate) {
		savedRate = rate;
		localStorage.setItem('calc-custom-rate', JSON.stringify(rate));
	}

	function clearCustomRate() {
		if (baseCurrency === CUSTOM_SOURCE_KEY) baseCurrency = 'bs';
		savedRate = null;
		localStorage.removeItem('calc-custom-rate');
	}

	function applyCustomRate() {
		const val = parseFloat(customRateInput);
		if (!val || val <= 0) return;
		saveCustomRate({ value: val, label: customLabelInput.trim(), timestamp: Date.now() });
		showCustomInput = false;
		customRateInput = '';
		customLabelInput = '';
	}

	function dismissCustomStale() {
		if (savedRate) saveCustomRate({ ...savedRate, timestamp: Date.now() });
	}

	const isCustomStale = $derived(
		savedRate ? Date.now() - savedRate.timestamp > SIX_HOURS_MS : false
	);

	const customVirtualRate = $derived(buildCustomVirtualRate(savedRate, isCustomStale));

	const allRates = $derived(customVirtualRate ? [...rates, customVirtualRate] : rates);

	$effect(() => {
		loadSavedRate();
	});

	const conversions = $derived(
		computeConversions(allRates, baseCurrency, amount, savedRate?.label)
	);

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

{#if open}
	<div
		role="presentation"
		class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
		onkeydown={handleKeydown}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="calc-modal-title"
			class="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
		>
			<CalcHeader {refreshing} {onRefresh} {onClose} />

			<!-- Input section -->
			<div class="px-5 pt-4 pb-3">
				<!-- Base currency selector -->
				<div class="mb-3 flex flex-wrap gap-1.5">
					<button
						type="button"
						class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {baseCurrency ===
						'bs'
							? 'bg-brand-navy text-white'
							: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
						onclick={() => (baseCurrency = 'bs')}
					>
						Bs
					</button>
					{#each allRates as rate (rate.sourceKey)}
						<button
							type="button"
							class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {baseCurrency ===
							rate.sourceKey
								? 'bg-brand-navy text-white'
								: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
							onclick={() => (baseCurrency = rate.sourceKey)}
						>
							{buttonLabel(rate.sourceKey, savedRate?.label)}
						</button>
					{/each}
				</div>

				<!-- Amount input -->
				<div class="relative">
					<input
						type="number"
						min="0"
						step="any"
						bind:value={rawInput}
						placeholder="0.00"
						class="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-14 pl-4 font-mono text-xl font-bold text-brand-navy placeholder:font-normal placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
					/>
					<span
						class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-slate-400"
					>
						{getBsCurrencyLabel(baseCurrency, allRates, savedRate?.label)}
					</span>
				</div>
			</div>

			<CustomRateSection
				{savedRate}
				{isCustomStale}
				bind:showCustomInput
				bind:customRateInput
				bind:customLabelInput
				onApply={applyCustomRate}
				onDismissStale={dismissCustomStale}
				onClear={clearCustomRate}
			/>

			<CalcResults {allRates} {conversions} {isCustomStale} onDismissStale={dismissCustomStale} />
		</div>
	</div>
{/if}
