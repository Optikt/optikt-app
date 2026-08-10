<script lang="ts">
	import { AlertTriangle } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { ConfirmModal } from '$lib/components/ui';
	import { cancelSale } from '$lib/remote/sales.remote';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import { RefundStatus } from '$lib/shared/enums';

	interface Props {
		open: boolean;
		saleId: string;
		paidAmountBcvUsd: number;
		onSuccess?: () => void;
	}

	let { open = $bindable(), saleId, paidAmountBcvUsd, onSuccess }: Props = $props();

	let hasPriorPayments = $derived(paidAmountBcvUsd > 0);

	// Step 1: reason + refund decision
	let cancelReason = $state('');
	let cancelReasonError = $state('');
	let refundStatus = $state('');
	let refundNotes = $state('');
	let refundNotesError = $state('');

	// Step 2: confirmation
	let showConfirmStep = $state(false);

	let actionLoading = $state(false);

	const CANCEL_REASON_SUGGESTIONS = [
		'Error en el pedido',
		'Solicitud del cliente',
		'Producto no disponible',
		'Error en los datos de la venta'
	];

	function selectCancelSuggestion(suggestion: string) {
		cancelReason = suggestion;
		cancelReasonError = '';
	}

	function resetState() {
		cancelReason = '';
		cancelReasonError = '';
		refundStatus = '';
		refundNotes = '';
		refundNotesError = '';
		showConfirmStep = false;
		actionLoading = false;
	}

	function handleClose() {
		resetState();
		open = false;
	}

	/** Validate step 1 and advance to confirmation */
	function handleProceed() {
		if (cancelReason.trim().length < 10) {
			cancelReasonError = 'El motivo debe tener al menos 10 caracteres';
			return;
		}
		cancelReasonError = '';

		if (hasPriorPayments) {
			if (!refundStatus) {
				return;
			}
			if (!refundNotes || refundNotes.trim().length < 10) {
				refundNotesError = 'La nota debe tener al menos 10 caracteres';
				return;
			}
			refundNotesError = '';
		}

		showConfirmStep = true;
	}

	async function handleConfirm() {
		actionLoading = true;
		try {
			const result = await cancelSale({
				id: saleId,
				reason: cancelReason.trim(),
				refundStatus: hasPriorPayments ? refundStatus : RefundStatus.NO_PAYMENT,
				refundNotes: hasPriorPayments ? refundNotes.trim() : undefined
			});
			if (result.success) {
				toast.success('Venta cancelada');
				handleClose();
				onSuccess?.();
			} else {
				toast.error(result.error ?? 'Error cancelando venta');
			}
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error cancelando venta'));
		} finally {
			actionLoading = false;
		}
	}

	// Dynamic props based on step
	let modalTitle = $derived(showConfirmStep ? 'Confirmar Cancelación' : 'Cancelar Venta');
	let modalConfirmLabel = $derived(showConfirmStep ? 'Cancelar Venta' : 'Continuar');
	let modalCancelLabel = $derived(showConfirmStep ? 'Volver' : 'Cancelar');

	function handleModalConfirm() {
		if (showConfirmStep) {
			handleConfirm();
		} else if (hasPriorPayments) {
			handleProceed();
		} else {
			handleConfirm();
		}
	}

	function handleModalCancel() {
		if (showConfirmStep) {
			showConfirmStep = false;
		} else {
			handleClose();
		}
	}
</script>

<ConfirmModal
	bind:open
	title={modalTitle}
	confirmLabel={modalConfirmLabel}
	cancelLabel={modalCancelLabel}
	confirmColor="red"
	loading={actionLoading}
	permanent={showConfirmStep}
	onConfirm={handleModalConfirm}
	onCancel={handleModalCancel}
