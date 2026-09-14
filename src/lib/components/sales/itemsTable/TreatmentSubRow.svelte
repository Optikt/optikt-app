<script lang="ts">
	import { FlaskConical } from '@lucide/svelte';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
	import { getTreatmentCategoryLabel } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';

	interface Props {
		treatment: SaleItemWithDetails;
	}

	let { treatment }: Props = $props();
</script>

<div
	class="grid grid-cols-[3fr_1fr_1fr_1.2fr] items-center gap-2 px-5 py-4 transition-colors hover:bg-gray-50/50"
>
	<div class="flex min-w-0 items-center gap-3">
		<div
			class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-purple-100 bg-purple-50"
		>
			<FlaskConical class="h-4 w-4 text-purple-600" />
		</div>
		<div class="min-w-0">
			<p class="truncate text-sm font-semibold text-gray-900">
				{treatment.supplierTreatment?.name ?? 'Tratamiento'}
			</p>
			<div class="mt-0.5 flex flex-wrap items-center gap-1.5">
				<span
					class="inline-flex items-center rounded border border-purple-100 bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-purple-700 uppercase"
				>
					Tratamiento
				</span>
				{#if treatment.supplierTreatment?.category}
					<span class="text-xs text-gray-400">
						{getTreatmentCategoryLabel(treatment.supplierTreatment.category)}
					</span>
				{/if}
			</div>
		</div>
	</div>
	<span class="text-center text-sm font-medium text-gray-700">{treatment.quantity}</span>
	<span class="text-right text-sm text-gray-500">{formatPrice(treatment.unitPrice)}</span>
	<span class="text-right text-sm font-bold text-gray-900"
		>{formatPrice(treatment.unitPrice * treatment.quantity)}</span
	>
</div>
