<script lang="ts">
	import { Ban, CirclePlus, ReceiptText, WalletCards } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { nowUTC, toISODate } from '$lib/dates';
	import { AppBadge, ConfirmModal } from '$lib/components/ui';
	import {
		addPurchaseOrderPaymentCmd,
		voidPurchaseOrderPaymentCmd
	} from '$lib/remote/purchaseOrders.remote';
	import {
		ALL_PURCHASE_PAYMENT_CURRENCY_CODES,
		CURRENCY_LABELS,
		CurrencyCode,
		PurchaseOrderStatus
	} from '$lib/shared/enums';
	import type {
		EarlyPaymentDiscountSuggestion,
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';
import { getEarlyPaymentDiscountSuggestion } from '$lib/shared/purchaseOrderCredit';
	import {
		getPurchasePaymentSpecificRateLabel,
		normalizePurchasePaymentAmounts,
		requiresPurchasePaymentSpecificRate
	} from '$lib/shared/purchaseOrderPayments';
	import type {
		PurchaseOrder,
		PurchaseOrderEarlyPaymentBenefit,
		PurchaseOrderPayment
	} from '$lib/server/db/schema';
	import type { PurchaseOrderPaymentWithUsers } from '$lib/server/db/queries/purchaseOrderPayments';
	import { formatDate, formatDateOnly, formatPrice, getErrorMessage } from '$lib/utils';

	interface PaymentComposerRequest {
		token: string;
		amount?: number;
		paymentDate?: string;
		reference?: string;
		notes?: string;
		currencyCode?: CurrencyCode;
	}

	interface Props {
		purchaseOrderId: string;
		status: string;
		defaultBcvRate: number;
		payments: PurchaseOrderPaymentWithUsers[];
		purchaseOrder: PurchaseOrder;
		earlyPaymentBenefits: PurchaseOrderEarlyPaymentBenefit[];
		/** Pending balance in USD (positive = owes money, negative = overpaid) */
		pendingBalanceUsd?: number;
		debtTotalUsd?: number;
		isFullyPaid?: boolean;
		composerRequest?: PaymentComposerRequest | null;
		onFinanceChanged?: (payload: {
			payments: PurchaseOrderPaymentWithUsers[];
			earlyPaymentBenefits?: PurchaseOrderEarlyPaymentBenefit[];
			balance: PurchaseOrderBalanceSummary;
			dueStatus: PurchaseOrderDueStatus;
		}) => void;
	}

	let {
		purchaseOrderId,
		status,
		defaultBcvRate,
		payments,
		purchaseOrder,
		earlyPaymentBenefits,
		pendingBalanceUsd,
		debtTotalUsd,
		isFullyPaid = false,
		composerRequest = null,
		onFinanceChanged
	}: Props = $props();

	let lastComposerToken = '';
	let showForm = $state(false);
	let loading = $state(false);
	let currencyCode = $state<CurrencyCode>(CurrencyCode.VES);
	let paymentDate = $state(toISODate(nowUTC()));
	let amountInput = $state('');
	let bcvUsdRateInput = $state('');
	let specificRateInput = $state('');
	let referenceInput = $state('');
	let notesInput = $state('');
	let showVoidModal = $state(false);
	let voidingPayment = $state<PurchaseOrderPaymentWithUsers | null>(null);
	let voidLoading = $state(false);
	let showOverpaymentModal = $state(false);
	let pendingAddPayload = $state<Parameters<typeof addPurchaseOrderPaymentCmd>[0] | null>(null);
	let showEarlyPaymentBenefitModal = $state(false);
	let pendingBenefitSuggestion = $state<EarlyPaymentDiscountSuggestion | null>(null);
	let benefitAmountInput = $state('');
	let benefitNoteInput = $state('');

	const canManagePayments = $derived(status === PurchaseOrderStatus.CONFIRMED && !isFullyPaid);
	const canVoidPayment = $derived(status === PurchaseOrderStatus.CONFIRMED);
	const amountValue = $derived(Number(amountInput || 0));
	const bcvUsdRateValue = $derived(Number(bcvUsdRateInput || 0));
	const specificRateValue = $derived(Number(specificRateInput || 0));
	const needsSpecificRate = $derived(requiresPurchasePaymentSpecificRate(currencyCode));
	const normalized = $derived(
		normalizePurchasePaymentAmounts({
			currencyCode,
			amount: amountValue,
			bcvUsdRate: bcvUsdRateValue,
			specificRate: needsSpecificRate ? specificRateValue : undefined
		})
	);
	const sortedPayments = $derived.by(() =>
		[...payments].sort((left, right) => left.paymentNumber - right.paymentNumber)
	);
	const hasActiveEarlyPaymentBenefit = $derived(
		earlyPaymentBenefits.some((benefit) => !benefit.voidedAt)
	);

	function benefitForPayment(paymentId: string): PurchaseOrderEarlyPaymentBenefit | null {
		return earlyPaymentBenefits.find((benefit) => benefit.paymentId === paymentId && !benefit.voidedAt) ?? null;
	}

	function resetForm(request: PaymentComposerRequest | null = null) {
		currencyCode = request?.currencyCode ?? CurrencyCode.USD_BCV;
		paymentDate = request?.paymentDate ?? toISODate(nowUTC());
		amountInput = request?.amount != null ? request.amount.toFixed(2) : '';
		bcvUsdRateInput = defaultBcvRate > 0 ? defaultBcvRate.toFixed(2) : '';
		specificRateInput = '';
		referenceInput = request?.reference ?? '';
		notesInput = request?.notes ?? '';
	}

	function toggleForm() {
		if (showForm) {
			showForm = false;
			return;
		}

		resetForm();
		showForm = true;
	}

	$effect(() => {
		if (!composerRequest || !canManagePayments) return;
		if (composerRequest.token === lastComposerToken) return;

		untrack(() => {
			lastComposerToken = composerRequest.token;
			resetForm(composerRequest);
			showForm = true;
		});
	});

	function formatOriginalAmount(payment: PurchaseOrderPayment): string {
		const formatted = payment.amount.toLocaleString('es-VE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});

		switch (payment.currencyCode) {
			case CurrencyCode.EUR_BCV:
				return `€${formatted}`;
			case CurrencyCode.USDT:
				return `${formatted} USDT`;
			case CurrencyCode.VES:
				return `Bs. ${formatted}`;
			case CurrencyCode.OTHER:
				return formatted;
			default:
				return `$${formatted}`;
		}
	}

	function openVoid(payment: PurchaseOrderPaymentWithUsers) {
		voidingPayment = payment;
		showVoidModal = true;
	}

	async function handleAddPayment() {
		if (!canManagePayments) return;
		if (!paymentDate) {
			toast.error('La fecha del pago es obligatoria');
			return;
		}
		if (!Number.isFinite(amountValue) || amountValue <= 0) {
			toast.error('Monto inválido');
			return;
		}
		if (!Number.isFinite(bcvUsdRateValue) || bcvUsdRateValue <= 0) {
			toast.error('La tasa BCV es obligatoria');
			return;
		}
		if (needsSpecificRate && (!Number.isFinite(specificRateValue) || specificRateValue <= 0)) {
			toast.error('La tasa usada es obligatoria para esta moneda');
			return;
		}
		if (normalized.amountUsdBcv <= 0) {
			toast.error('No se pudo calcular el equivalente en USD BCV');
			return;
		}

		const payload = {
			purchaseOrderId,
			currencyCode,
			paymentDate,
			amount: amountValue,
			bcvUsdRate: bcvUsdRateValue,
			specificRate: needsSpecificRate ? specificRateValue : undefined,
			reference: referenceInput || undefined,
			notes: notesInput || undefined
		};

		const earlyPaymentSuggestion =
			!hasActiveEarlyPaymentBenefit && pendingBalanceUsd != null && debtTotalUsd != null
				? getEarlyPaymentDiscountSuggestion({
						terms: purchaseOrder,
						totalDebt: debtTotalUsd,
						currentBalance: pendingBalanceUsd,
						paymentAmountUsdBcv: normalized.amountUsdBcv,
						paymentDate
					})
				: null;

		if (earlyPaymentSuggestion) {
			pendingAddPayload = payload;
			pendingBenefitSuggestion = earlyPaymentSuggestion;
			benefitAmountInput = earlyPaymentSuggestion.residualAfterPayment.toFixed(2);
			benefitNoteInput = '';
			showEarlyPaymentBenefitModal = true;
			return;
		}

		// Warn if payment exceeds pending balance
		if (pendingBalanceUsd != null && normalized.amountUsdBcv > pendingBalanceUsd + 0.01) {
			pendingAddPayload = payload;
			showOverpaymentModal = true;
			return;
		}

		await submitAddPayment(payload);
	}

	async function submitAddPayment(payload: Parameters<typeof addPurchaseOrderPaymentCmd>[0]) {
		loading = true;
		try {
			const result = await addPurchaseOrderPaymentCmd(payload);

			if (!result.success) {
				toast.error(result.error ?? 'Error registrando pago');
				return;
			}

			onFinanceChanged?.({
				payments: result.payments,
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			});
			toast.success('Pago registrado');
			showForm = false;
			resetForm();
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error registrando pago'));
		} finally {
			loading = false;
		}
	}

	async function handleVoidPayment() {
		if (!voidingPayment) return;
		voidLoading = true;
		try {
			const result = await voidPurchaseOrderPaymentCmd({
				id: voidingPayment.id,
				purchaseOrderId
			});

			if (!result.success) {
				toast.error(result.error ?? 'Error anulando pago');
				return;
			}

			onFinanceChanged?.({
				payments: result.payments,
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			});
			toast.success('Pago anulado');
			showVoidModal = false;
			voidingPayment = null;
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error anulando pago'));
		} finally {
			voidLoading = false;
		}
	}

	async function submitPaymentWithBenefit(appliedToBalance: boolean) {
		if (!pendingAddPayload || !pendingBenefitSuggestion) return;
		const amountUsdBcv = Number(benefitAmountInput || 0);
		if (!Number.isFinite(amountUsdBcv) || amountUsdBcv <= 0) {
			toast.error('Monto de beneficio inválido');
			return;
		}

		const payload = {
			...pendingAddPayload,
			earlyPaymentBenefit: {
				amountUsdBcv,
				appliedToBalance,
				note: benefitNoteInput || undefined
			}
		};

		showEarlyPaymentBenefitModal = false;
		pendingAddPayload = null;
		pendingBenefitSuggestion = null;
		benefitAmountInput = '';
		benefitNoteInput = '';
		await submitAddPayment(payload);
	}
</script>

<section id="purchase-payments" class="glass-card overflow-hidden">
	<div
		class="flex flex-col gap-4 border-b border-outline-variant/15 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
			>
				<ReceiptText class="h-5 w-5" />
			</div>
			<div>
				<h2 class="text-xl font-semibold text-brand-navy">Pagos registrados</h2>
				<p class="text-sm text-on-surface-variant">Historial y carga de pagos del proveedor.</p>
			</div>
		</div>
		<div class="flex items-center gap-3">
			<AppBadge variant="neutral">{payments.length} movimientos</AppBadge>
			{#if canManagePayments}
				<button
					type="button"
					onclick={toggleForm}
					class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-xs font-semibold tracking-[0.14em] text-white uppercase transition-colors hover:bg-brand-navy/90"
				>
					<CirclePlus class="h-4 w-4" />
					{showForm ? 'Cerrar formulario' : 'Registrar pago'}
				</button>
			{:else if status === PurchaseOrderStatus.CONFIRMED && isFullyPaid}
				<AppBadge variant="success">Completamente pagada</AppBadge>
			{/if}
		</div>
	</div>

	{#if showForm && canManagePayments}
		<div
			class="grid gap-4 border-b border-outline-variant/15 bg-surface-container-low/35 px-6 py-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]"
		>
			<div class="grid gap-4 md:grid-cols-2">
				<label class="space-y-2 text-sm">
					<span class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Moneda</span
					>
					<select
						bind:value={currencyCode}
						class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
					>
						{#each ALL_PURCHASE_PAYMENT_CURRENCY_CODES as code (code)}
							<option value={code}>{CURRENCY_LABELS[code]}</option>
						{/each}
					</select>
				</label>

				<label class="space-y-2 text-sm">
					<span class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Fecha del pago</span
					>
					<input
						bind:value={paymentDate}
						type="date"
						class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
					/>
				</label>

				<label class="space-y-2 text-sm">
					<span class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Monto pagado</span
					>
					<input
						bind:value={amountInput}
						type="number"
						min="0"
						step="0.01"
						class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 font-mono text-sm text-on-surface focus:border-brand-blue focus:outline-none"
						placeholder="0.00"
					/>
				</label>

				<label class="space-y-2 text-sm">
					<span class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Tasa BCV USD</span
					>
					<input
						bind:value={bcvUsdRateInput}
						type="number"
						min="0"
						step="0.01"
						class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 font-mono text-sm text-on-surface focus:border-brand-blue focus:outline-none"
						placeholder="0.00"
					/>
				</label>

				{#if needsSpecificRate}
					<label class="space-y-2 text-sm md:col-span-2">
						<span class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
							>{getPurchasePaymentSpecificRateLabel(currencyCode)}</span
						>
						<input
							bind:value={specificRateInput}
							type="number"
							min="0"
							step="0.01"
							class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 font-mono text-sm text-on-surface focus:border-brand-blue focus:outline-none"
							placeholder="0.00"
						/>
					</label>
				{/if}

				<label class="space-y-2 text-sm md:col-span-2">
					<span class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Referencia</span
					>
					<input
						bind:value={referenceInput}
						type="text"
						class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
						placeholder="Banco, recibo o referencia"
					/>
				</label>

				<label class="space-y-2 text-sm md:col-span-2">
					<span class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
						>Notas</span
					>
					<textarea
						bind:value={notesInput}
						rows="3"
						class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
						placeholder="Observaciones del pago"
					></textarea>
				</label>
			</div>

			<div class="space-y-4 rounded-2xl bg-brand-navy p-5 text-white">
				<div class="flex items-center gap-2 text-sm text-white/72">
					<WalletCards class="h-4 w-4" />
					Vista previa
				</div>
				<div>
					<p class="text-[11px] font-semibold tracking-[0.18em] text-white/55 uppercase">
						Bolívares equivalentes
					</p>
					<p class="mt-2 font-mono text-2xl font-semibold tabular-nums">
						Bs. {normalized.amountBs.toLocaleString('es-VE', {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2
						})}
					</p>
				</div>
				<div>
					<p class="text-[11px] font-semibold tracking-[0.18em] text-white/55 uppercase">USD BCV</p>
					<p class="mt-2 font-mono text-3xl font-semibold tabular-nums">
						{formatPrice(normalized.amountUsdBcv)}
					</p>
				</div>
				<button
					type="button"
					onclick={handleAddPayment}
					disabled={loading}
					class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold tracking-[0.14em] text-brand-navy uppercase transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
				>
					<CirclePlus class="h-4 w-4" />
					{loading ? 'Guardando...' : 'Guardar pago'}
				</button>
			</div>
		</div>
	{/if}

	{#if sortedPayments.length === 0}
		<div class="px-6 py-10 text-center">
			<p class="text-sm font-semibold text-on-surface-variant">No hay pagos registrados todavía.</p>
			<p class="mt-1 text-sm text-outline">
				Los pagos que cargues aquí se normalizan siempre a USD BCV.
			</p>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full text-left text-sm">
				<thead
					class="bg-surface-container-low/40 text-[11px] tracking-[0.18em] text-slate-500 uppercase"
				>
					<tr>
						<th class="px-5 py-3.5">Pago</th>
						<th class="px-5 py-3.5">Fecha</th>
						<th class="px-5 py-3.5">Por</th>
						<th class="px-5 py-3.5">Moneda</th>
						<th class="px-5 py-3.5 text-right">Monto original</th>
						<th class="px-5 py-3.5 text-right">Tasas</th>
						<th class="px-5 py-3.5 text-right">USD BCV</th>
						<th class="px-5 py-3.5">Detalle</th>
						<th class="w-16 px-5 py-3.5"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-outline-variant/15">
					{#each sortedPayments as payment (payment.id)}
							{@const earlyBenefit = benefitForPayment(payment.id)}
						<tr class:opacity-60={payment.voidedAt} class="bg-surface-container-lowest">
							<td class="px-5 py-4 align-top">
								<div class="font-semibold text-brand-navy">Pago #{payment.paymentNumber}</div>
								{#if payment.voidedAt}
									<p class="mt-1 text-[11px] font-semibold tracking-[0.14em] text-error uppercase">
										Anulado
									</p>
								{/if}
							</td>
							<td class="px-5 py-4 align-top text-on-surface-variant">
								<div class:line-through={payment.voidedAt}>
									{formatDateOnly(payment.paymentDate, { dateStyle: 'short' })}
								</div>
								<div class="mt-1 text-xs text-outline">
									{formatDate(payment.createdAt, { hour: '2-digit', minute: '2-digit' })}
								</div>
							</td>
							<td class="px-5 py-4 align-top text-xs text-on-surface-variant">
								<div>{payment.createdByName}</div>
								{#if payment.voidedAt && payment.voidedByName}
									<div class="mt-1 text-[11px] text-error">↳ {payment.voidedByName}</div>
								{/if}
							</td>
							<td class="px-5 py-4 align-top">
								<AppBadge variant="neutral"
									>{CURRENCY_LABELS[payment.currencyCode as CurrencyCode] ??
										payment.currencyCode}</AppBadge
								>
							</td>
							<td
								class="px-5 py-4 text-right align-top font-mono text-on-surface-variant tabular-nums"
							>
								<span class:line-through={payment.voidedAt}>{formatOriginalAmount(payment)}</span>
							</td>
							<td
								class="px-5 py-4 text-right align-top font-mono text-xs text-outline tabular-nums"
							>
								{#if payment.specificRate}
									<div>{payment.specificRate.toFixed(2)}</div>
								{/if}
								<div>BCV {payment.bcvUsdRate.toFixed(2)}</div>
							</td>
							<td
								class="px-5 py-4 text-right align-top font-mono font-semibold text-brand-navy tabular-nums"
							>
								<span class:line-through={payment.voidedAt}
									>{formatPrice(payment.amountUsdBcv)}</span
								>
							</td>
							<td class="px-5 py-4 align-top text-sm text-on-surface-variant">
								<p class="whitespace-pre-wrap">
									{payment.reference || payment.notes || 'Sin detalle adicional'}
								</p>
								{#if payment.reference && payment.notes}
									<p class="mt-1 text-xs whitespace-pre-wrap text-outline">
										{payment.notes}
									</p>
								{/if}
								{#if earlyBenefit}
									<div class="mt-2 rounded-lg bg-info-container/40 px-3 py-2 text-xs text-on-surface">
										<p class="font-semibold text-brand-navy">
											Pronto pago {earlyBenefit.appliedToBalance ? 'aplicado' : 'anotado'} · {formatPrice(
												earlyBenefit.amountUsdBcv
											)}
										</p>
										{#if earlyBenefit.note}
											<p class="mt-1 whitespace-pre-wrap text-on-surface-variant">{earlyBenefit.note}</p>
										{/if}
									</div>
								{/if}
							</td>
							<td class="px-5 py-4 text-right align-top">
								{#if canVoidPayment && !payment.voidedAt}
									<button
										type="button"
										onclick={() => openVoid(payment)}
										class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-error-container/65 text-on-error-container transition-colors hover:bg-error-container"
										title="Anular pago"
									>
										<Ban class="h-4 w-4" />
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

<ConfirmModal
	bind:open={showVoidModal}
	title="Anular pago"
	message={voidingPayment
		? `¿Seguro que deseas anular el pago #${voidingPayment.paymentNumber} por ${formatPrice(voidingPayment.amountUsdBcv)}?`
		: ''}
	confirmLabel="Anular"
	confirmColor="red"
	loading={voidLoading}
	onConfirm={handleVoidPayment}
	onCancel={() => {
		showVoidModal = false;
		voidingPayment = null;
	}}
/>

<ConfirmModal
	bind:open={showOverpaymentModal}
	title="Pago supera el saldo"
	message={pendingAddPayload != null && pendingBalanceUsd != null
		? `Este pago de ${formatPrice(normalized.amountUsdBcv)} supera el saldo pendiente de ${formatPrice(pendingBalanceUsd)} en ${formatPrice(normalized.amountUsdBcv - pendingBalanceUsd)}. ¿Registrar de todas formas?`
		: ''}
	confirmLabel="Registrar igual"
	confirmColor="yellow"
	{loading}
	onConfirm={async () => {
		showOverpaymentModal = false;
		if (pendingAddPayload) await submitAddPayment(pendingAddPayload);
		pendingAddPayload = null;
	}}
	onCancel={() => {
		showOverpaymentModal = false;
		pendingAddPayload = null;
	}}
/>

<ConfirmModal
	bind:open={showEarlyPaymentBenefitModal}
	title="Pronto pago disponible"
	size="lg"
	confirmLabel="Aplicar a esta PO"
	secondaryLabel="Solo anotarlo"
	cancelLabel="No registrar todavía"
	confirmColor="green"
	secondaryColor="alternative"
	{loading}
	onConfirm={() => void submitPaymentWithBenefit(true)}
	onSecondary={() => void submitPaymentWithBenefit(false)}
	onCancel={() => {
		showEarlyPaymentBenefitModal = false;
		pendingAddPayload = null;
		pendingBenefitSuggestion = null;
		benefitAmountInput = '';
		benefitNoteInput = '';
	}}
	permanent
>
	{#snippet body()}
		<div class="space-y-4 text-sm text-on-surface">
			<p>
				El pago califica para pronto pago de {pendingBenefitSuggestion?.percent ?? 0}% antes de
				{pendingBenefitSuggestion?.deadline ?? 'la fecha límite'}.
			</p>
			<label class="block space-y-2">
				<span class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Monto del beneficio USD
				</span>
				<input
					bind:value={benefitAmountInput}
					type="number"
					min="0"
					step="0.01"
					class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 font-mono text-sm text-on-surface focus:border-brand-blue focus:outline-none"
				/>
			</label>
			<label class="block space-y-2">
				<span class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Nota opcional
				</span>
				<textarea
					bind:value={benefitNoteInput}
					rows="3"
					class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
					placeholder="Ej. Proveedor aplicó redondeo o dejó crédito para próxima compra"
				></textarea>
			</label>
			<p class="rounded-xl bg-info-container/40 px-3 py-2 text-xs text-on-surface-variant">
				Aplicar a esta PO reduce el saldo y entra en reportes. Solo anotarlo guarda la decisión sin
				impacto financiero.
			</p>
		</div>
	{/snippet}
</ConfirmModal>
