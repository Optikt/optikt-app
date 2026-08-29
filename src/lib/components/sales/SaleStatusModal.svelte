<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { AppBadge, ConfirmModal } from '$lib/components/ui';
	import { setSaleStatus } from '$lib/remote/sales.remote';
	import { SaleStatus, getSaleStatusBadgeColor, getSaleStatusLabel } from '$lib/shared/enums';
	import { getErrorMessage } from '$lib/utils';

	interface Props {
		open: boolean;
		saleId: string;
		currentStatus: SaleStatus;
		isAdmin: boolean;
		/** Optional: only these targets are offered (e.g. right after full payment). */
		presetTargets?: SaleStatus[];
		onSuccess?: () => void;
	}

	let {
		open = $bindable(),
		saleId,
		currentStatus,
		isAdmin,
		presetTargets,
		onSuccess
	}: Props = $props();

	const STATUS_FLOW: SaleStatus[] = [
		SaleStatus.PENDING,
		SaleStatus.IN_PROGRESS,
		SaleStatus.READY,
		SaleStatus.COMPLETED
	];

	const STATUS_DESCRIPTIONS: Partial<Record<SaleStatus, string>> = {
		[SaleStatus.PENDING]: 'Venta registrada, pendiente de procesar',
		[SaleStatus.IN_PROGRESS]: 'La venta está siendo atendida',
		[SaleStatus.READY]: 'Productos listos, esperando al cliente',
		[SaleStatus.COMPLETED]: 'Venta finalizada y entregada'
	};

	const targetOptions = $derived.by(() => {
		const available = presetTargets ?? STATUS_FLOW.filter((s) => s !== currentStatus);
		return available.map((status) => {
			const currentIndex = STATUS_FLOW.indexOf(currentStatus);
			const targetIndex = STATUS_FLOW.indexOf(status);
			const backward = targetIndex < currentIndex;
			return {
				status,
				label: getSaleStatusLabel(status),
				description: STATUS_DESCRIPTIONS[status] ?? '',
				backward,
				allowed: !backward || isAdmin
			};
		});
	});

	let targetStatus = $state<SaleStatus | null>(null);
	let reason = $state('');
	let loading = $state(false);
	let error = $state('');

	const currentStatusLabel = $derived(getSaleStatusLabel(currentStatus));
	const selectedTargetLabel = $derived(targetStatus ? getSaleStatusLabel(targetStatus) : '');
	const canSubmit = $derived(!!targetStatus);
	const selectedIsBackward = $derived(
		targetOptions.find((o) => o.status === targetStatus)?.backward ?? false
	);

	// Reset whenever the dialog closes (X button, Escape, overlay click).
	$effect(() => {
		if (!open) {
			targetStatus = null;
			reason = '';
			loading = false;
			error = '';
		}
	});

	function handleClose() {
		open = false;
	}

	async function submitTransition() {
		if (!targetStatus) return;
		const trimmedReason = reason.trim();

		// Backward transitions (reverts) always require a justification.
		if (selectedIsBackward && !trimmedReason) {
			error = 'El motivo es obligatorio para revertir el estado';
			return;
		}

		loading = true;
		try {
			const result = await setSaleStatus({
				id: saleId,
				status: targetStatus,
				reason: trimmedReason || undefined
			});
			if (result.success) {
				toast.success(`Venta marcada como ${getSaleStatusLabel(targetStatus)}`);
				open = false;
				onSuccess?.();
			} else {
				error = result.error ?? 'Error al actualizar el estado';
			}
		} catch (e) {
			error = getErrorMessage(e, 'Error al actualizar el estado');
		} finally {
			loading = false;
		}
	}
</script>

<ConfirmModal
	bind:open
	title="Cambiar estado"
	message={selectedTargetLabel
		? `La venta quedará marcada como "${selectedTargetLabel}".`
		: undefined}
	confirmLabel="Guardar cambio"
	cancelLabel="Cancelar"
	confirmDisabled={!canSubmit}
	{loading}
	permanent={loading}
	onConfirm={submitTransition}
	onCancel={handleClose}
>
	{#snippet body()}
		<div class="mb-4 flex items-center gap-2">
			<span class="text-xs font-medium text-on-surface-variant">Estado actual:</span>
			<AppBadge variant={getSaleStatusBadgeColor(currentStatus)}>
				{currentStatusLabel}
			</AppBadge>
		</div>

		<div class="mb-4 space-y-3" role="radiogroup" aria-label="Seleccionar nuevo estado">
			{#each targetOptions as option (option.status)}
				{@const isSelected = targetStatus === option.status}
				<button
					type="button"
					role="radio"
					aria-checked={isSelected}
					disabled={!option.allowed}
					title={option.allowed ? undefined : 'Solo administradores pueden revertir el estado'}
					class="flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 {isSelected
						? 'border-brand-blue/40 bg-surface-container-high ring-1 ring-brand-blue/20'
						: 'border-outline-variant/20 hover:border-outline-variant/40 hover:bg-surface-container'}"
					onclick={() => (targetStatus = option.status)}
				>
					<span
						class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 {isSelected
							? 'border-brand-blue'
							: 'border-outline-variant'}"
					>
						{#if isSelected}
							<span class="h-2.5 w-2.5 rounded-full bg-brand-blue"></span>
						{/if}
					</span>
					<span class="min-w-0 flex-1">
						<span class="flex flex-wrap items-center gap-2">
							<span class="text-sm font-medium text-on-surface">{option.label}</span>
							{#if option.backward}
								<span
									class="rounded-full bg-warning-container px-1.5 py-0.5 text-[10px] font-semibold text-on-warning-container uppercase"
									>Revertir</span
								>
							{/if}
						</span>
						{#if option.description}
							<span class="mt-0.5 block text-xs leading-relaxed text-on-surface-variant">
								{option.description}
							</span>
						{/if}
					</span>
				</button>
			{/each}
		</div>

		<div class="space-y-3">
			<label
				for="sale-status-reason"
				class="block text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
			>
				Motivo del cambio a <span class="text-brand-blue">{selectedTargetLabel || '...'}</span>
				{#if selectedIsBackward}
					<span class="text-error">*</span>
				{:else}
					<span class="ml-1 font-normal text-on-surface-variant/70 normal-case"> (opcional) </span>
				{/if}
			</label>
			<textarea
				id="sale-status-reason"
				class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-sm transition-colors focus:border-brand-blue focus:ring-2 focus:ring-brand-blue focus:outline-none"
				rows="3"
				placeholder={selectedIsBackward
					? 'Requerido al revertir — explica por qué se corrige el estado'
					: 'Ej: El lente quedó listo, el cliente pagó por adelantado...'}
				bind:value={reason}></textarea>
			{#if error}
				<p class="text-sm text-error">{error}</p>
			{/if}
		</div>
	{/snippet}
</ConfirmModal>
