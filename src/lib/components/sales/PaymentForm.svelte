<script lang="ts">
	import {
		BadgeDollarSign,
		Building2,
		CalendarDays,
		ChevronDown,
		ChevronUp,
		CreditCard,
		FileText,
		Plus,
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
	let paymentDate = $state(toISODate(nowUTC()));
	let reference = $state('');
	let notes = $state('');
	let showNotes = $state(false);
	let submitting = $state(false);

	function inputToNumber(value: string): number {
		const parsed = Number(value);
		return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
	}

	function formatInputValue(value: number): string {
		return value > 0 ? value.toFixed(2) : '';
	}

	function methodButtonClasses(method: PaymentMethod): string {
		const isActive = paymentMethod === method;

		return isActive
			? 'border-brand-navy bg-brand-navy text-white shadow-sm'
			: 'border-surface-container-high bg-surface-container-low text-brand-navy hover:border-brand-blue/25 hover:bg-surface-container-high';
	}

	function inputClasses(field: PaymentCalculationMode): string {
		const isSource = lastEditedField === field;

		return isSource
			? 'w-full rounded-xl border-none bg-surface-container-low px-4 py-3 font-mono text-sm text-on-surface ring-1 ring-brand-blue/14 focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0'
			: 'w-full rounded-xl border-none bg-surface-container-high px-4 py-3 font-mono text-sm text-on-surface focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';
	}

	function formatNativeAmount(value: number): string {
		if (!paymentMethod || value <= 0) return '-';

		const formatted = value.toLocaleString('es-VE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});

		if (isBsPaymentMethod(paymentMethod as PaymentMethod)) return `${formatted} Bs`;
		if (paymentMethod === PaymentMethod.EFECTIVO_USD) return `$${formatted}`;
		return `${formatted} USDT`;
	}

	function nativeFieldLabel(method: PaymentMethod | ''): string {
		if (!method) return 'Monto recibido';
		if (isBsPaymentMethod(method)) return 'Monto en Bs';
		if (method === PaymentMethod.EFECTIVO_USD) return 'Recibo (USD $)';
		return 'Recibo (USDT)';
	}

	function methodRateHelper(method: PaymentMethod | ''): string {
		if (!method || isBsPaymentMethod(method)) {
			return 'Usa la tasa BCV para convertir entre Bs y USD BCV.';
		}

		if (method === PaymentMethod.EFECTIVO_USD) {
			return 'Ingresa cuántos bolívares equivale 1 USD cash en caja.';
		}

		return 'Ingresa cuántos bolívares equivale 1 USDT al momento del cobro.';
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
		if (overpaymentAmount > 0.01) return 'text-error';
		if (pendingAfterPayment > 0.01) return 'text-warning';
		return 'text-success';
	});
	const formulaHelper = $derived.by(() => {
		if (
			!paymentMethod ||
			activeBcvRate <= 0 ||
			resolvedAmountUsd <= 0 ||
			resolvedNativeAmount <= 0
		) {
			return '';
		}

		const method = paymentMethod as PaymentMethod;

		if (isBsPaymentMethod(method)) {
			if (lastEditedField === 'target') {
				return `${resolvedAmountUsd.toFixed(2)} x ${activeBcvRate.toFixed(2)} = ${resolvedNativeAmount.toFixed(2)} Bs`;
			}

			return `${resolvedNativeAmount.toFixed(2)} Bs / ${activeBcvRate.toFixed(2)} = ${resolvedAmountUsd.toFixed(2)} USD BCV`;
		}

		if (exchangeRateValue <= 0) return '';

		const unit = method === PaymentMethod.EFECTIVO_USD ? 'USD' : 'USDT';

		if (lastEditedField === 'target') {
			return `${resolvedAmountUsd.toFixed(2)} x ${activeBcvRate.toFixed(2)} / ${exchangeRateValue.toFixed(2)} = ${resolvedNativeAmount.toFixed(2)} ${unit}`;
		}

		return `${resolvedNativeAmount.toFixed(2)} ${unit} x ${exchangeRateValue.toFixed(2)} / ${activeBcvRate.toFixed(2)} = ${resolvedAmountUsd.toFixed(2)} USD BCV`;
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
		paymentDate = toISODate(nowUTC());
		reference = '';
		notes = '';
		showNotes = false;
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
	}

	function handleTargetInput(event: Event) {
		lastEditedField = 'target';
		targetAmountInput = (event.currentTarget as HTMLInputElement).value;
	}

	function handleNativeInput(event: Event) {
		lastEditedField = 'native';
		nativeAmountInput = (event.currentTarget as HTMLInputElement).value;
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
</script>

<div class="space-y-6">
	<section class="rounded-[1.5rem] bg-surface-container-low p-5 shadow-sm">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
			<div>
				<p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
					¿Cómo paga el cliente?
				</p>
				<h3 class="mt-2 text-xl font-semibold text-brand-navy">Selecciona el método de pago</h3>
				<p class="mt-1 text-sm text-on-surface-variant">
					Los métodos en bolívares usan solo BCV. Los métodos en divisas agregan una tasa de caja.
				</p>
			</div>

			<div class="rounded-[1.25rem] bg-brand-navy px-5 py-4 text-white">
				<p class="text-[11px] font-semibold tracking-[0.18em] text-white/60 uppercase">
					Saldo pendiente
				</p>
				<p class="mt-2 font-mono text-3xl font-bold tracking-tight">
					{formatPrice(remainingBcvUsd)}
				</p>
			</div>
		</div>

		<div class="mt-6 space-y-4">
			<div>
				<p class="mb-3 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
					Bolívares
				</p>
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{#each BOLIVAR_METHODS as method (method)}
						<button
							type="button"
							onclick={() => selectPaymentMethod(method)}
							class={`flex cursor-pointer items-center gap-3 rounded-[1.25rem] border px-4 py-4 text-left transition-colors ${methodButtonClasses(method)}`}
						>
							<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
								{#if method === PaymentMethod.PAGO_MOVIL_BS}
									<Smartphone class="h-5 w-5" />
								{:else if method === PaymentMethod.TRANSFERENCIA_BS}
									<Building2 class="h-5 w-5" />
								{:else if method === PaymentMethod.PUNTO_VENTA_BS}
									<CreditCard class="h-5 w-5" />
								{:else}
									<WalletCards class="h-5 w-5" />
								{/if}
							</div>
							<div>
								<p class="font-semibold">{PAYMENT_METHOD_LABELS[method]}</p>
								<p class="mt-1 text-xs opacity-75">Cálculo directo con tasa BCV</p>
							</div>
						</button>
					{/each}
				</div>
			</div>

			<div class="border-t border-surface-container-high pt-4">
				<p class="mb-3 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
					Divisas
				</p>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each FOREIGN_METHODS as method (method)}
						<button
							type="button"
							onclick={() => selectPaymentMethod(method)}
							class={`flex cursor-pointer items-center gap-3 rounded-[1.25rem] border px-4 py-4 text-left transition-colors ${methodButtonClasses(method)}`}
						>
							<div class="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
								{#if method === PaymentMethod.EFECTIVO_USD}
									<BadgeDollarSign class="h-5 w-5" />
								{:else}
									<WalletCards class="h-5 w-5" />
								{/if}
							</div>
							<div>
								<p class="font-semibold">{PAYMENT_METHOD_LABELS[method]}</p>
								<p class="mt-1 text-xs opacity-75">Requiere tasa adicional de caja</p>
							</div>
						</button>
					{/each}
				</div>
			</div>
		</div>
	</section>

	{#if paymentMethod}
		<div class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
			<section class="rounded-[1.5rem] bg-surface-container-low p-5 shadow-sm">
				<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
							{PAYMENT_METHOD_LABELS[paymentMethod as PaymentMethod]}
						</p>
						<h3 class="mt-2 text-xl font-semibold text-brand-navy">Registrar pago</h3>
						<p class="mt-1 text-sm text-on-surface-variant">
							Edita cualquiera de los dos montos y el otro se recalcula automáticamente.
						</p>
					</div>

					<label class="block min-w-[12rem] space-y-2">
						<span
							class="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>
							<CalendarDays class="h-4 w-4 text-brand-blue" />
							Fecha del pago
						</span>
						<input
							id="pay-date"
							type="date"
							bind:value={paymentDate}
							max="9999-12-31"
							class="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm font-medium text-on-surface focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
						/>
					</label>
				</div>

				<div class={`mt-5 grid gap-4 md:grid-cols-2 ${needsExchangeRate ? 'xl:grid-cols-3' : ''}`}>
					<label class="block space-y-2">
						<div class="flex items-center justify-between gap-3">
							<span class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
								Tasa BCV (Bs/$)
							</span>
							<span
								class="rounded-full bg-success-container/70 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-on-success-container uppercase"
							>
								Precargada
							</span>
						</div>
						<input
							id="pay-bcv"
							type="number"
							value={currentBcvRateInput || defaultBcvRateInput}
							oninput={(event) => {
								currentBcvRateInput = (event.currentTarget as HTMLInputElement).value;
							}}
							step="0.01"
							min="0"
							class="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 font-mono text-sm text-on-surface focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
						/>
						<p class="text-xs text-outline">Puedes ajustarla manualmente antes de registrar.</p>
					</label>

					{#if needsExchangeRate}
						<label class="block space-y-2">
							<div class="flex items-center justify-between gap-3">
								<span class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
									{exchangeRateLabel}
								</span>
								<span
									class="rounded-full bg-warning-container/70 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-on-warning-container uppercase"
								>
									Manual
								</span>
							</div>
							<input
								id="pay-rate"
								type="number"
								value={exchangeRateInput}
								oninput={(event) => {
									exchangeRateInput = (event.currentTarget as HTMLInputElement).value;
								}}
								step="0.01"
								min="0"
								class="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 font-mono text-sm text-on-surface focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
							<p class="text-xs text-outline">{methodRateHelper(paymentMethod as PaymentMethod)}</p>
						</label>
					{/if}

					<div
						class="rounded-[1.25rem] bg-info-container/60 px-4 py-4 text-sm text-on-info-container"
					>
						<p class="text-[11px] font-semibold tracking-[0.16em] uppercase">Método activo</p>
						<p class="mt-2 font-semibold text-brand-navy">
							{PAYMENT_METHOD_LABELS[paymentMethod as PaymentMethod]}
						</p>
						<p class="mt-1 text-xs leading-relaxed text-on-info-container/80">
							{isBsPaymentMethod(paymentMethod as PaymentMethod)
								? 'Si conoces el abono en USD BCV o el monto en Bs, escribe cualquiera de los dos.'
								: 'Si conoces cuánto abona o cuánto entregó el cliente, escribe cualquiera de los dos montos.'}
						</p>
					</div>
				</div>

				<div class="mt-5 grid gap-4 md:grid-cols-2">
					<label class="block space-y-2">
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
								Abona (USD BCV)
							</span>
							<button
								type="button"
								onclick={useRemainingBalance}
								class="rounded-full bg-info-container px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-on-info-container uppercase transition-colors hover:bg-brand-blue-light/50"
							>
								Usar pendiente
							</button>
						</div>
						<input
							id="pay-usd"
							type="number"
							value={targetFieldValue}
							oninput={handleTargetInput}
							placeholder={remainingBcvUsd.toFixed(2)}
							step="0.01"
							min="0"
							class={inputClasses('target')}
						/>
						<p class="text-xs text-outline">Cuánto se descontará de la deuda anclada al BCV.</p>
					</label>

					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
							{nativeFieldLabel(paymentMethod as PaymentMethod)}
						</span>
						<input
							id="pay-native"
							type="number"
							value={nativeFieldValue}
							oninput={handleNativeInput}
							step="0.01"
							min="0"
							class={inputClasses('native')}
						/>
						<p class="text-xs text-outline">
							{isBsPaymentMethod(paymentMethod as PaymentMethod)
								? 'Si el cliente te dice el monto exacto en bolívares, escríbelo aquí.'
								: `Si el cliente entrega un monto fijo en ${paymentMethod === PaymentMethod.EFECTIVO_USD ? 'USD cash' : 'USDT'}, escríbelo aquí.`}
						</p>
					</label>
				</div>

				<div class="mt-5 grid gap-4 md:grid-cols-2">
					<label class="block space-y-2">
						<span class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
							{referenceConfig.label}
							{referenceConfig.required ? '' : ' (opcional)'}
						</span>
						<input
							id="pay-ref"
							type="text"
							bind:value={reference}
							placeholder={referenceConfig.placeholder}
							class="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm text-on-surface focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
						/>
						{#if referenceConfig.helper}
							<p class="text-xs text-outline">{referenceConfig.helper}</p>
						{/if}
					</label>

					<div class="space-y-2">
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
								Notas
							</span>
							<button
								type="button"
								onclick={() => (showNotes = !showNotes)}
								class="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-on-surface-variant uppercase transition-colors hover:bg-surface-container-highest"
							>
								<FileText class="h-3.5 w-3.5" />
								{#if showNotes}
									<ChevronUp class="h-3.5 w-3.5" />
									Ocultar
								{:else}
									<ChevronDown class="h-3.5 w-3.5" />
									Agregar nota
								{/if}
							</button>
						</div>
						{#if showNotes}
							<input
								id="pay-notes"
								type="text"
								bind:value={notes}
								placeholder="Observaciones"
								class="w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3 text-sm text-on-surface focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
							/>
						{:else}
							<div
								class="rounded-xl bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant"
							>
								Sin nota adicional.
							</div>
						{/if}
					</div>
				</div>
			</section>

			<aside class="rounded-[1.5rem] bg-surface-container-low p-5 shadow-sm">
				<p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">
					Resumen de cobro
				</p>

				<div class="mt-4 rounded-[1.25rem] bg-surface-container-lowest px-4 py-4">
					<div class="flex items-center justify-between gap-4">
						<span class="text-sm text-on-surface-variant">Saldo pendiente</span>
						<span class="font-mono text-lg font-semibold text-brand-navy">
							{formatPrice(remainingBcvUsd)}
						</span>
					</div>
					<div class="mt-3 flex items-center justify-between gap-4">
						<span class="text-sm text-on-surface-variant">Se registrará</span>
						<span class="font-mono text-lg font-semibold text-brand-navy">
							{formatPrice(resolvedAmountUsd)}
						</span>
					</div>
					<div class="mt-3 flex items-center justify-between gap-4">
						<span class="text-sm text-on-surface-variant">Monto recibido</span>
						<span class="font-mono text-lg font-semibold text-brand-navy">
							{formatNativeAmount(resolvedNativeAmount)}
						</span>
					</div>
					<div class="mt-3 h-px bg-surface-container-high"></div>
					<div class="mt-3 flex items-center justify-between gap-4">
						<span class="text-sm text-on-surface-variant">Restará</span>
						<span class={`font-mono text-lg font-bold ${restLabelClass}`}>
							{formatPrice(pendingAfterPayment)}
						</span>
					</div>
				</div>

				{#if overpaymentAmount > 0.01}
					<div
						class="mt-4 rounded-[1.25rem] bg-error-container/75 px-4 py-3 text-sm text-on-error-container"
					>
						<p class="font-semibold">El monto supera la deuda actual.</p>
						<p class="mt-1">Excedente proyectado: {formatPrice(overpaymentAmount)}</p>
					</div>
				{/if}

				{#if formulaHelper}
					<div class="mt-4 rounded-[1.25rem] bg-info-container/70 px-4 py-3">
						<p class="text-[11px] font-semibold tracking-[0.18em] text-on-info-container uppercase">
							Fórmula aplicada
						</p>
						<p class="mt-1 font-mono text-sm text-brand-navy">{formulaHelper}</p>
					</div>
				{/if}

				<button
					type="button"
					onclick={handleSubmit}
					disabled={!paymentMethod ||
						resolvedAmountUsd <= 0 ||
						resolvedNativeAmount <= 0 ||
						!paymentDate ||
						!hasRequiredReference ||
						activeBcvRate <= 0 ||
						(needsExchangeRate && exchangeRateValue <= 0) ||
						submitting}
					class="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-3 text-sm font-bold tracking-[0.14em] text-brand-navy uppercase transition-all hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if submitting}<span class="spinner"></span>{/if}
					<Plus class="h-4 w-4" />
					Registrar pago
				</button>
			</aside>
		</div>
	{/if}
</div>
