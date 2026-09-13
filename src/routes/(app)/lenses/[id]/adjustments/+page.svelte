<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import AdjustmentImpactCard from '$lib/components/products/adjustments/AdjustmentImpactCard.svelte';
	import AdjustmentStepRail from '$lib/components/products/adjustments/AdjustmentStepRail.svelte';
	import {
		buildAdjustmentSteps,
		getAllowedAdjustmentTypes,
		getNotesRemaining,
		getProjectedLotQuantity,
		type ManualAdjustmentType
	} from '$lib/components/products/adjustments/helpers';
	import { ConfirmModal } from '$lib/components/ui';
	import { nowUTC } from '$lib/dates';
	import { adjustLensStock } from '$lib/remote/lenses.remote';
	import {
		AdjustmentReason,
		ADJUSTMENT_REASON_LABELS,
		ADJUSTMENT_REPORT_CATEGORIES,
		ALL_ADJUSTMENT_REASONS,
		InventoryMovementType,
		LOSS_REASONS,
		MovementReferenceType
	} from '$lib/shared/enums';
	import type { InventoryLot } from '$lib/server/db/schema';
	import { formatDate, formatPrice, getErrorMessage } from '$lib/utils';
	import LensAdjustDetails from '$lib/components/lenses/adjust/LensAdjustDetails.svelte';
	import LensAdjustFootnotes from '$lib/components/lenses/adjust/LensAdjustFootnotes.svelte';
	import LensAdjustHeader from '$lib/components/lenses/adjust/LensAdjustHeader.svelte';
	import LensAdjustSummary from '$lib/components/lenses/adjust/LensAdjustSummary.svelte';
	import LensLotContext from '$lib/components/lenses/adjust/LensLotContext.svelte';

	let { data } = $props();
	const item = untrack(() => data.item);
	const activeLots = untrack(() => data.activeLots) as InventoryLot[];
	const fifoCost = untrack(() => data.fifoCost) as number | null;
	const lensMovements = untrack(() => data.lensMovements);

	let selectedAdjustmentType = $state<ManualAdjustmentType | null>(null);
	let quantity = $state('');
	let reason = $state('');
	let notes = $state('');
	let isSubmitting = $state(false);
	let showConfirmModal = $state(false);

	const activeLot = $derived(activeLots[0] ?? null);
	const realStock = $derived(item.stock ?? 0);
	const parsedQuantity = $derived(parseInt(quantity, 10) || 0);
	const selectedReason = $derived(reason === '' ? null : (reason as AdjustmentReason));
	const baseAllowedAdjustmentTypes = $derived(getAllowedAdjustmentTypes(selectedReason));
	const allowedAdjustmentTypes = $derived(
		activeLot
			? baseAllowedAdjustmentTypes
			: baseAllowedAdjustmentTypes.filter((type) => type === InventoryMovementType.ADJUSTMENT_IN)
	);
	const adjustmentType = $derived(selectedAdjustmentType);
	const isOutflow = $derived(adjustmentType === InventoryMovementType.ADJUSTMENT_OUT);
	const detailsComplete = $derived(
		selectedReason != null && adjustmentType != null && parsedQuantity > 0
	);
	const notesRemaining = $derived(getNotesRemaining(notes));
	const quantityError = $derived.by(() => {
		if (parsedQuantity <= 0) return null;
		if (isOutflow) {
			if (!activeLot) {
				return 'No hay lote activo para registrar una reducción';
			}

			if (parsedQuantity > activeLot.quantityAvailable) {
				return `Maximo disponible: ${activeLot.quantityAvailable}`;
			}
		}

		return null;
	});
	const projectedLotQuantity = $derived(
		adjustmentType == null || parsedQuantity <= 0
			? null
			: activeLot
				? getProjectedLotQuantity(activeLot.quantityAvailable, parsedQuantity, isOutflow)
				: adjustmentType === InventoryMovementType.ADJUSTMENT_IN
					? parsedQuantity
					: null
	);
	const selectedReasonLabel = $derived(
		reason ? ADJUSTMENT_REASON_LABELS[reason as AdjustmentReason] : null
	);
	const reportCategory = $derived(
		reason ? ADJUSTMENT_REPORT_CATEGORIES[reason as AdjustmentReason] : null
	);
	const showsFinancialWarning = $derived(
		isOutflow && LOSS_REASONS.includes(reason as AdjustmentReason) && activeLot != null
	);
	const estimatedLoss = $derived(
		showsFinancialWarning && activeLot ? activeLot.unitPurchasePrice * parsedQuantity : 0
	);
	const canSubmit = $derived(
		selectedReason != null &&
			adjustmentType != null &&
			parsedQuantity > 0 &&
			notesRemaining === 0 &&
			!quantityError &&
			!isSubmitting
	);
	const steps = $derived(
		buildAdjustmentSteps({
			hasLot: true,
			hasDetails: detailsComplete,
			isReady: canSubmit
		})
	);
	const currentMonth = formatDate(nowUTC(), { month: 'long', year: 'numeric' });
	const lastManualAdjustment = $derived(
		lensMovements.find(
			(movement) => movement.referenceType === MovementReferenceType.MANUAL_ADJUSTMENT
		) ?? null
	);
	const lensDescriptor = $derived(
		[item.type, item.material?.name, item.supplier?.name].filter(Boolean).join(' · ')
	);

	const reasonOptions = ALL_ADJUSTMENT_REASONS.map((value) => ({
		value,
		label: ADJUSTMENT_REASON_LABELS[value]
	}));
	const directionHint = $derived.by(() => {
		if (selectedReason == null) {
			return 'Selecciona un motivo para habilitar direcciones validas.';
		}

		if (allowedAdjustmentTypes.length === 0) {
			return 'Sin lote activo solo se permiten entradas para crear trazabilidad.';
		}

		if (allowedAdjustmentTypes.length === 1) {
			return adjustmentType === InventoryMovementType.ADJUSTMENT_IN
				? 'Este contexto solo admite incremento.'
				: 'Este contexto solo admite reduccion.';
		}

		return 'Selecciona la direccion del ajuste segun el caso.';
	});

	function getDefaultLensAdjustmentType(nextReason: AdjustmentReason | null) {
		if (!nextReason) {
			return null;
		}

		const nextAllowedTypes = getAllowedAdjustmentTypes(nextReason).filter(
			(type) => activeLot != null || type === InventoryMovementType.ADJUSTMENT_IN
		);

		return nextAllowedTypes.length === 1 ? nextAllowedTypes[0] : null;
	}

	function handleReasonChange(nextReason: string) {
		reason = nextReason;
		selectedAdjustmentType = getDefaultLensAdjustmentType(
			nextReason === '' ? null : (nextReason as AdjustmentReason)
		);
	}

	function handleSubmit() {
		if (!canSubmit) return;

		if (showsFinancialWarning) {
			showConfirmModal = true;
			return;
		}

		void executeAdjustment();
	}

	async function executeAdjustment() {
		showConfirmModal = false;
		isSubmitting = true;

		try {
			if (adjustmentType == null || selectedReason == null) {
				toast.error('Completa motivo y direccion del ajuste');
				return;
			}

			const result = await adjustLensStock({
				lensCatalogItemId: item.id,
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
				await goto(resolve(`/lenses/${item.id}`), { invalidateAll: true });
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
	<title>Ajuste de Inventario - {item.name} - Optikt</title>
</svelte:head>

<div class="min-h-screen bg-surface px-6 py-8 xl:px-8">
	<div class="mx-auto max-w-7xl space-y-10">
		<LensAdjustHeader
			itemId={item.id}
			itemName={item.name}
			{lensDescriptor}
			{realStock}
			{activeLot}
		/>

		<div class="grid grid-cols-1 gap-10 lg:grid-cols-12">
			<div class="lg:col-span-3">
				<AdjustmentStepRail {steps} />
			</div>

			<div class="space-y-8 lg:col-span-9">
				<LensLotContext {activeLot} {realStock} supplierName={item.supplier?.name} />

				<LensAdjustDetails
					{reasonOptions}
					{reason}
					{selectedReasonLabel}
					{showsFinancialWarning}
					{allowedAdjustmentTypes}
					bind:adjustmentType={selectedAdjustmentType}
					{directionHint}
					bind:quantity
					{quantityError}
					{isOutflow}
					{activeLot}
					bind:notes
					{notesRemaining}
					onReasonChange={handleReasonChange}
				/>

				<AdjustmentImpactCard
					enabled={detailsComplete}
					showLoss={showsFinancialWarning && parsedQuantity > 0}
					{estimatedLoss}
					unitCost={activeLot?.unitPurchasePrice ?? null}
					projectedQuantity={projectedLotQuantity}
					{currentMonth}
					{reportCategory}
				/>

				<LensAdjustSummary
					{adjustmentType}
					{parsedQuantity}
					{activeLot}
					{isOutflow}
					{projectedLotQuantity}
					{canSubmit}
					{isSubmitting}
					itemId={item.id}
					onSubmit={handleSubmit}
				/>
			</div>
		</div>

		<LensAdjustFootnotes {lastManualAdjustment} {fifoCost} />
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
