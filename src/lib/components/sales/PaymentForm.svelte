<script lang="ts">
	import { Button, Select, Input, Label, Spinner } from 'flowbite-svelte';
	import { CalendarDays, RefreshCcw, Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { addPayment } from '$lib/remote/sales.remote';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import { toISODate, nowUTC } from '$lib/dates';
	import {
		ALL_PAYMENT_METHODS,
		PAYMENT_METHOD_LABELS,
		PaymentMethod,
		isBsPaymentMethod,
		getExchangeRateLabel,
		type PaymentMethod as PaymentMethodType
	} from '$lib/shared/enums';

	interface Props {
		saleId: string;
		remainingBcvUsd: number;
		bcvRate: number;
		onPaymentAdded?: (paidAmount: number) => void;
	}

	let { saleId, remainingBcvUsd, bcvRate, onPaymentAdded }: Props = $props();

	let paymentMethod = $state<PaymentMethodType | ''>('');
	let amountUsd = $state(0);
	let manualAmount = $state(0);
	let amountEdited = $state(false);
	let exchangeRate = $state(0);
	let currentBcvRate = $state(0);
	let paymentDate = $state(toISODate(nowUTC()));
	let reference = $state('');
	let notes = $state('');
	let submitting = $state(false);

	const isCashMethod = $derived(
		paymentMethod === PaymentMethod.EFECTIVO_BS || paymentMethod === PaymentMethod.EFECTIVO_USD
	);
	const referenceRequired = $derived(paymentMethod !== '' && !isCashMethod);
	const hasReferenceValue = $derived(reference.trim().length > 0);

	const activeBcvRate = $derived(currentBcvRate > 0 ? currentBcvRate : bcvRate);

	// Whether the selected method needs a method-specific exchange rate
	const needsExchangeRate = $derived(
		paymentMethod !== '' && !isBsPaymentMethod(paymentMethod as PaymentMethodType)
	);

	const exchangeRateLabel = $derived(
		paymentMethod ? getExchangeRateLabel(paymentMethod as PaymentMethodType) : ''
	);

	const amountUnitLabel = $derived.by(() => {
		if (!paymentMethod) return 'Monto';
		if (isBsPaymentMethod(paymentMethod as PaymentMethodType)) return 'Bs';
		if (paymentMethod === PaymentMethod.EFECTIVO_USD) return '$';
		if (paymentMethod === PaymentMethod.BINANCE_USDT) return 'USDT';
		return 'Monto';
	});

	const suggestedAmount = $derived.by(() => {
		if (!paymentMethod || amountUsd <= 0 || activeBcvRate <= 0) return 0;
		const method = paymentMethod as PaymentMethodType;
		if (isBsPaymentMethod(method)) {
			return amountUsd * activeBcvRate;
		}
		if (!exchangeRate || exchangeRate <= 0) return 0;
		return (amountUsd * activeBcvRate) / exchangeRate;
	});

	const formulaHelper = $derived.by(() => {
		if (!paymentMethod || amountUsd <= 0 || activeBcvRate <= 0) return '';

		const method = paymentMethod as PaymentMethodType;
		if (isBsPaymentMethod(method)) {
			return `${amountUsd.toFixed(2)} x ${activeBcvRate.toFixed(2)} = ${suggestedAmount.toFixed(2)} Bs`;
		}

		if (!exchangeRate || exchangeRate <= 0) return '';

		const unit = method === PaymentMethod.EFECTIVO_USD ? '$' : 'USDT';
		return `${amountUsd.toFixed(2)} x ${activeBcvRate.toFixed(2)} / ${exchangeRate.toFixed(2)} = ${suggestedAmount.toFixed(2)} ${unit}`;
	});

	const amount = $derived.by(() =>
		amountEdited ? manualAmount : Number(suggestedAmount.toFixed(2))
	);

	// Preview of BCV USD equivalent — use the user-entered USD value directly
	const previewBcvUsd = $derived(amountUsd);

	function reset() {
		paymentMethod = '';
		amountUsd = 0;
		manualAmount = 0;
		amountEdited = false;
		exchangeRate = 0;
		currentBcvRate = 0;
		paymentDate = toISODate(nowUTC());
		reference = '';
		notes = '';
	}

	function useSuggestedAmount() {
		amountEdited = false;
		manualAmount = Number(suggestedAmount.toFixed(2));
	}

	async function handleSubmit() {
		if (!paymentMethod || amount <= 0 || amountUsd <= 0 || activeBcvRate <= 0 || !paymentDate)
			return;
		if (needsExchangeRate && exchangeRate <= 0) return;
		if (referenceRequired && !hasReferenceValue) {
			toast.error('La referencia es obligatoria para este método. Si no aplica, ingresa --');
			return;
		}

		submitting = true;
		try {
			const result = await addPayment({
				saleId,
				paymentMethod: paymentMethod as PaymentMethodType,
				paymentDate,
				amount,
				usdBcvAmount: amountUsd,
				exchangeRate: needsExchangeRate ? exchangeRate : undefined,
				bcvRate: activeBcvRate,
				reference: reference || undefined,
				notes: notes || undefined
			});

			if (!result.success) {
				toast.error(result.error ?? 'Error registrando pago');
				return;
			}

			toast.success(`Pago registrado: ${formatPrice(result.paidAmount)} USD BCV pagado`);
			reset();
			onPaymentAdded?.(result.paidAmount);
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error registrando pago'));
		} finally {
			submitting = false;
		}
	}
</script>

<div class="rounded-lg border border-slate-200 bg-white p-5">
	<h4 class="mb-1 text-base font-semibold text-slate-800">Registrar Pago</h4>
	<p class="mb-3 text-sm text-slate-500">
		Flujo sugerido: método de pago, tasas y monto calculado. Puedes ajustar el monto manualmente.
	</p>

	<div class="mb-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
		<div class="max-w-sm">
			<Label
				for="pay-date"
				class="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700"
			>
				<CalendarDays class="h-4 w-4 text-slate-500" />
				Fecha del Pago *
			</Label>
			<Input
				id="pay-date"
				type="date"
				bind:value={paymentDate}
				max="9999-12-31"
				class="h-9 text-sm"
			/>
		</div>
		<div class="max-w-sm">
			<Label for="pay-usd" class="mb-1 text-sm font-semibold text-slate-700"
				>Monto a cancelar (USD BCV) *</Label
			>
			<Input
				id="pay-usd"
				type="number"
				bind:value={amountUsd}
				placeholder={remainingBcvUsd.toFixed(2)}
				step="0.01"
				min="0"
				class="h-9 font-mono text-sm"
			/>
			<p class="mt-1 text-xs text-slate-500">
				Pendiente actual: <span class="font-mono text-slate-700"
					>{formatPrice(remainingBcvUsd)}</span
				>
			</p>
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<!-- Payment Method -->
		<div>
			<Label for="pay-method" class="mb-1.5 text-sm">Método de Pago *</Label>
			<Select id="pay-method" bind:value={paymentMethod} class="h-9 w-full text-sm">
				<option value="">Seleccionar...</option>
				{#each ALL_PAYMENT_METHODS as method (method)}
					<option value={method}>{PAYMENT_METHOD_LABELS[method]}</option>
				{/each}
			</Select>
		</div>

		<!-- BCV Rate -->
		<div>
			<Label for="pay-bcv" class="mb-1.5 text-sm">Tasa BCV (Bs/$) *</Label>
			<Input
				id="pay-bcv"
				type="number"
				bind:value={currentBcvRate}
				placeholder={bcvRate > 0 ? bcvRate.toFixed(2) : '0.00'}
				step="0.01"
				min="0"
				class="h-9 font-mono text-sm"
			/>
		</div>

		<!-- Method-specific exchange rate -->
		{#if needsExchangeRate}
			<div>
				<Label for="pay-rate" class="mb-1.5 text-sm">{exchangeRateLabel} *</Label>
				<Input
					id="pay-rate"
					type="number"
					bind:value={exchangeRate}
					step="0.01"
					min="0"
					class="h-9 font-mono text-sm"
				/>
			</div>
		{/if}

		<!-- Amount -->
		<div>
			<div class="mb-1.5 flex items-center justify-between gap-2 text-sm">
				<Label for="pay-amount">Monto calculado ({amountUnitLabel}) *</Label>
				<button
					type="button"
					onclick={useSuggestedAmount}
					class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50"
				>
					<RefreshCcw class="h-3.5 w-3.5" />
					Usar sugerido
				</button>
			</div>
			<Input
				id="pay-amount"
				type="number"
				value={amount}
				oninput={(event) => {
					amountEdited = true;
					manualAmount = Number((event.currentTarget as HTMLInputElement).value);
				}}
				step="0.01"
				min="0"
				class="h-9 font-mono text-sm"
			/>
			<p class="mt-1 text-xs text-slate-500">
				Sugerido: <span class="font-mono text-slate-700">{suggestedAmount.toFixed(2)}</span>
			</p>
		</div>

		<!-- Reference -->
		<div>
			<Label for="pay-ref" class="mb-1.5 text-sm">
				Referencia {referenceRequired ? '*' : '(opcional)'}
			</Label>
			<Input
				id="pay-ref"
				bind:value={reference}
				placeholder={referenceRequired ? 'Nro. referencia o --' : 'Nro. referencia (opcional)'}
				class="h-9 text-sm"
			/>
			{#if referenceRequired}
				<p class="mt-1 text-xs text-slate-500">Obligatoria. Si no aplica, escribe --</p>
			{/if}
		</div>

		<!-- Notes -->
		<div>
			<Label for="pay-notes" class="mb-1.5 text-sm">Notas</Label>
			<Input id="pay-notes" bind:value={notes} placeholder="Observaciones" class="h-9 text-sm" />
		</div>
	</div>

	{#if paymentMethod && formulaHelper}
		<div class="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
			<p class="text-xs font-semibold tracking-wide text-blue-700 uppercase">Formula aplicada</p>
			<p class="mt-1 font-mono text-sm text-blue-900">{formulaHelper}</p>
		</div>
	{/if}

	<!-- Preview & Submit -->
	<div
		class="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="text-base text-slate-500">
			{#if amount > 0 && activeBcvRate > 0}
				Equivalente BCV registrado:
				<span class="font-mono font-semibold text-blue-700">
					{formatPrice(previewBcvUsd)}
				</span>
				{#if amountUsd > 0}
					<span class="ml-2 text-sm text-slate-400">Objetivo: {formatPrice(amountUsd)}</span>
				{/if}
				{#if remainingBcvUsd > 0}
					<span class="ml-2 text-sm text-slate-400">
						/ Pendiente: {formatPrice(remainingBcvUsd)}
					</span>
				{/if}
			{/if}
		</div>
		<Button
			color="blue"
			size="sm"
			onclick={handleSubmit}
			disabled={!paymentMethod ||
				amountUsd <= 0 ||
				amount <= 0 ||
				!paymentDate ||
				(referenceRequired && !hasReferenceValue) ||
				activeBcvRate <= 0 ||
				(needsExchangeRate && exchangeRate <= 0) ||
				submitting}
		>
			{#if submitting}
				<Spinner size="4" class="mr-1" />
			{/if}
			<Plus class="mr-1 h-4 w-4" />
			Agregar Pago
		</Button>
	</div>
</div>
