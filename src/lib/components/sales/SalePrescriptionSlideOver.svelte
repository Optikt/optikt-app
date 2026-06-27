<script lang="ts">
	import { Eye, FlaskConical } from '@lucide/svelte';
	import SlideOver from '$lib/components/ui/SlideOver.svelte';
	import PrescriptionInput from './PrescriptionInput.svelte';
	import type { PrescriptionValues } from './PrescriptionInput.svelte';
	import { getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import type { LensTypeSuggestionState, PrescriptionFieldErrors } from './saleItemHelpers';
	import type { Prescription } from '$lib/server/db/schema';

	interface LensTypeDecisionContext {
		catalogLensType: string;
		prescriptionLensType: string;
	}

	interface Props {
		open: boolean;
		prescriptionValues: PrescriptionValues;
		customerPrescription: Prescription | null;
		lensTypeSuggestion: LensTypeSuggestionState;
		lensTypeDecisionContext: LensTypeDecisionContext | null;
		visibleRxErrors: PrescriptionFieldErrors;
		hasLensItem: boolean;
		onclose: () => void;
		onKeepCatalogLensType: () => void;
		onUseExistingPrescriptionLensType: () => void;
	}

	let {
		open = $bindable(false),
		prescriptionValues,
		customerPrescription,
		lensTypeSuggestion,
		lensTypeDecisionContext,
		visibleRxErrors,
		hasLensItem,
		onclose,
		onKeepCatalogLensType,
		onUseExistingPrescriptionLensType
	}: Props = $props();
</script>

<SlideOver {open} {onclose} size="lg">
	{#snippet header(__)}
		<div class="flex items-center gap-3">
			<div
				class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue"
			>
				<Eye class="h-4 w-4" />
			</div>
			<div>
				<p class="text-sm font-semibold text-brand-navy">Fórmula del paciente</p>
				<p class="text-xs text-on-surface-variant">Parámetros ópticos de la venta</p>
			</div>
		</div>
	{/snippet}

	<div class="space-y-4 p-4">
		{#if hasLensItem}
			<div class="rounded-xl bg-white/92 p-4 ring-1 ring-white/80">
				{#if lensTypeSuggestion.hasMixedCatalogLensTypes}
					<div class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950">
						<div class="flex items-start gap-2.5">
							<FlaskConical class="mt-0.5 h-4 w-4 shrink-0" />
							<div>
								<p class="text-sm font-semibold">Tipos de cristal distintos detectados</p>
								<p class="mt-1 text-xs leading-5 text-amber-900">
									Hay cristales de tipos distintos. Revisa el tipo de lente manualmente antes de
									continuar.
								</p>
							</div>
						</div>
					</div>
				{:else if lensTypeDecisionContext}
					<div class="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-amber-950">
						<div class="flex items-start gap-2.5">
							<FlaskConical class="mt-0.5 h-4 w-4 shrink-0" />
							<div class="min-w-0 flex-1">
								<p class="text-sm font-semibold">Confirma el tipo de lente base</p>
								<p class="mt-1 text-xs leading-5 text-amber-900">
									El cristal es
									<strong>{getLensTypeLabel(lensTypeDecisionContext.catalogLensType)}</strong>, pero
									la fórmula es
									<strong>{getLensTypeLabel(lensTypeDecisionContext.prescriptionLensType)}</strong>.
								</p>
								<div class="mt-2 flex flex-wrap gap-2">
									<button
										type="button"
										onclick={onKeepCatalogLensType}
										class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
									>
										Mantener {getLensTypeLabel(lensTypeDecisionContext.catalogLensType)}
									</button>
									<button
										type="button"
										onclick={onUseExistingPrescriptionLensType}
										class="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
									>
										Usar {getLensTypeLabel(lensTypeDecisionContext.prescriptionLensType)}
									</button>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<PrescriptionInput
					bind:values={prescriptionValues}
					existingPrescription={customerPrescription}
					selectedCatalogLensType={lensTypeSuggestion.catalogLensType}
					hasMixedCatalogLensTypes={lensTypeSuggestion.hasMixedCatalogLensTypes}
					showAddition={prescriptionValues.lensType !== 'MONOFOCAL'}
					compact={true}
					errors={visibleRxErrors}
				/>
			</div>
		{/if}
	</div>
</SlideOver>
