<script lang="ts">
	import { AlertTriangle, DollarSign } from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import SegmentedToggle from '$lib/components/ui/SegmentedToggle.svelte';
	import { PurchaseDiscountType, PurchaseSourceCurrency } from '$lib/shared/enums';
	import {
		sourceCurrencyRequiresRateToVes,
		SOURCE_TO_CURRENCY_CODE
	} from '$lib/shared/purchaseOrderCurrencies';
	import { inputClass } from '../purchaseFieldStyles';
	import FieldWrapper from './FieldWrapper.svelte';

	interface Props {
		sourceCurrency: string;
		bcvRate: number;
		sourceRateToVes: number;
		settlementCurrency: string;
		settlementManuallyChanged: boolean;
		discountType: PurchaseDiscountType;
		discountValue: number;
		discountNotes: string;
		onSourceCurrencyChange?: (value: string) => void;
		onBcvRateChange?: (value: number) => void;
		onSourceRateToVesChange?: (value: number) => void;
		onSettlementManuallyChangedChange?: (value: boolean) => void;
		onSettlementCurrencyChange?: (value: string) => void;
		onDiscountTypeChange?: (value: PurchaseDiscountType) => void;
		onDiscountValueChange?: (value: number) => void;
		onDiscountNotesChange?: (value: string) => void;
		settlementCurrencyConflict?: boolean;
	}

	let {
		sourceCurrency = $bindable(),
		bcvRate = $bindable(),
		sourceRateToVes = $bindable(),
		settlementCurrency,
		settlementManuallyChanged,
		discountType = $bindable(),
		discountValue = $bindable(),
		discountNotes = $bindable(),
		onSourceCurrencyChange,
		onBcvRateChange,
		onSourceRateToVesChange,
		onSettlementManuallyChangedChange,
		onSettlementCurrencyChange,
		onDiscountTypeChange,
		onDiscountValueChange,
		onDiscountNotesChange,
		settlementCurrencyConflict = false
	}: Props = $props();

	const CURRENCY_OPTIONS = [
		{ value: PurchaseSourceCurrency.USD, label: 'USD (BCV)' },
		{ value: PurchaseSourceCurrency.VES, label: 'Bolívares' },
		{ value: PurchaseSourceCurrency.EUR, label: 'Euro (€)' },
		{ value: PurchaseSourceCurrency.USDT, label: 'USDT' },
		{ value: PurchaseSourceCurrency.PAYPAL, label: 'USD (PayPal)' }
	];

	const SETTLEMENT_OPTIONS = [
		{ value: 'USD_BCV', label: 'USD (BCV)' },
		{ value: 'VES', label: 'Bolívares' },
		{ value: 'EUR_BCV', label: 'Euro (€)' },
		{ value: 'USDT', label: 'USDT' },
		{ value: 'USD_PAYPAL', label: 'USD (PayPal)' }
	];

	const currencyLabels: Record<string, string> = {
		[PurchaseSourceCurrency.EUR]: 'EUR',
		[PurchaseSourceCurrency.USDT]: 'USDT',
		[PurchaseSourceCurrency.PAYPAL]: 'USD PayPal'
	};

	const showSecondRate = $derived(sourceCurrencyRequiresRateToVes(sourceCurrency));
	const secondRateLabelText = $derived(`Tasa ${currencyLabels[sourceCurrency] ?? ''}/Bs`);
	const discountIsActive = $derived(discountType !== PurchaseDiscountType.NONE);
	const valueSuffix = $derived(discountType === PurchaseDiscountType.PERCENT ? '%' : '$');

	function handleSourceCurrencyChange(e: Event) {
		const val = (e.target as HTMLSelectElement).value;
		sourceCurrency = val;
		onSourceCurrencyChange?.(val);
	}

	function handleDiscountTypeChange(val: string) {
		const next = val as PurchaseDiscountType;
		discountType = next;
		onDiscountTypeChange?.(next);
		if (next === PurchaseDiscountType.NONE) {
			discountValue = 0;
			discountNotes = '';
			onDiscountValueChange?.(0);
			onDiscountNotesChange?.('');
		}
	}

	function handleToggleSettlementOverride() {
		const next = !settlementManuallyChanged;
		settlementManuallyChanged = next;
		onSettlementManuallyChangedChange?.(next);
		if (!next) {
			const auto =
				SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ??
				'USD_BCV';
			settlementCurrency = auto;
			onSettlementCurrencyChange?.(auto);
		}
	}
</script>

