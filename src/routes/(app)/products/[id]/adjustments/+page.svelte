<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import AdjustmentImpactCard from '$lib/components/products/adjustments/AdjustmentImpactCard.svelte';
	import AdjustmentLotSelectionCard from '$lib/components/products/adjustments/AdjustmentLotSelectionCard.svelte';
	import AdjustmentStepRail from '$lib/components/products/adjustments/AdjustmentStepRail.svelte';
	import {
		buildAdjustmentSteps,
		getAllowedAdjustmentTypes,
		getDefaultAdjustmentType,
		getNotesRemaining,
		getProjectedLotQuantity,
		type ManualAdjustmentType
	} from '$lib/components/products/adjustments/helpers';
	import AdjustDetailsForm from '$lib/components/products/adjust/AdjustDetailsForm.svelte';
	import AdjustEmptyState from '$lib/components/products/adjust/AdjustEmptyState.svelte';
	import AdjustHeader from '$lib/components/products/adjust/AdjustHeader.svelte';
	import AdjustInfoTrio from '$lib/components/products/adjust/AdjustInfoTrio.svelte';
	import AdjustSummaryCard from '$lib/components/products/adjust/AdjustSummaryCard.svelte';
	import {
		buildReasonOptions,
		findLastManualAdjustment,
		getDirectionHint,
		getQuantityError
	} from '$lib/components/products/adjust/adjustmentView';
	import { ConfirmModal } from '$lib/components/ui';
	import { nowUTC } from '$lib/dates';
	import { createManualAdjustmentCmd } from '$lib/remote/inventory.remote';
	import {
		AdjustmentReason,
		ADJUSTMENT_REASON_LABELS,
		ADJUSTMENT_REPORT_CATEGORIES,
		InventoryMovementType,
		LOSS_REASONS,
		MovementReferenceType
	} from '$lib/shared/enums';
	import type { InventoryLot } from '$lib/server/db/schema';
	import { formatDate, formatPrice, getErrorMessage } from '$lib/utils';

	let { data } = $props();
	const product = untrack(() => data.product);
	const activeLots = untrack(() => data.activeLots) as InventoryLot[];
	const fifoCost = untrack(() => data.fifoCost) as number | null;
	const productMovements = untrack(() => data.productMovements);

	let selectedLotId = $state('');
	let selectedAdjustmentType = $state<ManualAdjustmentType | null>(null);
	let quantity = $state('');
	let reason = $state('');
	let notes = $state('');
	let isSubmitting = $state(false);
	let showConfirmModal = $state(false);

	const selectedLot = $derived(activeLots.find((lot) => lot.id === selectedLotId) ?? null);
	const realStock = $derived(activeLots.reduce((sum, lot) => sum + lot.quantityAvailable, 0));
	const parsedQuantity = $derived(parseInt(quantity, 10) || 0);
	const selectedReason = $derived(reason === '' ? null : (reason as AdjustmentReason));
	const allowedAdjustmentTypes = $derived(getAllowedAdjustmentTypes(selectedReason));
	const adjustmentType = $derived(selectedAdjustmentType);
	const isOutflow = $derived(adjustmentType === InventoryMovementType.ADJUSTMENT_OUT);
	const detailsEnabled = $derived(selectedLot != null);
	const directionEnabled = $derived(detailsEnabled && selectedReason != null);
	const detailsComplete = $derived(
		selectedReason != null && adjustmentType != null && parsedQuantity > 0
	);
	const notesRemaining = $derived(getNotesRemaining(notes));
	const quantityError = $derived(
		getQuantityError(parsedQuantity, isOutflow, selectedLot?.quantityAvailable ?? null)
	);
	const projectedLotQuantity = $derived(
		selectedLot && adjustmentType != null
			? getProjectedLotQuantity(selectedLot.quantityAvailable, parsedQuantity, isOutflow)
			: null
	);
	const selectedReasonLabel = $derived(
		reason ? ADJUSTMENT_REASON_LABELS[reason as AdjustmentReason] : null
	);
	const reportCategory = $derived(
		reason ? ADJUSTMENT_REPORT_CATEGORIES[reason as AdjustmentReason] : null
	);
	const showsFinancialWarning = $derived(
		isOutflow && LOSS_REASONS.includes(reason as AdjustmentReason) && selectedLot != null
	);
	const estimatedLoss = $derived(
		showsFinancialWarning && selectedLot ? selectedLot.unitPurchasePrice * parsedQuantity : 0
	);
	const canSubmit = $derived(
		selectedLotId !== '' &&
			selectedReason != null &&
			adjustmentType != null &&
			parsedQuantity > 0 &&
			notesRemaining === 0 &&
			!quantityError &&
			!isSubmitting
	);
	const steps = $derived(
		buildAdjustmentSteps({
			hasLot: selectedLotId !== '',
			hasDetails: detailsComplete,
			isReady: canSubmit
		})
	);
	const currentMonth = formatDate(nowUTC(), { month: 'long', year: 'numeric' });
	const lastManualAdjustment = $derived(
		findLastManualAdjustment(productMovements, MovementReferenceType.MANUAL_ADJUSTMENT)
	);

	const reasonOptions = buildReasonOptions();
	const directionHint = $derived(
		getDirectionHint(detailsEnabled, selectedReason, allowedAdjustmentTypes.length, adjustmentType)
	);

	function handleReasonChange(nextReason: string) {
		reason = nextReason;
		selectedAdjustmentType = getDefaultAdjustmentType(
			nextReason === '' ? null : (nextReason as AdjustmentReason)
		);
	}

	function handleSubmit() {
		if (!canSubmit) return;

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
			if (adjustmentType == null || selectedReason == null) {
				toast.error('Completa motivo y direccion del ajuste');
				return;
			}

			const result = await createManualAdjustmentCmd({
				lotId: selectedLotId,
				adjustmentType,
				quantity: parsedQuantity,
				reason: selectedReason,
				notes
			});

			if (result.success) {
				const label = isOutflow ? 'Salida' : 'Entrada';
				toast.success(
					`${label} registrada: ${parsedQuantity} uds. Stock del lote: ${result.newQuantityAvailable}`
				);
				await goto(resolve(`/products/${product.id}`), { invalidateAll: true });
			} else {
				toast.error(result.error ?? 'Error al registrar ajuste');
			}
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error al registrar ajuste'));
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Ajuste de Inventario - {product.name} - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-surface px-6 py-8 xl:px-8">
	<div class="mx-auto max-w-7xl space-y-10">
		<AdjustHeader
			productId={product.id}
			productName={product.name}
			productSku={product.sku}
			{realStock}
			activeLotCount={activeLots.length}
		/>

		{#if activeLots.length === 0}
			<AdjustEmptyState productId={product.id} />
		{:else}
			<div class="grid grid-cols-1 gap-10 lg:grid-cols-12">
				<div class="lg:col-span-3">
					<AdjustmentStepRail {steps} />
				</div>

				<div class="space-y-8 lg:col-span-9">
					<AdjustmentLotSelectionCard {activeLots} bind:selectedLotId />

					<AdjustDetailsForm
						{detailsEnabled}
						{selectedReasonLabel}
						{showsFinancialWarning}
						{reason}
						{reasonOptions}
						onReasonChange={handleReasonChange}
						{directionEnabled}
						{allowedAdjustmentTypes}
						bind:adjustmentType={selectedAdjustmentType}
						{directionHint}
						bind:quantity
						{quantityError}
						{isOutflow}
						{selectedLot}
						bind:notes
						{notesRemaining}
					/>

					<AdjustmentImpactCard
						enabled={detailsComplete}
						showLoss={showsFinancialWarning && parsedQuantity > 0}
						{estimatedLoss}
						unitCost={selectedLot?.unitPurchasePrice ?? null}
						projectedQuantity={projectedLotQuantity}
						{currentMonth}
						{reportCategory}
					/>

					<AdjustSummaryCard
						productId={product.id}
						{selectedLot}
						{parsedQuantity}
						{adjustmentType}
						{isOutflow}
						{projectedLotQuantity}
						{canSubmit}
						{isSubmitting}
						onSubmit={handleSubmit}
					/>
				</div>
			</div>

			<AdjustInfoTrio {lastManualAdjustment} {fifoCost} />
		{/if}
	</div>
</div>

<ConfirmModal
	bind:open={showConfirmModal}
	title="Confirmar perdida operativa"
	message={`Esta accion registrara una perdida de ${formatPrice(estimatedLoss)} como "${reason ? ADJUSTMENT_REPORT_CATEGORIES[reason as AdjustmentReason] : ''}" en el reporte de ${currentMonth}.`}
	confirmLabel="Confirmar ajuste"
	confirmColor="red"
	loading={isSubmitting}
	onConfirm={executeAdjustment}
	onCancel={() => (showConfirmModal = false)}
/>
