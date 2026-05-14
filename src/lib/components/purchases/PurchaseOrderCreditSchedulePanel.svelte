<script lang="ts">
	import { CalendarDays, CreditCard, Plus, Save, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { AppBadge } from '$lib/components/ui';
	import { setPurchaseOrderCreditScheduleCmd } from '$lib/remote/purchaseOrders.remote';
	import {
		PurchaseOrderStatus,
		PurchasePaymentTerms,
		getPurchasePaymentTermsLabel
	} from '$lib/shared/enums';
	import type {
		PurchaseOrderBalanceSummary,
		PurchaseOrderDueStatus
	} from '$lib/shared/purchaseOrderCredit';
	import type { PurchaseOrder, PurchaseOrderCreditInstallment } from '$lib/server/db/schema';
	import { formatDateOnly, formatPrice, getErrorMessage } from '$lib/utils';

	interface InstallmentFormRow {
		localId: string;
		installmentNumber: number;
		dueDate: string;
		expectedAmountUsd: string;
		earlyPaymentDiscountPercent: string;
		earlyPaymentDiscountDeadline: string;
		notes: string;
	}

	interface Props {
		purchaseOrder: PurchaseOrder;
		creditSchedule: PurchaseOrderCreditInstallment[];
		readonly?: boolean;
		onCreditUpdated?: (payload: {
			purchaseOrder: PurchaseOrder;
			creditSchedule: PurchaseOrderCreditInstallment[];
			balance: PurchaseOrderBalanceSummary;
			dueStatus: PurchaseOrderDueStatus;
		}) => void;
	}

	let { purchaseOrder, creditSchedule, readonly = false, onCreditUpdated }: Props = $props();

	let paymentTerms = $state<PurchasePaymentTerms>(PurchasePaymentTerms.CONTADO);
	let rows = $state<InstallmentFormRow[]>([]);
	let saving = $state(false);

	function toRows(schedule: PurchaseOrderCreditInstallment[]): InstallmentFormRow[] {
		return schedule.map((installment) => ({
			localId: installment.id,
			installmentNumber: installment.installmentNumber,
			dueDate: installment.dueDate,
			expectedAmountUsd:
				installment.expectedAmountUsd == null ? '' : String(installment.expectedAmountUsd),
			earlyPaymentDiscountPercent:
				installment.earlyPaymentDiscountPercent == null
					? ''
					: String(installment.earlyPaymentDiscountPercent),
			earlyPaymentDiscountDeadline: installment.earlyPaymentDiscountDeadline ?? '',
			notes: installment.notes ?? ''
		}));
	}

	function addRow() {
		rows = [
			...rows,
			{
				localId: crypto.randomUUID(),
				installmentNumber: rows.length + 1,
				dueDate: '',
				expectedAmountUsd: '',
				earlyPaymentDiscountPercent: '',
				earlyPaymentDiscountDeadline: '',
				notes: ''
			}
		];
	}

	function removeRow(localId: string) {
		rows = rows
			.filter((row) => row.localId !== localId)
			.map((row, index) => ({ ...row, installmentNumber: index + 1 }));
	}

	$effect(() => {
		paymentTerms =
			(purchaseOrder.paymentTerms as PurchasePaymentTerms) ?? PurchasePaymentTerms.CONTADO;
		rows = toRows(creditSchedule);
	});

	const isCredit = $derived(paymentTerms === PurchasePaymentTerms.CREDIT);
	const canManage = $derived(!readonly && purchaseOrder.status !== PurchaseOrderStatus.CANCELLED);

	function validateForm(): string | null {
		if (paymentTerms === PurchasePaymentTerms.CONTADO) return null;
		if (rows.length === 0) return 'Debes registrar al menos una cuota';

		for (const row of rows) {
			if (!row.dueDate) return `La cuota #${row.installmentNumber} requiere fecha de vencimiento`;
			if (rows.length > 1 && !row.expectedAmountUsd) {
				return `La cuota #${row.installmentNumber} requiere monto esperado`;
			}
			if (
				(row.earlyPaymentDiscountPercent && !row.earlyPaymentDiscountDeadline) ||
				(!row.earlyPaymentDiscountPercent && row.earlyPaymentDiscountDeadline)
			) {
				return `La cuota #${row.installmentNumber} debe completar ambos campos de pronto pago`;
			}
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
			const result = await setPurchaseOrderCreditScheduleCmd({
				purchaseOrderId: purchaseOrder.id,
				paymentTerms,
				installments: isCredit
					? rows.map((row) => ({
							installmentNumber: row.installmentNumber,
							dueDate: row.dueDate,
							expectedAmountUsd: row.expectedAmountUsd ? Number(row.expectedAmountUsd) : undefined,
							earlyPaymentDiscountPercent: row.earlyPaymentDiscountPercent
								? Number(row.earlyPaymentDiscountPercent)
								: undefined,
							earlyPaymentDiscountDeadline: row.earlyPaymentDiscountDeadline || undefined,
							notes: row.notes || undefined
						}))
					: []
			});

			if (!result.success) {
				toast.error(result.error ?? 'Error guardando la configuración de crédito');
				return;
			}

			paymentTerms = result.purchaseOrder.paymentTerms as PurchasePaymentTerms;
			rows = toRows(result.creditSchedule);
			onCreditUpdated?.({
				purchaseOrder: result.purchaseOrder,
				creditSchedule: result.creditSchedule,
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
						? 'Consulta el cronograma pactado con el proveedor.'
						: 'Configura si la compra es de contado o a crédito.'}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-3">
			<AppBadge variant="neutral">{getPurchasePaymentTermsLabel(paymentTerms)}</AppBadge>
			<AppBadge variant="neutral">{rows.length} cuota{rows.length === 1 ? '' : 's'}</AppBadge>
		</div>
	</div>

	<div class="space-y-5 px-6 py-6">
		{#if !readonly}
			<div class="inline-flex rounded-xl bg-surface-container-low p-1 text-sm font-semibold">
				<button
					type="button"
					onclick={() => (paymentTerms = PurchasePaymentTerms.CONTADO)}
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
					onclick={() => {
						paymentTerms = PurchasePaymentTerms.CREDIT;
						if (rows.length === 0) addRow();
					}}
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
			<div class="space-y-4">
				{#if readonly}
					<div class="overflow-x-auto">
						<table class="min-w-full text-left text-sm">
							<thead class="text-[11px] tracking-[0.18em] text-slate-500 uppercase">
								<tr>
									<th class="px-3 py-2">Cuota</th>
									<th class="px-3 py-2">Vencimiento</th>
									<th class="px-3 py-2 text-right">Monto esperado</th>
									<th class="px-3 py-2">Pronto pago</th>
									<th class="px-3 py-2">Notas</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-outline-variant/15">
								{#each rows as row (row.localId)}
									<tr>
										<td class="px-3 py-3 font-mono text-sm font-semibold text-brand-navy">
											#{row.installmentNumber}
										</td>
										<td class="px-3 py-3 text-on-surface">
											{row.dueDate
												? formatDateOnly(row.dueDate, { dateStyle: 'medium' })
												: 'Sin fecha'}
										</td>
										<td class="px-3 py-3 text-right font-mono text-brand-navy tabular-nums">
											{row.expectedAmountUsd
												? formatPrice(Number(row.expectedAmountUsd))
												: 'Pendiente'}
										</td>
										<td class="px-3 py-3 text-on-surface-variant">
											{#if row.earlyPaymentDiscountPercent && row.earlyPaymentDiscountDeadline}
												{row.earlyPaymentDiscountPercent}% hasta {formatDateOnly(
													row.earlyPaymentDiscountDeadline,
													{ dateStyle: 'medium' }
												)}
											{:else}
												Sin pronto pago
											{/if}
										</td>
										<td class="px-3 py-3 text-on-surface-variant">
											{row.notes || 'Sin notas'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="flex items-center justify-between gap-3">
						<p class="text-sm text-on-surface-variant">
							Para cuotas múltiples, cada cuota debe indicar monto esperado.
						</p>
						<button
							type="button"
							onclick={addRow}
							class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs font-semibold tracking-[0.14em] text-brand-navy uppercase transition-colors hover:bg-surface-container-high"
						>
							<Plus class="h-4 w-4" />
							Agregar cuota
						</button>
					</div>

					<div class="space-y-4">
						{#each rows as row (row.localId)}
							<div
								class="rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 p-4"
							>
								<div class="mb-4 flex items-center justify-between gap-3">
									<div class="flex items-center gap-2 text-sm font-semibold text-brand-navy">
										<CalendarDays class="h-4 w-4" />
										Cuota #{row.installmentNumber}
									</div>
									{#if rows.length > 1}
										<button
											type="button"
											onclick={() => removeRow(row.localId)}
											class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-error-container/60 text-on-error-container transition-colors hover:bg-error-container"
											title="Eliminar cuota"
										>
											<Trash2 class="h-4 w-4" />
										</button>
									{/if}
								</div>

								<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
									<label class="space-y-2 text-sm">
										<span
											class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
											>Vencimiento</span
										>
										<input
											bind:value={row.dueDate}
											type="date"
											class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
										/>
									</label>

									<label class="space-y-2 text-sm">
										<span
											class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
											>Monto esperado USD</span
										>
										<input
											bind:value={row.expectedAmountUsd}
											type="number"
											min="0"
											step="0.01"
											class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 font-mono text-sm text-on-surface focus:border-brand-blue focus:outline-none"
											placeholder="Opcional si es cuota única"
										/>
									</label>

									<label class="space-y-2 text-sm">
										<span
											class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
											>% pronto pago</span
										>
										<input
											bind:value={row.earlyPaymentDiscountPercent}
											type="number"
											min="0"
											step="0.01"
											class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 font-mono text-sm text-on-surface focus:border-brand-blue focus:outline-none"
											placeholder="0.00"
										/>
									</label>

									<label class="space-y-2 text-sm">
										<span
											class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
											>Límite pronto pago</span
										>
										<input
											bind:value={row.earlyPaymentDiscountDeadline}
											type="date"
											class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
										/>
									</label>
								</div>

								<label class="mt-4 block space-y-2 text-sm">
									<span class="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase"
										>Notas</span
									>
									<input
										bind:value={row.notes}
										type="text"
										class="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-3 text-sm text-on-surface focus:border-brand-blue focus:outline-none"
										placeholder="Condiciones particulares o referencia"
									/>
								</label>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div class="rounded-2xl bg-surface-container-low/55 p-4 text-sm text-on-surface-variant">
				{readonly
					? 'Esta orden se gestiona como contado. No tiene cronograma de vencimientos asociado.'
					: 'Esta orden se gestionará como contado. Si luego necesitas control de vencimientos, puedes cambiarla a crédito aquí mismo.'}
			</div>
		{/if}

		{#if !readonly}
			<div class="flex justify-end">
				<button
					type="button"
					onclick={handleSave}
					disabled={!canManage || saving}
					class="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-3 text-xs font-semibold tracking-[0.14em] text-white uppercase transition-colors hover:bg-brand-navy/90 disabled:cursor-not-allowed disabled:opacity-60"
				>
					<Save class="h-4 w-4" />
					{saving ? 'Guardando...' : 'Guardar condición'}
				</button>
			</div>
		{/if}
	</div>
</section>
