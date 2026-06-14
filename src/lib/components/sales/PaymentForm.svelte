<script lang="ts">
	import {
		BadgeDollarSign,
		Building2,
		ChevronDown,
		ChevronUp,
		CreditCard,
		FileText,
		Pencil,
		Smartphone,
		WalletCards
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { nowUTC, toISODate } from '$lib/dates';
	import { addPayment } from '$lib/remote/sales.remote';
	import {
		getExchangeRateLabel,
		isBsPaymentMethod,
		PAYMENT_METHOD_LABELS,
		PaymentMethod
	} from '$lib/shared/enums';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import {
		calculatePaymentAmountFromUsdBcv,
		calculateUsdBcvFromPaymentAmount,
		getDefaultPaymentCalculationMode,
		type PaymentCalculationMode
	} from './paymentFormCalculations';
	import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';

	interface Props {
		saleId: string;
		remainingBcvUsd: number;
		bcvRate?: number;
		onPaymentAdded?: (paidAmount: number) => void;
	}

	interface ReferenceConfig {
		label: string;
		required: boolean;
		placeholder: string;
		helper?: string;
		fallbackValue?: string;
	}

	const BOLIVAR_METHODS: PaymentMethod[] = [
		PaymentMethod.PAGO_MOVIL_BS,
		PaymentMethod.TRANSFERENCIA_BS,
		PaymentMethod.PUNTO_VENTA_BS,
		PaymentMethod.EFECTIVO_BS
	];

	const FOREIGN_METHODS: PaymentMethod[] = [PaymentMethod.EFECTIVO_USD, PaymentMethod.BINANCE_USDT];

	let { saleId, remainingBcvUsd, bcvRate = 0, onPaymentAdded }: Props = $props();
	const store = getExchangeRatesStore();
	const storeBcvRate = $derived(store.bcvRate);
	const effectiveBcvRate = $derived(bcvRate > 0 ? bcvRate : storeBcvRate);
	const defaultBcvRateInput = $derived(effectiveBcvRate > 0 ? effectiveBcvRate.toFixed(2) : '');

	let paymentMethod = $state<PaymentMethod | ''>('');
	let lastEditedField = $state<PaymentCalculationMode>('target');
	let targetAmountInput = $state('');
	let nativeAmountInput = $state('');
	let exchangeRateInput = $state('');
	let currentBcvRateInput = $state('');
	let bcvRateEditable = $state(false);
	let paymentDate = $state(toISODate(nowUTC()));
	let reference = $state('');
	let notes = $state('');
	let showNotes = $state(false);
	let showExtraFields = $state(false);
	let submitting = $state(false);

	function inputToNumber(value: string): number {
		const parsed = Number(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	}

	function formatInputValue(value: number): string {
		return value > 0 ? value.toFixed(2) : '';
	}

	function pillClasses(method: PaymentMethod): string {
		const isActive = paymentMethod === method;
		const isBs = isBsPaymentMethod(method);

		return isActive
			? isBs
				? 'bg-brand-navy text-white ring-2 ring-brand-navy/20'
				: 'bg-amber-600 text-white ring-2 ring-amber-600/20'
			: 'bg-white text-brand-navy border border-slate-200 hover:border-slate-300 hover:bg-slate-50';
	}

	function formatBsAmount(value: number): string {
		if (value <= 0) return '-';
		return `${value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
	}

	const activeBcvRate = $derived(inputToNumber(currentBcvRateInput || defaultBcvRateInput));
	const exchangeRateValue = $derived(inputToNumber(exchangeRateInput));
	const manualTargetAmount = $derived(inputToNumber(targetAmountInput));
	const manualNativeAmount = $derived(inputToNumber(nativeAmountInput));
	const needsExchangeRate = $derived(
		paymentMethod !== '' && !isBsPaymentMethod(paymentMethod as PaymentMethod)
	);
	const exchangeRateLabel = $derived(
		paymentMethod ? getExchangeRateLabel(paymentMethod as PaymentMethod) : ''
	);
	const targetToNativeAmount = $derived.by(() => {
		if (!paymentMethod) return 0;

		return calculatePaymentAmountFromUsdBcv({
			method: paymentMethod as PaymentMethod,
			usdBcvAmount: manualTargetAmount,
			bcvRate: activeBcvRate,
			exchangeRate: exchangeRateValue
		});
	});
	const nativeToTargetAmount = $derived.by(() => {
		if (!paymentMethod) return 0;

		return calculateUsdBcvFromPaymentAmount({
			method: paymentMethod as PaymentMethod,
			paymentAmount: manualNativeAmount,
			bcvRate: activeBcvRate,
			exchangeRate: exchangeRateValue
		});
	});
	const resolvedAmountUsd = $derived(
		lastEditedField === 'target' ? manualTargetAmount : nativeToTargetAmount
	);
	const resolvedNativeAmount = $derived(
		lastEditedField === 'native' ? manualNativeAmount : targetToNativeAmount
	);
	const targetFieldValue = $derived(
		lastEditedField === 'target' ? targetAmountInput : formatInputValue(nativeToTargetAmount)
	);
	const nativeFieldValue = $derived(
		lastEditedField === 'native' ? nativeAmountInput : formatInputValue(targetToNativeAmount)
	);
	const pendingAfterPaymentRaw = $derived(remainingBcvUsd - resolvedAmountUsd);
	const pendingAfterPayment = $derived(Math.max(0, pendingAfterPaymentRaw));
	const overpaymentAmount = $derived(Math.max(0, resolvedAmountUsd - remainingBcvUsd));
	const restLabelClass = $derived.by(() => {
		if (overpaymentAmount > 0.01) return 'text-red-600';
		if (pendingAfterPayment > 0.01) return 'text-amber-600';
		return 'text-emerald-600';
	});
	const referenceConfig = $derived.by((): ReferenceConfig => {
		switch (paymentMethod) {
			case PaymentMethod.PAGO_MOVIL_BS:
				return {
					label: 'Número de confirmación',
					required: true,
					placeholder: 'Secuencia o referencia del pago móvil',
					helper: 'Obligatorio.'
				};
			case PaymentMethod.TRANSFERENCIA_BS:
				return {
					label: 'Número de transacción',
					required: true,
					placeholder: 'Referencia bancaria',
					helper: 'Obligatorio.'
				};
			case PaymentMethod.PUNTO_VENTA_BS:
				return {
					label: 'Número de lote / batch',
					required: false,
					placeholder: 'Opcional',
					helper: 'Si no aplica, se guardará --',
					fallbackValue: '--'
				};
			case PaymentMethod.BINANCE_USDT:
				return {
					label: 'ID de transacción',
					required: true,
					placeholder: 'ID o confirmación Binance',
					helper: 'Obligatorio.'
				};
			case PaymentMethod.EFECTIVO_BS:
			case PaymentMethod.EFECTIVO_USD:
				return {
					label: 'Referencia',
					required: false,
					placeholder: '--',
					helper: 'Opcional.'
				};
			default:
				return {
					label: 'Referencia',
					required: false,
					placeholder: '',
					helper: ''
				};
		}
	});
	const referenceToSubmit = $derived.by(() => {
		const trimmed = reference.trim();
		if (trimmed) return trimmed;
		return referenceConfig.fallbackValue;
	});
	const hasRequiredReference = $derived(!referenceConfig.required || reference.trim().length > 0);

	function reset() {
		paymentMethod = '';
		lastEditedField = 'target';
		targetAmountInput = '';
		nativeAmountInput = '';
		exchangeRateInput = '';
		currentBcvRateInput = '';
		bcvRateEditable = false;
		paymentDate = toISODate(nowUTC());
		reference = '';
		notes = '';
		showNotes = false;
		showExtraFields = false;
	}

	function selectPaymentMethod(method: PaymentMethod) {
		paymentMethod = method;
		lastEditedField = getDefaultPaymentCalculationMode(method);
		targetAmountInput = '';
		nativeAmountInput = '';
		exchangeRateInput = '';
		reference = '';
		notes = '';
		showNotes = false;
		showExtraFields = true;
	}

	function handleTargetInput(event: Event) {
		lastEditedField = 'target';
		targetAmountInput = (event.currentTarget as HTMLInputElement).value;
	}

	function useRemainingBalance() {
		if (!paymentMethod) return;
		lastEditedField = 'target';
		targetAmountInput = formatInputValue(remainingBcvUsd);
	}

	async function handleSubmit() {
		if (
			!paymentMethod ||
			resolvedNativeAmount <= 0 ||
			resolvedAmountUsd <= 0 ||
			activeBcvRate <= 0 ||
			!paymentDate ||
			!hasRequiredReference
		) {
			return;
		}

		if (needsExchangeRate && exchangeRateValue <= 0) return;

		submitting = true;
		try {
			const result = await addPayment({
				saleId,
				paymentMethod: paymentMethod as PaymentMethod,
				paymentDate,
				amount: resolvedNativeAmount,
				usdBcvAmount: resolvedAmountUsd,
				exchangeRate: needsExchangeRate ? exchangeRateValue : undefined,
				bcvRate: activeBcvRate,
				reference: referenceToSubmit,
				notes: notes.trim() || undefined
			});

			if (!result.success) {
				toast.error(result.error ?? 'Error registrando pago');
				return;
			}

			const remainingAfterSave = Math.max(0, remainingBcvUsd - resolvedAmountUsd);
			toast.success(
				remainingAfterSave <= 0.01
					? 'Pago registrado. La venta quedó cubierta.'
					: `Pago registrado. Quedan ${formatPrice(remainingAfterSave)} pendientes.`
			);
			reset();
			onPaymentAdded?.(result.paidAmount);
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error registrando pago'));
		} finally {
			submitting = false;
		}
	}

	const hasValidAmounts = $derived(resolvedAmountUsd > 0 && resolvedNativeAmount > 0);
	const canSubmit = $derived(
		!!paymentMethod &&
			hasValidAmounts &&
			!!paymentDate &&
			hasRequiredReference &&
			activeBcvRate > 0 &&
			!submitting
	);
	const submitLabel = $derived(
		hasValidAmounts ? `Registrar abono de ${formatPrice(resolvedAmountUsd)}` : 'Registrar pago'
	);
</script>

<div class="space-y-4">
	<div>
		<p class="mb-2.5 text-xs font-semibold tracking-wider text-gray-400 uppercase">
			Método de pago
		</p>
		<div class="grid grid-cols-2 gap-1.5">
			{#each [...BOLIVAR_METHODS, ...FOREIGN_METHODS] as method (method)}
				<button
					type="button"
					onclick={() => selectPaymentMethod(method)}
					class={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${pillClasses(method)}`}
				>
					{#if method === PaymentMethod.PAGO_MOVIL_BS}
						<Smartphone class="h-3.5 w-3.5 shrink-0" />
					{:else if method === PaymentMethod.TRANSFERENCIA_BS}
						<Building2 class="h-3.5 w-3.5 shrink-0" />
					{:else if method === PaymentMethod.PUNTO_VENTA_BS}
						<CreditCard class="h-3.5 w-3.5 shrink-0" />
					{:else if method === PaymentMethod.EFECTIVO_BS || method === PaymentMethod.EFECTIVO_USD}
						<WalletCards class="h-3.5 w-3.5 shrink-0" />
					{:else}
						<BadgeDollarSign class="h-3.5 w-3.5 shrink-0" />
					{/if}
					<span class="truncate">{PAYMENT_METHOD_LABELS[method]}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if paymentMethod}
		<div class="space-y-3">
			<div class="space-y-1.5">
				<div class="flex items-center justify-between">
					<label
						for="pay-amount"
						class="text-xs font-semibold tracking-wider text-gray-400 uppercase"
					>
						Monto a abonar <span class="font-normal tracking-normal text-gray-300 normal-case"
							>(USD BCV)</span
						>
					</label>
					<button
						type="button"
						onclick={useRemainingBalance}
						class="text-[10px] font-semibold text-amber-600 transition-colors hover:text-amber-700"
					>
						Usar saldo
					</button>
				</div>
				<div class="relative">
					<span class="absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-base text-gray-400"
						>$</span
					>
					<input
						id="pay-amount"
						type="number"
						value={targetFieldValue}
						oninput={handleTargetInput}
						placeholder={remainingBcvUsd.toFixed(2)}
						step="0.01"
						min="0"
						class="w-full rounded-lg border border-gray-200 bg-white py-3 pr-3.5 pl-7 font-mono text-lg font-bold text-gray-900 placeholder-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 focus:outline-none"
					/>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<div class="flex-1">
					<label
						for="pay-bcv"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-gray-400 uppercase"
					>
						Tasa BCV
					</label>
					<div class="relative">
						<input
							id="pay-bcv"
							type="number"
							value={bcvRateEditable
								? currentBcvRateInput
								: currentBcvRateInput || defaultBcvRateInput}
							oninput={(event) => {
								currentBcvRateInput = (event.currentTarget as HTMLInputElement).value;
							}}
							readonly={!bcvRateEditable}
							step="0.01"
							min="0"
							class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 focus:outline-none {bcvRateEditable
								? ''
								: 'opacity-60'}"
						/>
						<button
							type="button"
							onclick={() => (bcvRateEditable = !bcvRateEditable)}
							class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
						>
							<Pencil class="h-3 w-3" />
						</button>
					</div>
				</div>
				<div class="flex-[0.7]">
					<label
						for="pay-date"
						class="mb-1 block text-[10px] font-semibold tracking-wider text-gray-400 uppercase"
					>
						Fecha
					</label>
					<input
						id="pay-date"
						type="date"
						bind:value={paymentDate}
						max="9999-12-31"
						class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 focus:outline-none"
					/>
				</div>
			</div>

			{#if isBsPaymentMethod(paymentMethod as PaymentMethod)}
				<div class="rounded-lg bg-gray-900 px-4 py-3">
					<p class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
						Recibirás en Bs
					</p>
					<p class="mt-0.5 font-mono text-xl font-bold text-white">
						{formatBsAmount(resolvedNativeAmount)}
					</p>
					{#if resolvedAmountUsd > 0}
						<p class="mt-0.5 text-[11px] text-gray-400">
							{activeBcvRate.toFixed(2)} × {formatPrice(resolvedAmountUsd)}
						</p>
					{/if}
				</div>
			{:else}
				<label class="block space-y-1">
					<span class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
						{exchangeRateLabel}
					</span>
					<div class="relative">
						<span class="absolute top-1/2 left-3 -translate-y-1/2 font-mono text-xs text-gray-400"
							>Bs</span
						>
						<input
							type="number"
							value={exchangeRateInput}
							oninput={(event) => {
								exchangeRateInput = (event.currentTarget as HTMLInputElement).value;
							}}
							step="0.01"
							min="0"
							placeholder="0.00"
							class="w-full rounded-lg border border-gray-200 bg-white py-2 pr-3 pl-7 font-mono text-xs text-gray-900 placeholder-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 focus:outline-none"
						/>
					</div>
				</label>

				<div class="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
					<p class="text-[10px] font-semibold tracking-wider text-amber-700 uppercase">Recibes</p>
					<p class="mt-0.5 font-mono text-xl font-bold text-amber-600">
						{nativeFieldValue && inputToNumber(nativeFieldValue) > 0
							? `${inputToNumber(nativeFieldValue).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${paymentMethod === PaymentMethod.EFECTIVO_USD ? 'USD' : 'USDT'}`
							: '-'}
					</p>
				</div>
			{/if}

			{#if showExtraFields}
				<label class="block space-y-1">
					<span class="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
						{referenceConfig.label}
						{#if !referenceConfig.required}
							<span class="font-normal tracking-normal text-gray-300 normal-case">(opcional)</span>
						{/if}
					</span>
					<input
						type="text"
						bind:value={reference}
						placeholder={referenceConfig.placeholder}
						class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 focus:outline-none"
					/>
					{#if referenceConfig.helper}
						<p class="text-[10px] text-gray-400">{referenceConfig.helper}</p>
					{/if}
				</label>

				<button
					type="button"
					onclick={() => (showNotes = !showNotes)}
					class="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-gray-400 uppercase transition-colors hover:text-gray-700"
				>
					<FileText class="h-3 w-3" />
					{showNotes ? 'Ocultar nota' : 'Agregar nota'}
					{#if showNotes}
						<ChevronUp class="h-3 w-3" />
					{:else}
						<ChevronDown class="h-3 w-3" />
					{/if}
				</button>
				{#if showNotes}
					<input
						type="text"
						bind:value={notes}
						placeholder="Observaciones"
						class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 focus:outline-none"
					/>
				{/if}
			{/if}

			{#if overpaymentAmount > 0.01}
				<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
					<p class="font-semibold">El monto supera la deuda.</p>
					<p>Excedente: {formatPrice(overpaymentAmount)}</p>
				</div>
			{/if}

			<div class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
				<div>
					<p class="text-[10px] text-gray-400">Restará luego</p>
					<p class="font-mono text-sm font-bold {restLabelClass}">
						{formatPrice(pendingAfterPayment)}
					</p>
				</div>
				<div class="text-right">
					<p class="text-[10px] text-gray-400">Método</p>
					<p class="text-xs font-semibold text-gray-900">
						{PAYMENT_METHOD_LABELS[paymentMethod as PaymentMethod]}
					</p>
				</div>
			</div>

			<button
				type="button"
				onclick={handleSubmit}
				disabled={!canSubmit || (needsExchangeRate && exchangeRateValue <= 0)}
				class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
			>
				{submitLabel}
			</button>
		</div>
	{/if}
</div>
