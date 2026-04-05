<script lang="ts">
	import { Button, Select, Label, Helper } from 'flowbite-svelte';
	import { ArrowLeft, Plus, Minus, AlertTriangle } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { formatPrice, formatDate, getErrorMessage } from '$lib/utils';
	import { FormInput, FormTextarea, ConfirmModal } from '$lib/components/ui';
	import { createManualAdjustmentCmd } from '$lib/remote/inventory.remote';
	import {
		InventoryMovementType,
		AdjustmentReason,
		ALL_ADJUSTMENT_REASONS,
		ADJUSTMENT_REASON_LABELS,
		LOSS_REASONS,
		ADJUSTMENT_REPORT_CATEGORIES
	} from '$lib/shared/enums';
	import type { InventoryLot } from '$lib/server/db/schema';

	let { data } = $props();
	const product = untrack(() => data.product);
	const activeLots = untrack(() => data.activeLots) as InventoryLot[];

	// Form state
	let selectedLotId = $state('');
	let adjustmentType = $state<string>(InventoryMovementType.ADJUSTMENT_OUT);
	let quantity = $state('');
	let reason = $state('');
	let notes = $state('');
	let isSubmitting = $state(false);

	// Confirm modal for financial-impact adjustments
	let showConfirmModal = $state(false);

	const selectedLot = $derived(activeLots.find((l) => l.id === selectedLotId) ?? null);

	const isOutflow = $derived(adjustmentType === InventoryMovementType.ADJUSTMENT_OUT);

	const parsedQuantity = $derived(parseInt(quantity, 10) || 0);

	// CUSTOMER_RETURN forces ADJUSTMENT_IN
	const isCustomerReturn = $derived(reason === AdjustmentReason.CUSTOMER_RETURN);
	$effect(() => {
		if (isCustomerReturn) {
			untrack(() => {
				adjustmentType = InventoryMovementType.ADJUSTMENT_IN;
			});
		}
	});

	// Validation
	const quantityError = $derived.by(() => {
		if (parsedQuantity <= 0) return null; // don't show until user types
		if (isOutflow && selectedLot && parsedQuantity > selectedLot.quantityAvailable) {
			return `Máximo disponible: ${selectedLot.quantityAvailable}`;
		}
		return null;
	});

	const canSubmit = $derived(
		selectedLotId !== '' &&
			reason !== '' &&
			parsedQuantity > 0 &&
			notes.length >= 10 &&
			!quantityError &&
			!isSubmitting
	);

	// Financial impact warning
	const showsFinancialWarning = $derived(
		isOutflow && LOSS_REASONS.includes(reason as AdjustmentReason) && selectedLot != null
	);

	const estimatedLoss = $derived(
		showsFinancialWarning && selectedLot ? selectedLot.unitPurchasePrice * parsedQuantity : 0
	);

	const currentMonth = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(
		new Date()
	);

	// Lot options for select
	const lotOptions = $derived(
		activeLots.map((lot) => ({
			value: lot.id,
			name: `LOT-${String(lot.lotNumber).padStart(4, '0')} — ${lot.quantityAvailable} uds — ${formatPrice(lot.unitPurchasePrice)}/ud`
		}))
	);

	// Reason options for select
	const reasonOptions = $derived(
		ALL_ADJUSTMENT_REASONS.map((r) => ({
			value: r,
			name: ADJUSTMENT_REASON_LABELS[r]
		}))
	);

	// Type options for select
	const typeOptions = [
		{ value: InventoryMovementType.ADJUSTMENT_OUT, name: 'Salida (-)' },
		{ value: InventoryMovementType.ADJUSTMENT_IN, name: 'Entrada (+)' }
	];

	function handleSubmit() {
		if (!canSubmit) return;

		// Show confirmation modal for financial-impact adjustments
		if (showsFinancialWarning) {
			showConfirmModal = true;
			return;
		}

		executeAdjustment();
	}

	async function executeAdjustment() {
		showConfirmModal = false;
		isSubmitting = true;

		try {
			const result = await createManualAdjustmentCmd({
				lotId: selectedLotId,
				adjustmentType: adjustmentType as
					| InventoryMovementType.ADJUSTMENT_IN
					| InventoryMovementType.ADJUSTMENT_OUT,
				quantity: parsedQuantity,
				reason: reason as AdjustmentReason,
				notes
			});

			if (result.success) {
				const label = isOutflow ? 'Salida' : 'Entrada';
				toast.success(
					`${label} registrada: ${parsedQuantity} uds. Stock del lote: ${result.newQuantityAvailable}`
				);
				goto(resolve(`/products/${product.id}`));
			} else {
				toast.error(result.error ?? 'Error al registrar ajuste');
			}
		} catch (e) {
			console.error('Error creating adjustment:', e);
			toast.error(getErrorMessage(e, 'Error al registrar ajuste'));
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Ajuste de Inventario — {product.name} - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-slate-50/50 p-8">
	<div class="mx-auto max-w-2xl">
		<!-- Header -->
		<div class="mb-8">
			<a
				href={resolve(`/products/${product.id}`)}
				class="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-700"
			>
				<ArrowLeft class="h-4 w-4" />
				Volver a {product.name}
			</a>

			<h1 class="text-2xl font-bold tracking-tight text-slate-900">Ajuste Manual de Inventario</h1>
			<p class="mt-1 text-sm text-slate-500">
				{product.name} — SKU: <span class="font-mono">{product.sku}</span>
			</p>
		</div>

		{#if activeLots.length === 0}
			<div class="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
				<p class="text-slate-500">Este producto no tiene lotes activos para ajustar.</p>
				<Button color="alternative" class="mt-4" href={resolve(`/products/${product.id}`)}>
					Volver al producto
				</Button>
			</div>
		{:else}
			<div class="space-y-6">
				<!-- Lot Selection -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-800">1. Seleccionar Lote</h3>
					<div>
						<Label for="lot-select" class="mb-2">Lote</Label>
						<Select
							id="lot-select"
							bind:value={selectedLotId}
							items={[{ value: '', name: 'Seleccionar lote...' }, ...lotOptions]}
						/>
					</div>

					{#if selectedLot}
						<div class="mt-4 grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
							<div>
								<dt class="text-slate-500">Disponible</dt>
								<dd class="font-mono font-semibold text-slate-900">
									{selectedLot.quantityAvailable} uds
								</dd>
							</div>
							<div>
								<dt class="text-slate-500">Costo unitario</dt>
								<dd class="font-mono font-semibold text-slate-900">
									{formatPrice(selectedLot.unitPurchasePrice)}
								</dd>
							</div>
							<div>
								<dt class="text-slate-500">Fecha ingreso</dt>
								<dd class="text-slate-700">{formatDate(selectedLot.createdAt)}</dd>
							</div>
						</div>
					{/if}
				</div>

				<!-- Adjustment Details -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 text-lg font-semibold text-slate-800">2. Detalle del Ajuste</h3>

					<div class="space-y-4">
						<!-- Type -->
						<div>
							<Label for="adjustment-type" class="mb-2">Tipo de ajuste</Label>
							<Select
								id="adjustment-type"
								bind:value={adjustmentType}
								items={typeOptions}
								disabled={isCustomerReturn}
							/>
							{#if isCustomerReturn}
								<Helper class="mt-1" color="blue">Las devoluciones siempre son entrada (+)</Helper>
							{/if}
						</div>

						<!-- Reason -->
						<div>
							<Label for="reason-select" class="mb-2">Motivo</Label>
							<Select
								id="reason-select"
								bind:value={reason}
								items={[{ value: '', name: 'Seleccionar motivo...' }, ...reasonOptions]}
							/>
						</div>

						<!-- Quantity -->
						<div>
							<FormInput
								label="Cantidad"
								type="number"
								bind:value={quantity}
								min="1"
								max={isOutflow && selectedLot ? String(selectedLot.quantityAvailable) : undefined}
								placeholder="Ej: 5"
								error={quantityError}
							/>
						</div>

						<!-- Notes -->
						<div>
							<FormTextarea
								label="Notas (mínimo 10 caracteres)"
								bind:value={notes}
								placeholder="Describir el motivo del ajuste con detalle..."
								rows={3}
								error={notes.length > 0 && notes.length < 10
									? `${10 - notes.length} caracteres más requeridos`
									: null}
							/>
						</div>
					</div>
				</div>

				<!-- Financial Impact Warning -->
				{#if showsFinancialWarning && parsedQuantity > 0}
					<div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
						<div class="flex items-start gap-3">
							<AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
							<div>
								<p class="font-medium text-amber-800">Impacto financiero</p>
								<p class="mt-1 text-sm text-amber-700">
									Esta acción registrará una pérdida de
									<span class="font-mono font-semibold">
										{formatPrice(estimatedLoss)}
									</span>
									como "{ADJUSTMENT_REPORT_CATEGORIES[reason as AdjustmentReason]}" en el reporte de {currentMonth}.
								</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Summary & Submit -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					{#if selectedLot && parsedQuantity > 0}
						<div class="mb-4 rounded-lg bg-slate-50 p-4 text-sm">
							<p class="font-medium text-slate-700">
								Resumen:
								{#if isOutflow}
									<Minus class="inline h-4 w-4 text-red-500" />
									<span class="font-mono text-red-600">{parsedQuantity}</span> uds del lote
								{:else}
									<Plus class="inline h-4 w-4 text-green-500" />
									<span class="font-mono text-green-600">{parsedQuantity}</span> uds al lote
								{/if}
								<span class="font-mono">
									LOT-{String(selectedLot.lotNumber).padStart(4, '0')}
								</span>
							</p>
							<p class="mt-1 text-slate-500">
								Stock del lote: {selectedLot.quantityAvailable} →
								<span class="font-mono font-semibold">
									{selectedLot.quantityAvailable + (isOutflow ? -parsedQuantity : parsedQuantity)}
								</span>
							</p>
						</div>
					{/if}

					<div class="flex justify-end gap-3">
						<Button color="alternative" href={resolve(`/products/${product.id}`)}>Cancelar</Button>
						<Button color="blue" onclick={handleSubmit} disabled={!canSubmit}>
							{#if isSubmitting}
								Registrando...
							{:else}
								Registrar Ajuste
							{/if}
						</Button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Financial Impact Confirmation Modal -->
<ConfirmModal
	bind:open={showConfirmModal}
	title="Confirmar pérdida operativa"
	message={`Esta acción registrará una pérdida de ${formatPrice(estimatedLoss)} como "${reason ? ADJUSTMENT_REPORT_CATEGORIES[reason as AdjustmentReason] : ''}" en el reporte de ${currentMonth}.`}
	confirmLabel="Confirmar ajuste"
	confirmColor="red"
	loading={isSubmitting}
	onConfirm={executeAdjustment}
	onCancel={() => (showConfirmModal = false)}
/>