>
	{#snippet icon()}
		{#if showConfirmStep}
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {refundStatus ===
				RefundStatus.REFUNDED
					? 'bg-red-100'
					: 'bg-amber-100'}"
			>
				<AlertTriangle
					class="h-5 w-5 {refundStatus === RefundStatus.REFUNDED
						? 'text-red-600'
						: 'text-amber-600'}"
				/>
			</div>
		{/if}
	{/snippet}
	{#snippet body()}
		{#if showConfirmStep}
			<!-- Step 2: Confirmation summary -->
			<div class="space-y-3">
				<p class="text-sm font-semibold text-slate-800">
					Va a cancelar esta venta. Esta acción no se puede deshacer.
				</p>

				{#if refundStatus === RefundStatus.REFUNDED}
					<div class="rounded-lg border border-red-200 bg-red-50 p-3">
						<p class="text-sm font-semibold text-red-700">
							Reembolso: {formatPrice(paidAmountBcvUsd)}
						</p>
						<p class="mt-1 text-xs text-red-600">Se devolverá este monto al cliente.</p>
					</div>
				{:else if refundStatus === RefundStatus.RETAINED}
					<div class="rounded-lg border border-amber-200 bg-amber-50 p-3">
						<p class="text-sm font-semibold text-amber-700">
							Retención: {formatPrice(paidAmountBcvUsd)}
						</p>
						<p class="mt-1 text-xs text-amber-600">El monto se queda en el negocio.</p>
					</div>
				{/if}

				<div class="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
					<p><strong>Motivo:</strong> {cancelReason}</p>
					{#if refundNotes}
						<p class="mt-1 whitespace-pre-wrap"><strong>Nota:</strong> {refundNotes}</p>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Step 1: Reason & refund decision -->
			<p class="mb-3 text-sm text-gray-700">
				¿Está seguro que desea cancelar esta venta? Se restaurará el stock de los productos y
				lentes.
			</p>
			<div class="mb-2 flex flex-wrap gap-1.5">
				{#each CANCEL_REASON_SUGGESTIONS as suggestion (suggestion)}
					<button
						type="button"
						class="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors {cancelReason ===
						suggestion
							? 'border-red-300 bg-red-50 text-red-700'
							: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}"
						onclick={() => selectCancelSuggestion(suggestion)}
					>
						{suggestion}
					</button>
				{/each}
			</div>
			<textarea
				class="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 focus:border-red-400 focus:ring-1 focus:ring-red-400"
				rows="3"
				placeholder="Motivo de cancelación (mínimo 10 caracteres)..."
				bind:value={cancelReason}
				oninput={() => (cancelReasonError = '')}></textarea>
			{#if cancelReasonError}
				<p class="mt-1 text-xs text-red-600">{cancelReasonError}</p>
			{/if}

			{#if hasPriorPayments}
				<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
					<p class="mb-1 text-sm font-semibold text-amber-800">
						Esta venta tiene pagos por {formatPrice(paidAmountBcvUsd)}.
					</p>
					<p class="mb-3 text-sm text-amber-700">¿Qué desea hacer con este monto?</p>
					<div class="mb-3 flex gap-3">
						<label
							class="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors {refundStatus ===
							RefundStatus.REFUNDED
								? 'border-red-400 bg-red-100 text-red-800'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
						>
							<input
								type="radio"
								name="refundStatus"
								value={RefundStatus.REFUNDED}
								bind:group={refundStatus}
								class="accent-red-600"
							/>
							Reembolsar - {formatPrice(paidAmountBcvUsd)} se devuelven al cliente
						</label>
						<label
							class="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors {refundStatus ===
							RefundStatus.RETAINED
								? 'border-amber-400 bg-amber-100 text-amber-800'
								: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
						>
							<input
								type="radio"
								name="refundStatus"
								value={RefundStatus.RETAINED}
								bind:group={refundStatus}
								class="accent-amber-600"
							/>
							Retener - {formatPrice(paidAmountBcvUsd)} se quedan en el negocio
						</label>
					</div>

					{#if !refundStatus}
						<p class="mb-3 text-xs text-amber-700">Seleccione una opción para continuar.</p>
					{/if}

					<p class="mb-3 text-xs text-amber-600">
						Para reembolsos parciales, seleccione «Retener» y registre el ajuste como gasto manual.
					</p>

					{#if refundStatus}
						<div>
							<label for="refundNotes" class="mb-1 block text-xs font-medium text-slate-700">
								Nota ({refundStatus === RefundStatus.REFUNDED ? 'reembolso' : 'retención'})
							</label>
							<textarea
								id="refundNotes"
								class="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
								rows="2"
								placeholder="Detalle sobre la decisión (mínimo 10 caracteres)..."
								bind:value={refundNotes}
								oninput={() => (refundNotesError = '')}></textarea>
							{#if refundNotesError}
								<p class="mt-1 text-xs text-red-600">{refundNotesError}</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	{/snippet}
</ConfirmModal>
