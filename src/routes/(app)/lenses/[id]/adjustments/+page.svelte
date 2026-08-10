<script lang="ts">
	import { ArrowLeft, Boxes, Coins, History, Minus, Plus, ShieldCheck } from '@lucide/svelte';
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
	import { AppBadge, ConfirmModal, FormInput } from '$lib/components/ui';
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
		<section class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<div class="space-y-3">
				<a
					href={resolve(`/lenses/${item.id}`)}
					class="inline-flex items-center gap-2 text-[0.72rem] font-bold tracking-[0.18em] text-brand-blue uppercase transition-colors hover:text-brand-navy"
				>
					<ArrowLeft class="h-4 w-4" />
					Detalle lente
				</a>

				<div class="space-y-2">
					<h1 class="font-heading text-4xl font-extrabold tracking-[-0.04em] text-brand-navy">
						Ajuste de Inventario
					</h1>
					<p class="max-w-2xl text-sm leading-7 text-on-surface-variant">
						Registra entradas o salidas con trazabilidad completa para lentes STOCK. Cada movimiento
						conserva motivo, lote y contexto operativo.
					</p>
				</div>
			</div>

			<div class="glass-card bg-surface-container-lowest px-5 py-4 lg:min-w-[24rem]">
				<div class="flex items-center gap-4">
					<div
						class="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container text-brand-navy"
					>
						<Boxes class="h-5 w-5" />
					</div>
					<div class="min-w-0">
						<p class="text-[0.65rem] font-bold tracking-[0.16em] text-outline uppercase">
							Lente STOCK
						</p>
						<p class="truncate text-lg font-semibold text-brand-navy">{item.name}</p>
						<p class="mt-1 text-sm text-on-surface-variant">{lensDescriptor}</p>
						<p class="mt-1 text-sm text-on-surface-variant">
							{realStock} uds en stock cacheado
							{#if activeLot}
								· lote activo LOT-{String(activeLot.lotNumber).padStart(4, '0')}
							{/if}
						</p>
					</div>
				</div>
			</div>
		</section>

		<div class="grid grid-cols-1 gap-10 lg:grid-cols-12">
			<div class="lg:col-span-3">
				<AdjustmentStepRail {steps} />
			</div>

			<div class="space-y-8 lg:col-span-9">
				<section class="glass-card bg-surface-container-lowest p-8">
					<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h2 class="font-heading text-2xl font-bold tracking-[-0.02em] text-brand-navy">
								1. Contexto de Lote
							</h2>
							<p class="mt-1 max-w-2xl text-sm text-on-surface-variant">
								El ajuste se aplica sobre el lote activo del lente. Si no existe uno y registras una
								entrada, se creará un lote técnico nuevo con costo 0 para retomar la trazabilidad.
							</p>
						</div>

						<AppBadge variant={activeLot ? 'info' : 'warning'}>
							{activeLot ? 'Lote activo detectado' : 'Entrada crea lote nuevo'}
						</AppBadge>
					</div>

					<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
						<div class="rounded-xl bg-surface-container-low px-4 py-4">
							<p class="text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase">Lote</p>
							<p class="mt-2 font-mono text-sm font-semibold text-brand-navy">
								{activeLot
									? `LOT-${String(activeLot.lotNumber).padStart(4, '0')}`
									: 'Sin lote activo'}
							</p>
						</div>
						<div class="rounded-xl bg-surface-container-low px-4 py-4">
							<p class="text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase">
								Existencia lote
							</p>
							<p class="mt-2 font-mono text-sm font-semibold text-brand-navy">
								{activeLot?.quantityAvailable ?? 0}
							</p>
						</div>
						<div class="rounded-xl bg-surface-container-low px-4 py-4">
							<p class="text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase">
								Costo u.
							</p>
							<p class="mt-2 font-mono text-sm font-semibold text-brand-navy">
								{activeLot ? formatPrice(activeLot.unitPurchasePrice) : formatPrice(0)}
							</p>
						</div>
						<div class="rounded-xl bg-surface-container-low px-4 py-4">
							<p class="text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase">
								Proveedor
							</p>
							<p class="mt-2 text-sm font-semibold text-brand-navy">{item.supplier?.name ?? '—'}</p>
						</div>
					</div>

					{#if !activeLot}
						<div
							class="mt-5 rounded-xl bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant"
						>
							{#if realStock > 0}
								El lente tiene <span class="font-mono font-semibold text-brand-navy"
									>{realStock}</span
								>
								uds en stock cacheado pero no existe un lote activo asociado. La próxima entrada manual
								creará un lote técnico con costo 0 para recuperar trazabilidad.
							{:else}
								No hay stock activo. Una entrada manual creará el primer lote técnico para este
								lente.
							{/if}
						</div>
					{/if}
				</section>

				<section class="glass-card bg-surface-container-lowest p-8">
					<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h2 class="font-heading text-2xl font-bold tracking-[-0.02em] text-brand-navy">
								2. Detalles del Ajuste
							</h2>
							<p class="mt-1 text-sm text-on-surface-variant">
								Define direccion, motivo y contexto del movimiento antes de registrarlo.
							</p>
						</div>

						{#if selectedReasonLabel}
							<AppBadge variant={showsFinancialWarning ? 'error' : 'info'}>
								{selectedReasonLabel}
							</AppBadge>
						{/if}
					</div>

					<div class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
						<div class="space-y-2">
							<label
								for="reason"
								class="block text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase"
							>
								Motivo
							</label>
							<select
								id="reason"
								value={reason}
								onchange={(event) =>
									handleReasonChange((event.currentTarget as HTMLSelectElement).value)}
								class="w-full rounded-xl border-0 bg-surface-container-low px-4 py-3 text-sm text-brand-navy focus:ring-2 focus:ring-brand-blue"
							>
								<option value="">Selecciona motivo...</option>
								{#each reasonOptions as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>

						<fieldset class="space-y-2">
							<legend
								class="block text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase"
							>
								Direccion del ajuste
							</legend>
							<div class="grid grid-cols-2 gap-2">
								<button
									type="button"
									disabled={!allowedAdjustmentTypes.includes(InventoryMovementType.ADJUSTMENT_IN)}
									onclick={() => (selectedAdjustmentType = InventoryMovementType.ADJUSTMENT_IN)}
									class={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${adjustmentType === InventoryMovementType.ADJUSTMENT_IN ? 'bg-brand-navy text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'} disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-outline disabled:hover:bg-surface-container-low`}
								>
									<Plus class="h-4 w-4" />
									Incremento
								</button>
								<button
									type="button"
									disabled={!allowedAdjustmentTypes.includes(InventoryMovementType.ADJUSTMENT_OUT)}
									onclick={() => (selectedAdjustmentType = InventoryMovementType.ADJUSTMENT_OUT)}
									class={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${adjustmentType === InventoryMovementType.ADJUSTMENT_OUT ? 'bg-brand-navy text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'} disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-outline disabled:hover:bg-surface-container-low`}
								>
									<Minus class="h-4 w-4" />
									Reduccion
								</button>
							</div>
							<p class="text-xs text-on-surface-variant">{directionHint}</p>
						</fieldset>

						<div class="space-y-2">
							<label
								for="adjustment-quantity"
								class="block text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase"
							>
								Cantidad a ajustar
							</label>
							<FormInput
								id="adjustment-quantity"
								bind:value={quantity}
								type="number"
								min="1"
								max={isOutflow && activeLot ? String(activeLot.quantityAvailable) : undefined}
								placeholder="0"
								error={quantityError}
								class="!rounded-xl !border-0 !bg-surface-container-low !px-4 !py-3 !text-sm !text-brand-navy !shadow-none"
							/>
						</div>

						<div class="space-y-2">
							<label
								for="adjustment-notes"
								class="block text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase"
							>
								Notas internas
							</label>
							<textarea
								id="adjustment-notes"
								bind:value={notes}
								rows="3"
								placeholder="Escribe el contexto del ajuste con detalle..."
								class="w-full rounded-xl border-0 bg-surface-container-low px-4 py-3 text-sm text-brand-navy placeholder:text-slate-400 focus:ring-2 focus:ring-brand-blue"
							></textarea>
							{#if notes.length > 0 && notesRemaining > 0}
								<p class="text-sm text-error">{notesRemaining} caracteres mas requeridos</p>
							{/if}
						</div>
					</div>
				</section>

				<AdjustmentImpactCard
					enabled={detailsComplete}
					showLoss={showsFinancialWarning && parsedQuantity > 0}
					{estimatedLoss}
					unitCost={activeLot?.unitPurchasePrice ?? null}
					projectedQuantity={projectedLotQuantity}
					{currentMonth}
					{reportCategory}
				/>

				<section class="glass-card bg-surface-container-lowest p-8">
					<div class="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
						<div class="space-y-4">
							<div>
								<p class="text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase">
									Resumen final
								</p>
								<h2 class="font-heading mt-2 text-2xl font-bold tracking-[-0.02em] text-brand-navy">
									Listo para registrar
								</h2>
							</div>

							<div class="space-y-3">
								{#if adjustmentType != null && parsedQuantity > 0}
									<div class="rounded-xl bg-surface-container-low px-5 py-4">
										{#if activeLot}
											<p class="text-sm text-on-surface-variant">
												{#if isOutflow}
													Salida de <span class="font-mono font-semibold text-brand-navy"
														>{parsedQuantity}</span
													>
													uds del lote
													<span class="font-mono font-semibold text-brand-navy"
														>LOT-{String(activeLot.lotNumber).padStart(4, '0')}</span
													>.
												{:else}
													Entrada de <span class="font-mono font-semibold text-brand-navy"
														>{parsedQuantity}</span
													>
													uds al lote
													<span class="font-mono font-semibold text-brand-navy"
														>LOT-{String(activeLot.lotNumber).padStart(4, '0')}</span
													>.
												{/if}
											</p>
											<p class="mt-2 text-sm text-on-surface-variant">
												Stock del lote:
												<span class="font-mono font-semibold text-brand-navy"
													>{activeLot.quantityAvailable}</span
												>
												→
												<span class="font-mono font-semibold text-brand-navy"
													>{projectedLotQuantity}</span
												>
											</p>
										{:else if adjustmentType === InventoryMovementType.ADJUSTMENT_IN}
											<p class="text-sm text-on-surface-variant">
												Se creará un lote técnico nuevo con <span
													class="font-mono font-semibold text-brand-navy">{parsedQuantity}</span
												>
												uds para dejar trazabilidad desde este ajuste.
											</p>
											<p class="mt-2 text-sm text-on-surface-variant">
												Stock del lote nuevo:
												<span class="font-mono font-semibold text-brand-navy">0</span>
												→
												<span class="font-mono font-semibold text-brand-navy"
													>{projectedLotQuantity}</span
												>
											</p>
										{:else}
											<p class="text-sm text-on-surface-variant">
												No hay lote activo disponible para registrar esta salida.
											</p>
										{/if}
									</div>
								{:else}
									<p class="text-sm text-on-surface-variant">
										Completa el motivo, la direccion y la cantidad para revisar el resultado antes
										de confirmar.
									</p>
								{/if}
							</div>

							<div class="flex flex-wrap items-center gap-3">
								<a
									href={resolve(`/lenses/${item.id}`)}
									class="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-5 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
								>
									Cancelar ajuste
								</a>
								<button
									type="button"
									onclick={handleSubmit}
									disabled={!canSubmit}
									class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-5 py-3 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md disabled:cursor-not-allowed disabled:bg-surface-container-highest disabled:text-outline disabled:hover:bg-surface-container-highest"
								>
									{#if isSubmitting}
										<span
											class="h-4 w-4 animate-spin rounded-full border-2 border-brand-navy/25 border-t-brand-navy"
										></span>
									{/if}
									Registrar ajuste
								</button>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<div class="rounded-xl bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
				<div class="flex items-center gap-3 text-brand-navy">
					<ShieldCheck class="h-4 w-4" />
					<p class="text-[0.68rem] font-bold tracking-[0.16em] uppercase">Audit log activo</p>
				</div>
				<p class="mt-2">
					Cada ajuste crea un movimiento inmutable sobre el lote activo o el lote técnico nuevo.
				</p>
			</div>

			<div class="rounded-xl bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
				<div class="flex items-center gap-3 text-brand-navy">
					<History class="h-4 w-4" />
					<p class="text-[0.68rem] font-bold tracking-[0.16em] uppercase">Ultimo ajuste manual</p>
				</div>
				<p class="mt-2">
					{lastManualAdjustment
						? formatDate(lastManualAdjustment.createdAt, {
								day: '2-digit',
								month: 'short',
								year: 'numeric'
							})
						: 'Sin ajustes manuales registrados'}
				</p>
			</div>

			<div class="rounded-xl bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
				<div class="flex items-center gap-3 text-brand-navy">
					<Coins class="h-4 w-4" />
					<p class="text-[0.68rem] font-bold tracking-[0.16em] uppercase">Costo FIFO actual</p>
				</div>
				<p class="mt-2 font-mono text-brand-navy">
					{fifoCost != null ? formatPrice(fifoCost) : 'Sin lote activo'}
				</p>
			</div>
		</div>
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
