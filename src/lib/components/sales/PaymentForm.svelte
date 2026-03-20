<script lang="ts">
	import { Button, Select, Input, Label, Spinner } from 'flowbite-svelte';
	import { Plus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { addPayment } from '$lib/remote/sales.remote';
	import { formatPrice, getErrorMessage } from '$lib/utils';
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
	let amount = $state(0);
	let exchangeRate = $state(0);
	let currentBcvRate = $state(0);
	let reference = $state('');
	let notes = $state('');
	let submitting = $state(false);

	// Sync BCV rate from prop (initial + when parent updates)
	$effect(() => {
		if (bcvRate > 0 && currentBcvRate === 0) {
			currentBcvRate = bcvRate;
		}
	});

	// Whether the selected method needs a method-specific exchange rate
	const needsExchangeRate = $derived(
		paymentMethod !== '' && !isBsPaymentMethod(paymentMethod as PaymentMethodType)
	);

	const exchangeRateLabel = $derived(
		paymentMethod ? getExchangeRateLabel(paymentMethod as PaymentMethodType) : ''
	);

	// Preview of BCV USD equivalent
	const previewBcvUsd = $derived(() => {
		if (!paymentMethod || !amount || !currentBcvRate) return 0;
		const method = paymentMethod as PaymentMethodType;
		if (isBsPaymentMethod(method)) {
			return amount / currentBcvRate;
		}
		if (!exchangeRate) return 0;
		return (amount * exchangeRate) / currentBcvRate;
	});

	function reset() {
		paymentMethod = '';
		amount = 0;
		exchangeRate = 0;
		reference = '';
		notes = '';
	}

	async function handleSubmit() {
		if (!paymentMethod || amount <= 0 || currentBcvRate <= 0) return;
		if (needsExchangeRate && exchangeRate <= 0) return;

		submitting = true;
		try {
			const result = await addPayment({
				saleId,
				paymentMethod: paymentMethod as PaymentMethodType,
				amount,
				exchangeRate: needsExchangeRate ? exchangeRate : undefined,
				bcvRate: currentBcvRate,
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
	<h4 class="mb-4 text-base font-semibold text-slate-800">Registrar Pago</h4>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<!-- Payment Method -->
		<div>
			<Label for="pay-method" class="mb-1.5 text-sm">Método de Pago *</Label>
			<Select id="pay-method" bind:value={paymentMethod} class="w-full">
				<option value="">Seleccionar...</option>
				{#each ALL_PAYMENT_METHODS as method (method)}
					<option value={method}>{PAYMENT_METHOD_LABELS[method]}</option>
				{/each}
			</Select>
		</div>

		<!-- Amount -->
		<div>
			<Label for="pay-amount" class="mb-1.5 text-sm">
				Monto ({paymentMethod && isBsPaymentMethod(paymentMethod as PaymentMethodType)
					? 'Bs'
					: paymentMethod === PaymentMethod.EFECTIVO_USD
						? '$'
						: paymentMethod === PaymentMethod.BINANCE_USDT
							? 'USDT'
							: ''}) *
			</Label>
			<Input
				id="pay-amount"
				type="number"
				bind:value={amount}
				step="0.01"
				min="0"
				class="font-mono"
			/>
		</div>

		<!-- BCV Rate -->
		<div>
			<Label for="pay-bcv" class="mb-1.5 text-sm">Tasa BCV (Bs/$) *</Label>
			<Input
				id="pay-bcv"
				type="number"
				bind:value={currentBcvRate}
				step="0.01"
				min="0"
				class="font-mono"
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
					class="font-mono"
				/>
			</div>
		{/if}

		<!-- Reference -->
		<div>
			<Label for="pay-ref" class="mb-1.5 text-sm">Referencia</Label>
			<Input id="pay-ref" bind:value={reference} placeholder="Nro. referencia" />
		</div>

		<!-- Notes -->
		<div>
			<Label for="pay-notes" class="mb-1.5 text-sm">Notas</Label>
			<Input id="pay-notes" bind:value={notes} placeholder="Observaciones" />
		</div>
	</div>

	<!-- Preview & Submit -->
	<div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
		<div class="text-base text-slate-500">
			{#if amount > 0 && currentBcvRate > 0}
				Equivalente BCV:
				<span class="font-mono font-semibold text-blue-700">
					{formatPrice(previewBcvUsd())}
				</span>
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
				amount <= 0 ||
				currentBcvRate <= 0 ||
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
