<script lang="ts">
	import { FlaskConical } from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import { formatPrice } from '$lib/utils';
	import { TreatmentCategory } from '$lib/shared/enums';
	import { getTreatmentCategoryLabel } from '$lib/shared/enums/lensTypes';
	import type { SelectedTreatment } from '../newSaleTypes';
	import type { SupplierTreatment } from '$lib/server/db/schema';

	interface Props {
		treatments: SelectedTreatment[];
		availableTreatments: SupplierTreatment[];
		eyeCount: number;
		treatmentTotal: number;
		ontoggle: (treatment: SupplierTreatment) => void;
	}

	let {
		treatments = $bindable(),
		availableTreatments,
		eyeCount,
		treatmentTotal,
		ontoggle
	}: Props = $props();

	function isSelected(treatmentId: string): boolean {
		return treatments.some((t) => t.supplierTreatmentId === treatmentId);
	}

	function findSelected(treatmentId: string) {
		return treatments.find((t) => t.supplierTreatmentId === treatmentId);
	}
</script>

{#if availableTreatments.length > 0}
	<div class="mb-2 flex items-center justify-between gap-2" use:autoAnimate>
		<div class="flex items-center gap-1.5">
			<FlaskConical class="h-3.5 w-3.5 text-brand-blue" />
			<p class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase">Tratamientos</p>
		</div>
		{#if treatmentTotal > 0}
			<span class="font-mono text-xs font-semibold text-brand-navy"
				>{formatPrice(treatmentTotal)}</span
			>
		{/if}
	</div>
	<div class="space-y-1.5" use:autoAnimate>
		{#each availableTreatments as treatment (treatment.id)}
			{@const selected = isSelected(treatment.id)}
			{@const selectedTreatment = findSelected(treatment.id)}
			<div
				class="rounded-lg px-2.5 py-1.5 transition-colors {selected
					? 'bg-surface-container-low'
					: 'bg-surface hover:bg-surface-container-low'}"
				use:autoAnimate
			>
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						checked={selected}
						onchange={() => ontoggle(treatment)}
						class="h-3.5 w-3.5 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
					/>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="text-xs font-medium text-brand-navy">{treatment.name}</span>
							<span
								class="rounded-full px-1 py-0.5 text-[9px] font-semibold tracking-[0.12em] uppercase {treatment.category ===
								TreatmentCategory.AR
									? 'bg-brand-blue/10 text-brand-blue'
									: 'bg-surface-container-high text-on-surface-variant'}"
								>{getTreatmentCategoryLabel(treatment.category)}</span
							>
						</div>
					</div>
					<span class="font-mono text-xs font-semibold text-brand-navy"
						>{formatPrice(selectedTreatment?.price ?? treatment.salePrice ?? treatment.price)}</span
					>
				</label>
				{#if selected && selectedTreatment}
					<div
						class="mt-1.5 ml-5.5 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant"
					>
						<label class="inline-flex items-center gap-1.5">
							<span class="text-[11px]">Precio:</span>
							<input
								type="number"
								bind:value={selectedTreatment.price}
								step="0.01"
								min="0"
								class="w-20 rounded-lg border border-outline-variant/40 bg-surface px-2 py-1 text-right font-mono text-xs text-brand-navy focus:border-brand-blue focus:outline-none"
							/>
						</label>
						<span class="font-mono text-[11px]"
							>× {eyeCount} = {formatPrice(selectedTreatment.price * eyeCount)}</span
						>
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
