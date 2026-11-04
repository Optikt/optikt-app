<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { ConfirmModal } from '$lib/components/ui';
	import { registerPurchaseOrderEarlyPaymentBenefitCmd } from '$lib/remote/purchaseOrders/payments.remote';
	import { nowUTC, toISODate } from '$lib/dates';
	import { getErrorMessage } from '$lib/utils';
	import type { PurchaseOrder } from '$lib/server/db/schema';
	import type {
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';

	interface Props {
		open: boolean;
		purchaseOrder: PurchaseOrder;
		balance: PurchaseOrderBalanceSummary;
		onRegistered?: (payload: {
			earlyPaymentBenefits: import('$lib/server/db/schema').PurchaseOrderEarlyPaymentBenefit[];
			balance: PurchaseOrderBalanceSummary;
			dueStatus: PurchaseOrderDueStatus;
		}) => void;
	}

	let { open = $bindable(), purchaseOrder, balance, onRegistered }: Props = $props();

	let amountInput = $state('');
	let dateInput = $state('');
	let noteInput = $state('');
	let submitting = $state(false);

	const percent = $derived(Number(purchaseOrder.earlyPaymentDiscountPercent ?? 0));
	const deadline = $derived(purchaseOrder.earlyPaymentDiscountDeadline ?? '');
	const suggestedAmount = $derived(
		Math.min(
			(Number(purchaseOrder.settlementDebtAmount ?? 0) * percent) / 100,
			balance.settlementBalance
		)
	);

	$effect(() => {
		if (open) {
			amountInput = Math.max(suggestedAmount, 0).toFixed(2);
			const today = toISODate(nowUTC());
			dateInput = deadline && deadline < today ? deadline : today;
			noteInput = '';
		}
	});

	async function handleConfirm() {
		const amount = Number(amountInput || 0);
		if (!Number.isFinite(amount) || amount <= 0) {
			toast.error('Monto de beneficio inválido');
			return;
		}
		submitting = true;
		try {
			const result = await registerPurchaseOrderEarlyPaymentBenefitCmd({
				purchaseOrderId: purchaseOrder.id,
				amount,
				benefitDate: dateInput,
				appliedToBalance: true,
				note: noteInput.trim() || undefined
			});
			if (!result.success) {
				toast.error(result.error ?? 'Error registrando pronto pago');
				return;
			}
			toast.success('Pronto pago registrado');
			onRegistered?.({
				earlyPaymentBenefits: result.earlyPaymentBenefits,
				balance: result.balance,
				dueStatus: result.dueStatus
			});
			open = false;
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error registrando pronto pago'));
		} finally {
			submitting = false;
		}
	}
</script>

<ConfirmModal
	bind:open
	title="Registrar pronto pago"
	size="lg"
	confirmLabel="Registrar beneficio"
	confirmColor="green"
	loading={submitting}
	onConfirm={handleConfirm}
	permanent
>
	{#snippet body()}
		<div class="space-y-4 text-sm text-on-surface">
			<p>
				La orden tiene pronto pago de <strong>{percent}%</strong>
				{#if deadline}
					hasta {deadline}
				{/if}. Este beneficio reduce el saldo directamente, sin asociarse a un pago.
			</p>
			<label class="block space-y-2">
				<span class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Monto del beneficio
				</span>
				<input
					bind:value={amountInput}
					type="number"
					min="0"
					step="0.01"
					class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 font-mono text-sm text-on-surface focus:border-brand-blue focus:outline-none"
				/>
				<p class="text-xs text-on-surface-variant">
					Máximo sugerido: {suggestedAmount.toFixed(2)} de un saldo de {balance.settlementBalance.toFixed(
						2
					)}.
				</p>
			</label>
			<label class="block space-y-2">
				<span class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Fecha del beneficio
				</span>
				<input
					bind:value={dateInput}
					type="date"
					max={deadline || undefined}
					class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
				/>
			</label>
			<label class="block space-y-2">
				<span class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase">
					Nota opcional
				</span>
				<textarea
					bind:value={noteInput}
					rows="2"
					class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
					placeholder="Ej. Pago realizado el 09/10 dentro del plazo, registrado tarde"></textarea>
			</label>
		</div>
	{/snippet}
</ConfirmModal>
