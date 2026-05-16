<script lang="ts">
	import { CalendarClock, CreditCard, Percent, Save } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { AppBadge } from '$lib/components/ui';
	import { setPurchaseOrderCreditTermsCmd } from '$lib/remote/purchaseOrders.remote';
	import {
		PurchaseOrderStatus,
		PurchasePaymentTerms,
		getPurchasePaymentTermsLabel
	} from '$lib/shared/enums';
	import type {
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';
	import type { PurchaseOrder, PurchaseOrderEarlyPaymentBenefit } from '$lib/server/db/schema';
	import { formatDateOnly, getErrorMessage } from '$lib/utils';

	interface Props {
		purchaseOrder: PurchaseOrder;
		readonly?: boolean;
		onCreditUpdated?: (payload: {
			purchaseOrder: PurchaseOrder;
			earlyPaymentBenefits: PurchaseOrderEarlyPaymentBenefit[];
			balance: PurchaseOrderBalanceSummary;
			dueStatus: PurchaseOrderDueStatus;
		}) => void;
	}

	let { purchaseOrder, readonly = false, onCreditUpdated }: Props = $props();

	let paymentTerms = $state<PurchasePaymentTerms>(PurchasePaymentTerms.CONTADO);
	let creditDueDate = $state<string | null>(null);
	let earlyPaymentDiscountPercent = $state<number | null>(null);
	let earlyPaymentDiscountDeadline = $state<string | null>(null);
	let saving = $state(false);

	$effect(() => {
		paymentTerms =
			(purchaseOrder.paymentTerms as PurchasePaymentTerms) ?? PurchasePaymentTerms.CONTADO;
		creditDueDate = purchaseOrder.creditDueDate;
		earlyPaymentDiscountPercent = purchaseOrder.earlyPaymentDiscountPercent;
		earlyPaymentDiscountDeadline = purchaseOrder.earlyPaymentDiscountDeadline;
	});

	const isCredit = $derived(paymentTerms === PurchasePaymentTerms.CREDIT);
	const hasEarlyPayment = $derived(
		Number(earlyPaymentDiscountPercent ?? 0) > 0 && Boolean(earlyPaymentDiscountDeadline)
	);
	const canManage = $derived(!readonly && purchaseOrder.status !== PurchaseOrderStatus.CANCELLED);

	function parseOptionalNumber(value: string): number | null {
		const normalized = value.trim();
		if (!normalized) return null;
		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function validateForm(): string | null {
		if (paymentTerms === PurchasePaymentTerms.CONTADO) return null;
		if (!creditDueDate) return 'Debes indicar la fecha de vencimiento del crédito';
		if (Number(earlyPaymentDiscountPercent ?? 0) > 0 && !earlyPaymentDiscountDeadline) {
			return 'Debes indicar el límite de pronto pago';
		}
		if (earlyPaymentDiscountDeadline && !Number(earlyPaymentDiscountPercent ?? 0)) {
			return 'Debes indicar el porcentaje de pronto pago';
		}
		if (earlyPaymentDiscountDeadline && earlyPaymentDiscountDeadline > creditDueDate) {
			return 'La fecha de pronto pago no puede ser posterior al vencimiento';
		}
		return null;
	}

	async function handleSave() {
		const validationError = validateForm();
		if (validationError) {
			toast.error(validationError);
			return;
		}

		saving = true;
		try {
			const result = await setPurchaseOrderCreditTermsCmd({
				purchaseOrderId: purchaseOrder.id,
				paymentTerms,
				creditDueDate,
				earlyPaymentDiscountPercent,
				earlyPaymentDiscountDeadline
			});

			if (!result.success) {
				toast.error(result.error ?? 'Error guardando la configuración de crédito');
				return;
			}

			onCreditUpdated?.({
				purchaseOrder: result.purchaseOrder,
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			});
			toast.success('Configuración de crédito guardada');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error guardando crédito'));
		} finally {
			saving = false;
		}
	}
</script>

<section class="glass-card overflow-hidden">
	<div
		class="flex flex-col gap-4 border-b border-outline-variant/15 bg-surface-container-lowest px-6 py-5 md:flex-row md:items-center md:justify-between"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
			>
				<CreditCard class="h-5 w-5" />
			</div>
			<div>
				<h2 class="text-xl font-semibold text-brand-navy">Condición de pago</h2>
				<p class="text-sm text-on-surface-variant">
					{readonly
						? 'Términos pactados con el proveedor.'
						: 'Configura vencimiento y pronto pago con una sola fecha acordada.'}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-3">
			<AppBadge variant="neutral">{getPurchasePaymentTermsLabel(paymentTerms)}</AppBadge>
			{#if hasEarlyPayment}
				<AppBadge variant="info">Pronto pago</AppBadge>
			{/if}
		</div>
	</div>

	<div class="space-y-5 px-6 py-6">
		{#if canManage}
			<div class="inline-flex rounded-xl bg-surface-container-low p-1 text-sm font-semibold">
				<button
					type="button"
					onclick={() => {
						paymentTerms = PurchasePaymentTerms.CONTADO;
						creditDueDate = null;
						earlyPaymentDiscountPercent = null;
						earlyPaymentDiscountDeadline = null;
					}}
					class={[
						'rounded-lg px-4 py-2 transition-colors',
						paymentTerms === PurchasePaymentTerms.CONTADO
							? 'bg-surface-container-lowest text-brand-navy shadow-sm'
							: 'text-on-surface-variant hover:text-brand-navy'
					]}
					aria-pressed={paymentTerms === PurchasePaymentTerms.CONTADO}
				>
					Contado
				</button>
				<button
					type="button"
					onclick={() => (paymentTerms = PurchasePaymentTerms.CREDIT)}
					class={[
						'rounded-lg px-4 py-2 transition-colors',
						paymentTerms === PurchasePaymentTerms.CREDIT
							? 'bg-surface-container-lowest text-brand-navy shadow-sm'
							: 'text-on-surface-variant hover:text-brand-navy'
					]}
					aria-pressed={paymentTerms === PurchasePaymentTerms.CREDIT}
				>
					Crédito
				</button>
			</div>
		{/if}

		{#if isCredit}
			<div class="grid gap-4 md:grid-cols-3">
				<label class="rounded-2xl bg-surface-container-low p-4">
					<span class="flex items-center gap-2 text-sm text-on-surface-variant">
						<CalendarClock class="h-4 w-4" />
						Vencimiento
					</span>
					{#if canManage}
						<input
							bind:value={creditDueDate}
							type="date"
							class="mt-3 w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-3 py-2.5 text-sm text-brand-navy"
						/>
					{:else}
						<p class="mt-3 font-mono text-lg font-semibold text-brand-navy tabular-nums">
							{creditDueDate ? formatDateOnly(creditDueDate) : 'Sin fecha'}
						</p>
					{/if}
				</label>

				<label class="rounded-2xl bg-surface-container-low p-4">
					<span class="flex items-center gap-2 text-sm text-on-surface-variant">
						<Percent class="h-4 w-4" />
						Pronto pago
					</span>
					{#if canManage}
						<input
							value={earlyPaymentDiscountPercent ?? ''}
							type="number"
							min="0"
							max="100"
							step="0.01"
							oninput={(event) =>
								(earlyPaymentDiscountPercent = parseOptionalNumber(
									(event.currentTarget as HTMLInputElement).value
								))}
							class="mt-3 w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-3 py-2.5 font-mono text-sm text-brand-navy"
							placeholder="5"
						/>
					{:else}
						<p class="mt-3 font-mono text-lg font-semibold text-brand-navy tabular-nums">
							{earlyPaymentDiscountPercent ? `${earlyPaymentDiscountPercent}%` : 'No aplica'}
						</p>
					{/if}
				</label>

				<label class="rounded-2xl bg-surface-container-low p-4">
					<span class="flex items-center gap-2 text-sm text-on-surface-variant">
						<CalendarClock class="h-4 w-4" />
						Límite pronto pago
					</span>
					{#if canManage}
						<input
							bind:value={earlyPaymentDiscountDeadline}
							type="date"
							class="mt-3 w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest px-3 py-2.5 text-sm text-brand-navy"
						/>
					{:else}
						<p class="mt-3 font-mono text-lg font-semibold text-brand-navy tabular-nums">
							{earlyPaymentDiscountDeadline
								? formatDateOnly(earlyPaymentDiscountDeadline)
								: 'No aplica'}
						</p>
					{/if}
				</label>
			</div>
		{:else}
			<div class="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
				Orden de contado. No hay vencimiento de crédito ni pronto pago configurado.
			</div>
		{/if}

		{#if canManage}
			<button
				type="button"
				onclick={handleSave}
				disabled={saving}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-xs font-semibold tracking-[0.14em] text-white uppercase transition-colors hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
			>
				<Save class="h-4 w-4" />
				{saving ? 'Guardando...' : 'Guardar términos'}
			</button>
		{/if}

		{#if hasEarlyPayment && isCredit}
			<p class="text-sm text-on-surface-variant">
				El beneficio se calcula y registra al cargar un pago elegible. No modifica costos de
				inventario.
			</p>
		{/if}
	</div>
</section>
