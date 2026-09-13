<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ManualAdjustmentType } from '$lib/components/products/adjustments/helpers';
	import type { InventoryLot } from '$lib/server/db/schema';

	interface Props {
		productId: string;
		selectedLot: InventoryLot | null;
		parsedQuantity: number;
		adjustmentType: ManualAdjustmentType | null;
		isOutflow: boolean;
		projectedLotQuantity: number | null;
		canSubmit: boolean;
		isSubmitting: boolean;
		onSubmit: () => void;
	}

	let {
		productId,
		selectedLot,
		parsedQuantity,
		adjustmentType,
		isOutflow,
		projectedLotQuantity,
		canSubmit,
		isSubmitting,
		onSubmit
	}: Props = $props();
</script>

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

			{#if selectedLot && parsedQuantity > 0 && adjustmentType != null}
				<div class="rounded-xl bg-surface-container-low px-5 py-4">
					<p class="text-sm text-on-surface-variant">
						{#if isOutflow}
							Salida de <span class="font-mono font-semibold text-brand-navy">{parsedQuantity}</span
							>
							uds del lote
							<span class="font-mono font-semibold text-brand-navy"
								>LOT-{String(selectedLot.lotNumber).padStart(4, '0')}</span
							>.
						{:else}
							Entrada de <span class="font-mono font-semibold text-brand-navy"
								>{parsedQuantity}</span
							>
							uds al lote
							<span class="font-mono font-semibold text-brand-navy"
								>LOT-{String(selectedLot.lotNumber).padStart(4, '0')}</span
							>.
						{/if}
					</p>
					<p class="mt-2 text-sm text-on-surface-variant">
						Stock del lote:
						<span class="font-mono font-semibold text-brand-navy"
							>{selectedLot.quantityAvailable}</span
						>
						→
						<span class="font-mono font-semibold text-brand-navy">{projectedLotQuantity}</span>
					</p>
				</div>
			{:else}
				<p class="text-sm text-on-surface-variant">
					Completa la seleccion del lote, el motivo y la cantidad para revisar el resultado antes de
					confirmar.
				</p>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<a
				href={resolve(`/products/${productId}`)}
				class="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-5 py-3 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container"
			>
				Cancelar ajuste
			</a>
			<button
				type="button"
				onclick={onSubmit}
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
</section>
