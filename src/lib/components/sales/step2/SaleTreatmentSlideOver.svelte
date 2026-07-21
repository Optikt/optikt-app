<script lang="ts">
	import { X, Check } from '@lucide/svelte';
	import { SlideOver } from '$lib/components/ui';
	import { formatPrice } from '$lib/utils';
	import { getTreatmentCategoryLabel } from '$lib/shared/enums/lensTypes';
	import { TreatmentCategory } from '$lib/shared/enums';
	import type { SupplierTreatment } from '$lib/server/db/schema';

	interface Props {
		open: boolean;
		onclose?: () => void;
		availableTreatments: SupplierTreatment[];
		currentTreatmentId: string | null;
		onselect: (treatment: SupplierTreatment | null) => void;
	}

	let { open, onclose, availableTreatments, currentTreatmentId, onselect }: Props = $props();

	let selectedId = $state<string | null>(null);

	$effect(() => {
		if (open) {
			selectedId = currentTreatmentId;
		}
	});

	function handleApply() {
		const treatment = selectedId
			? availableTreatments.find((t) => t.id === selectedId) ?? null
			: null;
		onselect(treatment);
		onclose?.();
	}

	function handleCancel() {
		onclose?.();
	}
</script>

<SlideOver {open} {onclose} size="md">
	{#snippet header({ onclose })}
		<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
			<p class="text-sm font-semibold text-brand-navy">Seleccionar filtro</p>
			<button
				type="button"
				onclick={onclose}
				class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-container-high hover:text-slate-600"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	{/snippet}

	<div class="space-y-2">
		{#if availableTreatments.length === 0}
			<p class="py-4 text-center text-sm text-on-surface-variant">
				No hay filtros disponibles para este proveedor
			</p>
		{:else}
			{#each availableTreatments as treatment (treatment.id)}
				<label
					class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors {selectedId ===
					treatment.id
						? 'border-brand-blue bg-brand-blue/5'
						: 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}"
				>
					<input
						type="radio"
						name="treatment-select"
						value={treatment.id}
						checked={selectedId === treatment.id}
						onchange={() => (selectedId = treatment.id)}
						class="h-4 w-4 border-slate-300 text-brand-blue focus:ring-brand-blue"
					/>
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center gap-2">
							<span class="text-sm font-medium text-brand-navy">{treatment.name}</span>
							<span
								class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase {treatment.category ===
								TreatmentCategory.AR
									? 'bg-brand-blue/10 text-brand-blue'
									: 'bg-surface-container-high text-on-surface-variant'}"
							>
								{getTreatmentCategoryLabel(treatment.category)}
							</span>
						</div>
						<p class="mt-0.5 font-mono text-xs text-on-surface-variant">
							{formatPrice(treatment.salePrice ?? treatment.price)}
						</p>
					</div>
				</label>
			{/each}
		{/if}
	</div>

	{#snippet footer()}
		<div class="border-t border-slate-200 px-6 py-3">
			<div class="flex items-center justify-end gap-2">
				<button
					type="button"
					onclick={handleCancel}
					class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
				>
					Cancelar
				</button>
				<button
					type="button"
					onclick={handleApply}
					class="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-navy/90"
				>
					<Check class="h-3.5 w-3.5" />
					Aceptar
				</button>
			</div>
		</div>
	{/snippet}
</SlideOver>