<div class="@container rounded-2xl bg-surface-container-low p-4 ring-1 ring-outline-variant/20">
	<h2 class="text-sm font-bold tracking-[0.16em] text-brand-navy uppercase mb-4">
		<DollarSign class="mr-2 inline-block h-4 w-4 text-brand-gold-dark" />
		Datos financieros
	</h2>

	<div class="space-y-4">
		<!-- Base de precios (SELECT) -->
		<FieldWrapper label="Base de precios">
			<select
				value={sourceCurrency}
				onchange={handleSourceCurrencyChange}
				class="max-w-xs w-1/3 rounded-lg border-none bg-surface-container-high px-3 py-2 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			>
				{#each CURRENCY_OPTIONS as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</FieldWrapper>

		<div class="grid grid-cols-1 @sm:grid-cols-2 gap-4">
			<FieldWrapper label="Tasa USD BCV/Bs" required>
				<input
					type="number"
					step="0.01"
					min="0"
					value={bcvRate}
					oninput={(e) => {
						bcvRate = Number((e.target as HTMLInputElement).value);
						onBcvRateChange?.(bcvRate);
					}}
					class={inputClass}
					placeholder="0"
				/>
			</FieldWrapper>
			<div use:autoAnimate>
				{#if showSecondRate}
					<FieldWrapper label={secondRateLabelText} required>
						<input
							type="number"
							step="0.01"
							min="0"
							value={sourceRateToVes}
							oninput={(e) => {
								sourceRateToVes = Number((e.target as HTMLInputElement).value);
								onSourceRateToVesChange?.(sourceRateToVes);
							}}
							class={inputClass}
							placeholder="0"
						/>
					</FieldWrapper>
				{/if}
			</div>
		</div>

		<!-- Moneda de obligación (hidden by default) -->
		<label class="flex items-center gap-2 cursor-pointer select-none pt-1">
			<input
				type="checkbox"
				checked={settlementManuallyChanged}
				onclick={handleToggleSettlementOverride}
				class="h-4 w-4 rounded border-outline-variant/30 text-brand-navy focus:ring-brand-navy"
			/>
			<span class="text-xs text-on-surface-variant">
				El proveedor cobra en una moneda distinta a la del documento
			</span>
		</label>

		<div use:autoAnimate>
			{#if settlementManuallyChanged}
				<select
					value={settlementCurrency}
					onchange={(e) => {
						settlementCurrency = (e.target as HTMLSelectElement).value;
						onSettlementCurrencyChange?.(settlementCurrency);
					}}
					class="max-w-xs w-full rounded-lg border-none bg-surface-container-high px-3 py-2 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
				>
					{#each SETTLEMENT_OPTIONS as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				{#if settlementCurrencyConflict}
					<div
						class="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
					>
						<AlertTriangle class="h-4 w-4 shrink-0 mt-px" />
						<span>
							La moneda de obligación es distinta a la moneda de factura. Revisá que el proveedor
							realmente exija otra moneda.
						</span>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Divider -->
		<hr class="border-outline-variant/50 my-4" />

		<!-- Descuento -->
		<FieldWrapper label="Tipo de descuento">
			<SegmentedToggle
				value={discountType}
				options={[
					{ value: PurchaseDiscountType.NONE, label: 'Sin descuento' },
					{ value: PurchaseDiscountType.PERCENT, label: 'Porcentaje' },
					{ value: PurchaseDiscountType.AMOUNT, label: 'Monto fijo' }
				]}
				onchange={handleDiscountTypeChange}
			/>
		</FieldWrapper>

		<div use:autoAnimate>
			{#if discountIsActive}
				<div class="grid grid-cols-1 @sm:grid-cols-2 gap-4">
					<FieldWrapper label="Valor del descuento">
						<div class="relative">
							<input
								type="number"
								min="0"
								step="0.01"
								max={discountType === PurchaseDiscountType.PERCENT ? 100 : undefined}
								value={discountValue}
								oninput={(e) => {
									discountValue = Number((e.target as HTMLInputElement).value);
									onDiscountValueChange?.(discountValue);
								}}
								class={`${inputClass} pr-10`}
								placeholder="0"
							/>
							<span
								class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-on-surface-variant"
							>
								{valueSuffix}
							</span>
						</div>
					</FieldWrapper>
					<FieldWrapper label="Nota del descuento">
						<input
							type="text"
							value={discountNotes}
							oninput={(e) => {
								discountNotes = (e.target as HTMLInputElement).value;
								onDiscountNotesChange?.(discountNotes);
							}}
							class={inputClass}
							placeholder="Motivo o referencia (opcional)"
						/>
					</FieldWrapper>
				</div>
			{:else}
				<p class="text-xs text-on-surface-variant/60 italic">
					Sin descuento aplicado a esta compra
				</p>
			{/if}
		</div>
	</div>
</div>
