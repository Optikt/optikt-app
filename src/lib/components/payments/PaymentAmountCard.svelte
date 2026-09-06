<script lang="ts">
	import { PaymentRateInput } from '$lib/components/ui';
	import type { PaymentMethod } from '$lib/shared/enums';

	interface Props {
		kind: 'sale' | 'purchase';
		rail: PaymentMethod | null;
		variant?: 'default' | 'drawer';
		paymentDate: string;
		usdFieldValue: string;
		nativeFieldValue: string;
		nativeLabel: string;
		nativePrefix: string;
		debtBalanceUsd: number;
		resolvedAmountUsd: number;
		resolvedUsdDisplay: string;
		rateContextLine: string;
		bcvRateInput: string;
		defaultBcvRateInput: string;
		needsSpecificRate: boolean;
		specificRateLabel: string;
		specificRateInput: string;
		autoSpecificRate: number;
		onDateInput: (value: string) => void;
		onUsdInput: (e: Event) => void;
		onNativeInput: (e: Event) => void;
		onBcvRateInput: (value: string) => void;
		onSpecificRateInput: (value: string) => void;
		onUseRemainingBalance: () => void;
	}

	let {
		kind,
		rail,
		variant = 'default',
		paymentDate,
		usdFieldValue,
		nativeFieldValue,
		nativeLabel,
		nativePrefix,
		debtBalanceUsd,
		resolvedAmountUsd,
		resolvedUsdDisplay,
		rateContextLine,
		bcvRateInput,
		defaultBcvRateInput,
		needsSpecificRate,
		specificRateLabel,
		specificRateInput,
		autoSpecificRate,
		onDateInput,
		onUsdInput,
		onNativeInput,
		onBcvRateInput,
		onSpecificRateInput,
		onUseRemainingBalance
	}: Props = $props();

	let amountInputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (variant !== 'drawer') return;
		if (rail && amountInputEl) amountInputEl.focus();
	});
</script>

{#if rail}
	<div class="space-y-3">
		<div>
			<label
				for="pay-date"
				class="mb-1.5 block text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
			>
				Fecha
			</label>
			<input
				id="pay-date"
				type="date"
				value={paymentDate}
				oninput={(e) => onDateInput(e.currentTarget.value)}
				max="9999-12-31"
				class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 text-sm font-medium text-on-surface focus:border-brand-blue focus:outline-none"
			/>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<div class="space-y-1.5">
				<div class="flex items-center justify-between gap-2">
					<label
						for="pay-usd"
						class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
					>
						USD BCV
					</label>
					{#if kind === 'sale'}
						<button
							type="button"
							onclick={onUseRemainingBalance}
							class="shrink-0 text-[10px] font-semibold text-warning transition-colors hover:text-warning"
						>
							Usar saldo
						</button>
					{/if}
				</div>
				<div class="relative">
					<span class="absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-base text-outline"
						>$</span
					>
					<input
						id="pay-usd"
						type="number"
						value={usdFieldValue}
						oninput={onUsdInput}
						placeholder={debtBalanceUsd > 0 ? debtBalanceUsd.toFixed(2) : '0.00'}
						step="0.01"
						min="0"
						class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest py-2.5 pr-3.5 pl-8 font-mono text-sm font-semibold text-on-surface transition-all duration-200 placeholder:text-outline focus:border-brand-blue focus:outline-none"
					/>
				</div>
			</div>

			<div class="flex flex-col space-y-1.5">
				<label
					for="pay-native"
					class="text-[11px] font-semibold tracking-[0.18em] text-outline uppercase"
				>
					{nativeLabel}
				</label>
				<div class="relative">
					<span
						class="absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-sm font-semibold text-outline"
						>{nativePrefix}</span
					>
					<input
						id="pay-native"
						type="number"
						value={nativeFieldValue}
						oninput={onNativeInput}
						placeholder="0.00"
						step="0.01"
						min="0"
						bind:this={amountInputEl}
						class="w-full rounded-xl border border-brand-navy/20 bg-surface-container-low py-2.5 pr-3.5 pl-16 font-mono text-sm font-semibold text-on-surface ring-1 ring-brand-navy/10 transition-all duration-200 placeholder:text-outline focus:border-brand-blue focus:outline-none"
					/>
				</div>
			</div>
		</div>

		{#if resolvedAmountUsd > 0}
			<p class="text-xs text-on-surface-variant tabular-nums">
				≈ {resolvedUsdDisplay} USD BCV{#if rateContextLine}
					<span class="text-on-surface-variant/70"> · {rateContextLine}</span>
				{/if}
			</p>
		{/if}

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<PaymentRateInput
				label="Tasa BCV"
				value={bcvRateInput}
				oninput={onBcvRateInput}
				placeholder={defaultBcvRateInput || '0.00'}
				class={needsSpecificRate ? '' : 'sm:col-span-2'}
			/>
			{#if needsSpecificRate}
				<PaymentRateInput
					label={specificRateLabel}
					value={specificRateInput}
					oninput={onSpecificRateInput}
					placeholder={autoSpecificRate > 0 ? autoSpecificRate.toFixed(2) : '0.00'}
				/>
			{/if}
		</div>
	</div>
{/if}
